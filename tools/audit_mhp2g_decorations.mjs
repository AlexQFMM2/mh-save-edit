#!/usr/bin/env node
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { auditDecorations } from './mhp2g/decorationCatalog.mjs'
import { expectedDecorationCounts } from './build_mhp2g_decoration_catalog.mjs'
import { tableFingerprint } from './mhp2g/skillCatalog.mjs'
import { sha256 } from './mhp2g/sources.mjs'
const args=process.argv.slice(2),arg=name=>args[args.indexOf(name)+1]
assert(args.includes('--database')&&args.includes('--base'),'Usage: --database <new.sqlite> --base <base.sqlite>')
const db=new Database(arg('--database'),{readonly:true,fileMustExist:true}),base=new Database(arg('--base'),{readonly:true,fileMustExist:true})
try {
  assert.equal(db.prepare("SELECT value FROM meta WHERE key='decoration_schema'").get()?.value,'mhp2g-decorations-v1')
  assert.equal(db.prepare("SELECT source_sha256 FROM catalog_build_metadata WHERE domain='decorations'").get()?.source_sha256,sha256(arg('--base')))
  const report=auditDecorations(db,expectedDecorationCounts)
  for(const {name} of base.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('meta','catalog_build_metadata')").all())assert.equal(tableFingerprint(db,name),tableFingerprint(base,name),`Existing table changed: ${name}`)
  console.log(JSON.stringify({status:'passed',...report},null,2))
} finally {db.close();base.close()}
