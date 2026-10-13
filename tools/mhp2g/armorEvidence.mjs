import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { armorFields } from './armorFields.mjs'
import { sha256 } from './sources.mjs'

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
/** Frozen private evidence only. No host, network, Dex or save-ID inference. */
export function readArmorEvidence(review) {
  const manifest = read(path.join(review, 'manifest.json'))
  assert.equal(manifest.schema, 'mhp2g-armor-evidence-v1')
  const checked = entry => {
    const file = path.resolve(review, entry.path)
    assert.equal(sha256(file), entry.sha256, `Armor input changed: ${entry.path}`)
    return file
  }
  const inputs = Object.fromEntries(Object.entries(manifest.inputs).map(([k, v]) => [k, checked(v)]))
  for (const entry of manifest.sources) checked(entry)
  const native = read(inputs.native).armors, localization = read(inputs.localization)
  const names = read(inputs.names), sets = read(inputs.sets).sets, icons = read(inputs.icons)
  assert.equal(names.schema, 'mhp2g-armor-name-review-v1')
  assert.equal(names.localizationSha256, sha256(inputs.localization))
  const rawTables = new Map(read(inputs.nativeTables).tables.map(t => [t.name, t]))
  for (const a of native) {
    const table = rawTables.get(`armor_${a.part}`), all = Buffer.from(table.bytesBase64, 'base64')
    assert.equal(createHash('sha256').update(all).digest('hex'), table.sha256)
    const row = all.subarray(a.index * 40, (a.index + 1) * 40)
    assert.equal(createHash('sha256').update(row).digest('hex'), a.rowSha256)
    const fields = armorFields(row)
    for (const k of ['rarity','priceRaw','baseDefense','slots','thresholds']) assert.deepEqual(fields[k], a[k])
    for (const k of ['fire','water','thunder','dragon','ice']) assert.equal(fields[`${k}Res`], a[k])
    assert.equal(fields.maxDefense, a.maxAfterFlag14)
    Object.assign(a, fields, { nativePoints: Array.from({length:5}, (_,i) => ({skill_id:row[30+i*2],points:row.readInt8(31+i*2)})).filter(p => p.skill_id !== 0) })
  }
  const rows = new Map(native.map(a => [a.equipmentKey, a]))
  assert.equal(rows.size, native.length, 'Duplicate native armor')
  const reviewed = new Map()
  for (const n of names.entries) {
    assert(!reviewed.has(n.equipmentKey), 'Duplicate name review')
    const a = rows.get(n.equipmentKey), binding = localization.bindings[n.equipmentKey]
    assert(a && binding && n.textKey === binding.name)
    assert.equal(n.nativeRowSha256, a.rowSha256)
    assert.equal(n.japanese, a.nameJp)
    assert.equal(n.japanese, localization.units[n.textKey].japanese)
    assert.equal(localization.units[n.textKey].status, 'pending')
    assert(n.basis && /\p{Script=Han}/u.test(n.chinese) && !/[\u3040-\u30ff]/u.test(n.chinese), 'Unreviewed armor name')
    reviewed.set(n.equipmentKey, n)
  }
  const db = new Database(inputs.pilot, { readonly: true, fileMustExist: true })
  try {
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
    const records = new Map(db.prepare("SELECT record_key,row_sha256,name FROM records WHERE record_key LIKE 'armor_%'").all().map(a => [a.record_key, a]))
    for (const a of native) assert.equal(a.rowSha256, records.get(a.equipmentKey)?.row_sha256, `Native identity changed: ${a.equipmentKey}`)
    const recipes = db.prepare("SELECT recipe_key,target_equipment_key,virtual_address,row_sha256 FROM creation_recipes WHERE target_equipment_key LIKE 'armor_%' ORDER BY recipe_key").all().map(r => ({ ...r, materials: db.prepare('SELECT position,item_id,quantity FROM creation_materials WHERE recipe_key=? ORDER BY position').all(r.recipe_key) }))
    const crafting = read(inputs.crafting)
    assert.equal(crafting.bootSha256, read(inputs.nativeTables).bootSha256)
    const window = crafting.tables.find(t => t.name === 'creation_window'), rawRecipes = Buffer.from(window.bytesBase64, 'base64')
    assert.equal(createHash('sha256').update(rawRecipes).digest('hex'), window.sha256)
    for (const r of recipes) {
      const offset = r.virtual_address - window.va
      assert(offset >= 0 && offset + 26 <= rawRecipes.length, 'Recipe outside native window')
      const raw = rawRecipes.subarray(offset, offset + 26)
      assert.equal(createHash('sha256').update(raw).digest('hex'), r.row_sha256)
      const part = ['legs','head','chest','arms','waist'][raw[0]]
      assert.equal(r.target_equipment_key, `armor_${part}:${raw.readUInt16LE(2)}`)
      const materials = Array.from({length:4}, (_,i) => ({position:i,item_id:raw.readUInt16LE(4+i*4),quantity:raw[6+i*4]})).filter(m => m.item_id !== 0)
      assert.deepEqual(r.materials, materials, 'Recipe material decoding changed')
    }
    const points = db.prepare("SELECT owner_key,skill_id,points FROM skill_points WHERE owner_key LIKE 'armor_%' ORDER BY owner_key,position").all()
    for (const a of native) assert.deepEqual(points.filter(p => p.owner_key === a.equipmentKey).map(({skill_id,points})=>({skill_id,points})), a.nativePoints, `Signed skills changed: ${a.equipmentKey}`)
    const iconFiles = icons.icons.map(i => {
      assert.equal(i.path, `catalog/icons/${i.pngSha256}.png`)
      const file = path.join(path.dirname(inputs.icons), `${i.pngSha256}.png`)
      assert.equal(sha256(file), i.pngSha256)
      return { file, path: i.path, sha256: i.pngSha256 }
    })
    const armors = native.map(a => {
      const u = localization.units[localization.bindings[a.equipmentKey]?.name]
      assert(u && u.japanese === a.nameJp)
      const reviewName = reviewed.get(a.equipmentKey)
      return { ...a, nameCn: reviewName?.chinese ?? u.chinese, nameSource: reviewName ? 'reviewed' : u.status, legacyName: records.get(a.equipmentKey).name }
    })
    return { armors, recipes, points, sets, icons, iconFiles, eligibility: read(inputs.eligibility), sourceHash: sha256(path.join(review, 'manifest.json')) }
  } finally { db.close() }
}
