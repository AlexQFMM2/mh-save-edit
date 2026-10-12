#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { catalogIdentityRows, identityFingerprint } from '../api/terminology/catalogIdentity.mjs'

export function auditMonsters({base,evidence,icons,delivery}) {
  const manifest=JSON.parse(fs.readFileSync(path.join(delivery,'manifest.json')))
  const snapshot=JSON.parse(fs.readFileSync(evidence)),iconSnapshot=JSON.parse(fs.readFileSync(icons))
  const file=path.join(delivery,'mhp2g.sqlite')
  for(const [key,input] of Object.entries({base,evidence,icons,database:file}))assert.equal(sha256(input),manifest[`${key}Sha256`],`${key} fingerprint mismatch`)
  for(const input of Object.values(snapshot.inputs))if(input.path)assert.equal(sha256(input.path),input.sha256,`Input changed: ${input.path}`)
  const db=new Database(file,{readonly:true}),original=new Database(base,{readonly:true})
  try {
    assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.equal(db.pragma('foreign_key_check').length,0)
    const itemFingerprint=identityFingerprint(catalogIdentityRows(db,'mhp2g'))
    assert.equal(itemFingerprint,identityFingerprint(catalogIdentityRows(original,'mhp2g')))
    for(const {name} of original.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
      if(['meta','catalog_build_metadata','catalog_item_relations'].includes(name))continue
      const query=`SELECT * FROM "${name.replaceAll('"','""')}"`
      assert.deepEqual(db.prepare(query).all(),original.prepare(query).all(),`Unrelated table changed: ${name}`)
    }
    const iconDefinitions=new Map(iconSnapshot.definitions.map(d=>[d.monsterId,d.path]))
    const iconMap=new Map(iconSnapshot.monsters.map(m=>[m.monsterId,iconDefinitions.get(m.iconMonsterId)]))
    const expectedRelations=new Map();let drops=0,zones=0,quests=0
    assert.equal(db.prepare('SELECT count(*) n FROM catalog_monsters').get().n,snapshot.monsters.length)
    for(const monster of snapshot.monsters) {
      const row=db.prepare('SELECT * FROM catalog_monsters WHERE monster_id=?').get(monster.monsterId)
      assert(row);assert.equal(row.game_id,'mhp2g');assert.equal(row.name_cn,monster.nameCn);assert.equal(row.name_jp,monster.nameJp);assert.equal(row.name_en,monster.nameEn)
      assert.deepEqual(JSON.parse(row.aliases),monster.aliases)
      assert.equal(row.icon_path,iconMap.get(monster.monsterId))
      assert.equal(sha256(path.join(delivery,'icons',path.basename(row.icon_path))),path.basename(row.icon_path,'.png'))
      const detail=JSON.parse(row.detail_json)
      assert.deepEqual(detail,{weakness:monster.weakness,ailments:monster.ailments,traps:monster.traps,p2gQuests:monster.quests})
      const uniqueQuests=new Set(monster.quests.map(q=>q.questKey));assert.equal(uniqueQuests.size,monster.quests.length)
      zones+=detail.weakness.length;quests+=detail.p2gQuests.length
      const rows=db.prepare('SELECT d.*,r.source_key FROM catalog_monster_drops d JOIN catalog_item_relations r ON r.id=d.relation_id WHERE monster_id=?').all(monster.monsterId)
      assert.equal(rows.length,monster.drops.length)
      for(const drop of monster.drops) {
        const key=`monster:${drop.linkId}:${drop.ordinal}`,row=rows.find(r=>r.source_key===key)
        assert(row);assert.equal(row.item_id,drop.itemId);assert.equal(row.quantity,drop.quantity);assert.equal(row.probability,drop.probability)
        assert.equal(row.method_name_cn,drop.methodNameCn);assert(row.probability>=0&&row.probability<=100)
        assert(!expectedRelations.has(row.relation_id));expectedRelations.set(row.relation_id,{monster,row});drops++
      }
    }
    assert.equal(db.prepare('SELECT count(*) n FROM catalog_monster_drops').get().n,drops)
    const originals=original.prepare('SELECT * FROM catalog_item_relations ORDER BY id').all()
    const updated=db.prepare('SELECT * FROM catalog_item_relations ORDER BY id').all();assert.equal(updated.length,originals.length)
    for(let i=0;i<originals.length;i++) {
      const before=originals[i],after=updated[i],match=expectedRelations.get(before.id)
      if(!match){assert.deepEqual(after,before);continue}
      const {target_name,pending_target,metadata,...stable}=after
      assert.deepEqual(stable,Object.fromEntries(Object.entries(before).filter(([key])=>!['target_name','pending_target','metadata'].includes(key))))
      assert.equal(target_name,match.monster.nameCn);assert.equal(pending_target,null)
      assert.equal(JSON.parse(metadata).details,`${match.row.rank_name_cn} · ${match.row.method_name_cn}`)
    }
    return {status:'passed',monsters:snapshot.monsters.length,zones,drops,questAppearances:quests,itemFingerprint,databaseSha256:sha256(file)}
  } finally {db.close();original.close()}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1]
  for(const flag of ['--base','--evidence','--icons','--delivery'])assert(args.includes(flag),`Missing ${flag}`)
  console.log(JSON.stringify(auditMonsters({base:option('--base'),evidence:option('--evidence'),icons:option('--icons'),delivery:option('--delivery')}),null,2))
}
