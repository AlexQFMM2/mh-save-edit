#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { tableFingerprint } from './mhp2g/skillCatalog.mjs'
import { readArmorEvidence } from './mhp2g/armorEvidence.mjs'
import { appendArmors, auditArmors } from './mhp2g/armorCatalog.mjs'

export const expectedArmorCounts = { armors: 2081, sets: 284, recipes: 2156, materials: 8240, legacy_usages: 8240, rewardArmors: 4, alternativeArmors: 79 }
export function buildArmorCatalog({ base, baseSha256, output, review, expected }) {
  assert(!fs.existsSync(output), 'Output exists; refusing to overwrite')
  assert.equal(sha256(base), baseSha256, 'Base fingerprint mismatch')
  const evidence = readArmorEvidence(review)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  const temp = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-armor-'))
  let db
  try {
    const file = path.join(temp, 'mhp2g.sqlite'); fs.copyFileSync(base, file)
    db = new Database(file); db.pragma('foreign_keys=ON')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata') ORDER BY name").all().map(r => r.name)
    const before = new Map(tables.map(t => [t, tableFingerprint(db, t)]))
    const builderHash = ['build_mhp2g_armor_catalog.mjs','mhp2g/armorEvidence.mjs','mhp2g/armorCatalog.mjs','mhp2g/armorFields.mjs'].map(n => sha256(fileURLToPath(new URL(n, import.meta.url)))).join(':')
    db.transaction(() => {
      appendArmors(db, evidence)
      db.prepare('INSERT INTO meta VALUES (?,?)').run('armor_schema', 'mhp2g-armors-v1')
      const caps = db.prepare("SELECT value FROM meta WHERE key='catalog_capabilities'").get().value
      db.prepare("UPDATE meta SET value=? WHERE key='catalog_capabilities'").run(`${caps},armor`)
      db.prepare('INSERT INTO catalog_build_metadata VALUES (?,?,?,?)').run('armor','mhp2g',evidence.sourceHash,builderHash)
    })()
    const audit = auditArmors(db, expected)
    for (const t of tables) assert.equal(tableFingerprint(db, t), before.get(t), `Existing table changed: ${t}`)
    audit.preservedTables = tables.length
    db.exec('VACUUM'); db.close(); db = null
    for (const i of evidence.iconFiles) { const target = path.join(temp,'assets',i.path); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.copyFileSync(i.file,target) }
    const result = { schema:'mhp2g-armors-v1',baseSha256,sourceManifestSha256:evidence.sourceHash,builderHash,databaseSha256:sha256(file),audit,icons:evidence.iconFiles.map(({path,sha256})=>({path,sha256})) }
    fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(result,null,2)+'\n')
    fs.renameSync(temp,output)
    return result
  } finally { db?.close(); fs.rmSync(temp,{recursive:true,force:true}) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1]
  for(const f of ['--base','--base-sha256','--output','--review']) assert(args.includes(f)&&arg(f)&&!arg(f).startsWith('--'),`Missing ${f}`)
  console.log(JSON.stringify(buildArmorCatalog({base:arg('--base'),baseSha256:arg('--base-sha256'),output:arg('--output'),review:arg('--review'),expected:expectedArmorCounts}),null,2))
}
