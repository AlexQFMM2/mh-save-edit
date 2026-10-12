#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { sha256 } from './mhp2g/sources.mjs'
import { tableFingerprint } from './mhp2g/skillCatalog.mjs'
import { appendDecorations, auditDecorations } from './mhp2g/decorationCatalog.mjs'
export const expectedDecorationCounts={decorations:168,points:281,recipes:192,materials:597}
export function buildDecorationCatalog({base,output,baseSha256,expected}) {
  assert(!fs.existsSync(output),'Output exists; refusing to overwrite')
  if(baseSha256)assert.equal(sha256(base),baseSha256,'Base fingerprint mismatch')
  fs.mkdirSync(path.dirname(output),{recursive:true})
  const temp=fs.mkdtempSync(path.join(path.dirname(output),'.p2g-decorations-'));let db
  try {
    const file=path.join(temp,'mhp2g.sqlite');fs.copyFileSync(base,file);db=new Database(file);db.pragma('foreign_keys=ON')
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata') ORDER BY name").all().map(r=>r.name)
    const before=new Map(tables.map(t=>[t,tableFingerprint(db,t)]))
    const builderHash=sha256(fileURLToPath(import.meta.url))+':'+sha256(fileURLToPath(new URL('./mhp2g/decorationCatalog.mjs',import.meta.url)))
    db.transaction(()=>{
      appendDecorations(db)
      db.prepare('INSERT INTO meta VALUES (?,?)').run('decoration_schema','mhp2g-decorations-v1')
      const caps=db.prepare("SELECT value FROM meta WHERE key='catalog_capabilities'").get()?.value??'items'
      db.prepare("INSERT OR REPLACE INTO meta VALUES ('catalog_capabilities',?)").run(`${caps},decorations`)
      db.prepare('INSERT INTO catalog_build_metadata VALUES (?,?,?,?)').run('decorations','mhp2g',sha256(base),builderHash)
    })()
    const audit=auditDecorations(db,expected)
    for(const t of tables)assert.equal(tableFingerprint(db,t),before.get(t),`Existing table changed: ${t}`)
    audit.preservedTables=tables.length;db.exec('VACUUM');db.close();db=null
    const result={schema:'mhp2g-decorations-v1',baseSha256:sha256(base),builderHash,databaseSha256:sha256(file),audit}
    fs.writeFileSync(path.join(temp,'manifest.json'),JSON.stringify(result,null,2)+'\n')
    assert(!fs.existsSync(output),'Output exists');fs.renameSync(temp,output);return result
  } finally {db?.close();fs.rmSync(temp,{recursive:true,force:true})}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1]
  for(const flag of ['--base','--output','--base-sha256'])assert(args.includes(flag),`Missing ${flag}`)
  console.log(JSON.stringify(buildDecorationCatalog({base:arg('--base'),output:arg('--output'),baseSha256:arg('--base-sha256'),expected:expectedDecorationCounts}),null,2))
}
