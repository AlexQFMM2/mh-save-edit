#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'

// Common ranks have full native reward-pool matches against the P2G Wiki.
// Unconfirmed slots stay separate and unnamed, preserving all reward records.
const ranks = { unranked:[0,'★1～2'], low:[1,'下位'], high:[2,'上位'], g:[3,'G 级'], treasure:[4,'寻宝'], training:[5,'未标注位阶 5'], misc:[6,'未标注位阶 6'] }

export function buildMonsterCatalog({ base, evidence, icons, output }) {
  assert(!fs.existsSync(output), 'Output exists; refusing to overwrite')
  const snapshot = JSON.parse(fs.readFileSync(evidence, 'utf8'))
  const iconSnapshot = JSON.parse(fs.readFileSync(icons, 'utf8'))
  assert.equal(snapshot.schema, 'mhp2g-monster-evidence-v1')
  assert.equal(iconSnapshot.schema, 'mhp2g-monster-icons-v1')
  assert.equal(snapshot.inputs.icons.sha256, sha256(icons), 'Prepared evidence uses another icon snapshot')
  const definitions = new Map(iconSnapshot.definitions.map(row => [row.monsterId,row]))
  assert.equal(definitions.size, iconSnapshot.definitions.length, 'Duplicate icon definition')
  const iconMap = new Map(iconSnapshot.monsters.map(row => [row.monsterId,definitions.get(row.iconMonsterId)?.path]))
  assert.equal(iconMap.size, iconSnapshot.monsters.length, 'Duplicate icon identity')
  const files = new Map()
  for (const row of iconSnapshot.definitions) {
    assert.match(row.pngSha256, /^[a-f0-9]{64}$/)
    assert.equal(row.path, `catalog/icons/${row.pngSha256}.png`)
    const file = path.join(path.dirname(icons), 'icons', `${row.pngSha256}.png`)
    assert.equal(sha256(file), row.pngSha256, 'Monster PNG fingerprint mismatch')
    const png = fs.readFileSync(file)
    assert(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    assert.equal(png.readUInt32BE(16), 36); assert.equal(png.readUInt32BE(20), 36)
    files.set(`${row.pngSha256}.png`, png)
  }
  fs.mkdirSync(path.dirname(output), { recursive:true })
  const temporary = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-monsters-'))
  let db
  try {
    const database = path.join(temporary, 'mhp2g.sqlite')
    fs.copyFileSync(base, database)
    db = new Database(database)
    db.pragma('foreign_keys=ON')
    assert.equal(db.prepare("SELECT value FROM meta WHERE key='catalog_schema'").get()?.value, 'mhp2g-items-v1')
    assert.equal(db.pragma('integrity_check', { simple:true }), 'ok')
    db.exec(`
      CREATE TABLE catalog_monsters(
        monster_id INTEGER PRIMARY KEY,game_id TEXT NOT NULL CHECK(game_id='mhp2g'),
        name_cn TEXT NOT NULL,name_jp TEXT NOT NULL,name_en TEXT NOT NULL,
        aliases TEXT NOT NULL CHECK(json_valid(aliases)),icon_path TEXT NOT NULL,
        detail_json TEXT NOT NULL CHECK(json_valid(detail_json)));
      CREATE TABLE catalog_monster_drops(
        id INTEGER PRIMARY KEY,monster_id INTEGER NOT NULL REFERENCES catalog_monsters(monster_id),
        item_id INTEGER NOT NULL REFERENCES catalog_items(item_id),
        relation_id INTEGER UNIQUE NOT NULL REFERENCES catalog_item_relations(id),
        rank_id INTEGER NOT NULL,rank_name_cn TEXT NOT NULL,method_id INTEGER NOT NULL,
        method_name_cn TEXT NOT NULL,quantity INTEGER,probability REAL NOT NULL CHECK(probability BETWEEN 0 AND 100));
      CREATE INDEX catalog_monster_drop_monster ON catalog_monster_drops(monster_id,rank_id,method_id);
      CREATE INDEX catalog_monster_drop_item ON catalog_monster_drops(item_id);
    `)
    const insert = db.prepare("INSERT INTO catalog_monsters VALUES(?,'mhp2g',?,?,?,?,?,?)")
    const insertDrop = db.prepare('INSERT INTO catalog_monster_drops VALUES(?,?,?,?,?,?,?,?,?,?)')
    const relation = db.prepare('SELECT id,item_id,quantity,probability FROM catalog_item_relations WHERE source_key=?')
    const updateRelation = db.prepare('UPDATE catalog_item_relations SET target_name=?,pending_target=NULL,metadata=? WHERE id=?')
    const ids = new Set(), methods = new Map()
    let dropId = 0
    db.transaction(() => {
      for (const monster of snapshot.monsters) {
        const id = monster.monsterId
        assert(Number.isInteger(id) && id > 0 && id < 90 && !ids.has(id), 'Invalid monster identity')
        ids.add(id)
        assert.equal(monster.iconPath, iconMap.get(id), 'Monster icon identity mismatch')
        assert(monster.nameCn.trim() && monster.nameJp.trim(), 'Missing readable name')
        const details = { weakness:monster.weakness, ailments:monster.ailments, traps:monster.traps, p2gQuests:monster.quests }
        insert.run(id, monster.nameCn, monster.nameJp, monster.nameEn, JSON.stringify(monster.aliases), monster.iconPath, JSON.stringify(details))
        for (const drop of monster.drops) {
          assert(Object.hasOwn(ranks, drop.rankSlot), 'Unknown rank slot')
          const [rankId,rankName] = ranks[drop.rankSlot]
          const key = `monster:${drop.linkId}:${drop.ordinal}`
          const target = relation.get(key)
          assert(target && target.item_id === drop.itemId, 'Reward item relation identity mismatch')
          assert.equal(target.quantity, drop.quantity, 'Reward quantity differs from native item relation')
          assert.equal(target.probability, drop.probability, 'Reward probability differs from native item relation')
          assert(drop.quantity == null || Number.isInteger(drop.quantity) && drop.quantity > 0)
          const method = `${drop.kind}:${drop.partCode ?? ''}`
          if (!methods.has(method)) methods.set(method, methods.size)
          insertDrop.run(++dropId,id,drop.itemId,target.id,rankId,rankName,methods.get(method),drop.methodNameCn,drop.quantity,drop.probability)
          updateRelation.run(monster.nameCn, JSON.stringify({ details:`${rankName} · ${drop.methodNameCn}`, sourceKey:key, evidence:'P2G 原生奖励表' }), target.id)
        }
      }
      assert.deepEqual([...ids].sort((a,b)=>a-b), iconSnapshot.monsters.map(m=>m.monsterId).sort((a,b)=>a-b), 'Icon/monster coverage mismatch')
      db.prepare("INSERT OR REPLACE INTO meta VALUES('catalog_capabilities','items,monsters')").run()
      db.prepare("INSERT INTO meta VALUES('monster_schema','mhp2g-monsters-v1')").run()
      db.prepare('INSERT INTO catalog_build_metadata VALUES(?,?,?,?)').run('monsters','mhp2g',sha256(evidence),sha256(fileURLToPath(import.meta.url)))
    })()
    assert.equal(db.pragma('integrity_check', { simple:true }), 'ok')
    assert.equal(db.pragma('foreign_key_check').length, 0)
    db.exec('VACUUM'); db.close(); db = null
    fs.mkdirSync(path.join(temporary,'icons'))
    for (const [file,png] of files) fs.writeFileSync(path.join(temporary,'icons',file),png)
    const manifest = { schema:'mhp2g-monsters-v1',baseSha256:sha256(base),evidenceSha256:sha256(evidence),iconsSha256:sha256(icons),databaseSha256:sha256(database),monsters:ids.size,drops:dropId,iconFiles:files.size }
    fs.writeFileSync(path.join(temporary,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
    fs.writeFileSync(path.join(temporary,'audit.json'),JSON.stringify({status:'passed',...manifest,coverage:snapshot.audit},null,2)+'\n')
    assert(!fs.existsSync(output), 'Output exists; refusing to overwrite')
    fs.renameSync(temporary,output)
    return manifest
  } finally { db?.close(); fs.rmSync(temporary,{recursive:true,force:true}) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2), option=name=>args[args.indexOf(name)+1]
  for(const flag of ['--base','--evidence','--icons','--output']) assert(args.includes(flag),`Missing ${flag}`)
  console.log(JSON.stringify(buildMonsterCatalog({base:option('--base'),evidence:option('--evidence'),icons:option('--icons'),output:option('--output')}),null,2))
}
