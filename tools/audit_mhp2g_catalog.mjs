#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { R9_SHA256, SCHEMA_VERSION, verifySource, sha256 } from './mhp2g/sources.mjs'
import { readItemIcons } from './mhp2g/iconSnapshot.mjs'
import { readLocalization, displayText, translationSource } from './mhp2g/localization.mjs'

export function auditCatalog({source, delivery, expectedSha256 = R9_SHA256}) {
  verifySource(source, expectedSha256)
  const manifest = JSON.parse(fs.readFileSync(path.join(delivery, 'manifest.json'), 'utf8'))
  const file = path.join(delivery, 'mhp2g.sqlite')
  assert.equal(manifest.databaseSha256, sha256(file)); assert.equal(manifest.sourceSha256, expectedSha256)
  const input = new Database(source, { readonly: true }), db = new Database(file, { readonly: true })
  try {
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok'); assert.deepEqual(db.pragma('foreign_key_check'), [])
    assert.equal(db.prepare("SELECT value FROM meta WHERE key='catalog_schema'").get().value, SCHEMA_VERSION)
    const native = input.prepare('SELECT * FROM native_item_catalog ORDER BY item_id').all(), output = db.prepare('SELECT * FROM catalog_items ORDER BY item_id').all()
    const localizationFile = path.join(delivery, 'localization/localization.json')
    const localized = manifest.localizationSha256 ? readLocalization(localizationFile, expectedSha256) : null
    if (localized) {
      assert.equal(sha256(localizationFile), manifest.localizationSha256)
      assert.equal(db.prepare("SELECT value FROM meta WHERE key='localization_sha256'").get().value, manifest.localizationSha256)
      assert.equal(db.prepare('SELECT count(*) n FROM catalog_item_localization').get().n, native.length)
    }
    const icons = manifest.iconSnapshotSha256 ? readItemIcons(input, output, path.join(delivery, 'item-icons.json')) : null
    if (icons) {
      assert.equal(icons.sha256, manifest.iconSnapshotSha256)
      assert.equal(icons.byItemId.size, manifest.itemsWithIcons)
      assert.equal(icons.files.size, manifest.iconFiles)
    }
    assert.equal(output.length, native.length)
    for (let i=0; i<native.length; i++) {
      const a=native[i], b=output[i]
      assert.equal(b.item_id,a.item_id)
      if (localized) {
        const binding = localized.bindings[`item:${a.item_id}`], name = localized.units[binding.name], description = localized.units[binding.description]
        assert.equal(b.name_cn, displayText(name)); assert.equal(b.name_jp, name.japanese)
        assert.equal(b.description, displayText(description).replaceAll('\\n','\n'))
        assert.deepEqual(db.prepare('SELECT * FROM catalog_item_localization WHERE item_id=?').get(a.item_id), { item_id: a.item_id, original_name: a.name, name_source: translationSource(name), name_status: name.status, description_jp: description.japanese, description_source: translationSource(description), description_status: description.status })
      } else {
        assert.equal(b.name_cn,a.name); assert.equal(b.description,a.description.replaceAll('\\n','\n'))
      }
      assert.equal(b.max_stack,a.stack_limit); assert.equal(b.buy_price,a.buy_price); assert.equal(b.sell_price,a.sell_price)
      for (const field of ['save_id','dex_id','rarity']) assert.equal(b[field],null)
      assert.equal(b.icon_path, icons?.byItemId.get(b.item_id) ?? null)
      assert.equal(b.name_en,'')
    }
    const get = db.prepare('SELECT * FROM catalog_item_relations WHERE source_key=?')
    const targets = db.prepare('SELECT item_id FROM catalog_item_relation_targets WHERE relation_id=? ORDER BY position')
    const recipes=input.prepare("SELECT payload_json FROM wiki_business_observations WHERE kind='recipe'").all()
    for (const {payload_json} of recipes) {
      const r=JSON.parse(payload_json), key=`recipe:${r.source_page}:${r.table_index}:${r.row_index}`, row=get.get(key)
      assert.equal(row.item_id,r.native_result_id); assert.equal(row.probability,r.success_pct_wiki)
      assert.equal(row.quantity,r.amount_min_wiki===r.amount_max_wiki?r.amount_min_wiki:null)
      assert.deepEqual(targets.all(row.id).map(t=>t.item_id),[r.native_material_a_id,r.native_material_b_id])
      const m=JSON.parse(row.metadata); assert.equal(m.amountMin,String(r.amount_min_wiki)); assert.equal(m.amountMax,String(r.amount_max_wiki)); assert(m.details.includes(r.notes_ja))
      for (const [i,id] of [r.native_material_a_id,r.native_material_b_id].entries()) {
        const reverse=get.get(`${key}:ingredient:${i}`); assert.equal(reverse.item_id,id); assert.deepEqual(targets.all(reverse.id).map(t=>t.item_id),[r.native_result_id]); assert.equal(reverse.probability,null)
      }
    }
    for (const r of input.prepare('SELECT * FROM wiki_r7_gathering WHERE native_item_id IS NOT NULL').all()) {
      const row=get.get(`gathering:${r.key}`); assert.equal(row.item_id,r.native_item_id); assert.equal(row.probability,null)
    }
    for (const {payload_json} of input.prepare("SELECT payload_json FROM wiki_r6_records WHERE kind='shop-condition'").all()) {
      const r=JSON.parse(payload_json); if(r.native_item_id==null) continue
      const row=get.get(`shop:${r.key}`); assert.equal(row.item_id,r.native_item_id); assert.equal(row.probability,null)
      const m=JSON.parse(row.metadata); for(const condition of r.unlock_conditions) assert(m.details.includes(condition.raw_text))
      if(r.price_z_as_listed!=null) assert(m.details.includes(`${r.price_z_as_listed} z`))
    }
    assert.equal(db.prepare("SELECT count(*) n FROM catalog_item_relations WHERE source_kind IN ('location','shop','quest') AND probability IS NOT NULL").get().n,0)
    assert.equal(db.prepare("SELECT count(*) n FROM catalog_item_relations WHERE source_kind IN ('weapon','armor','decoration','monster','quest') AND pending_target IS NULL").get().n,0)
    const relationCounts=db.prepare('SELECT source_kind,count(*) AS count FROM catalog_item_relations GROUP BY source_kind ORDER BY source_kind').all()
    assert.deepEqual(relationCounts,manifest.relationCounts)
    return {status:'passed',databaseSha256:sha256(file),items:output.length,itemsWithIcons:icons?.byItemId.size??0,iconFiles:icons?.files.size??0,recipes:recipes.length,relationCounts,checks:['integrity-and-endpoints','native-items-parity','no-save-or-dex-identities','recipe-fields-and-bidirectional-endpoints','native-gathering-endpoints','shop-conditions-and-prices','unknown-probabilities','pending-cross-catalog-targets',...(icons?['native-icon-color-and-row-identities','complete-icon-coverage-and-png-checksums']:[])]}
  } finally {input.close();db.close()}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2), option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]}
  const source=option('--source')??path.resolve('../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite'), delivery=option('--delivery')
  if(!delivery) throw new Error('Usage: node tools/audit_mhp2g_catalog.mjs --delivery DIRECTORY [--source R9_SQLITE]')
  console.log(JSON.stringify(auditCatalog({source,delivery}),null,2))
}
