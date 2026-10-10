#!/usr/bin/env node
// Offline repository verification. Does not launch Electron or a browser.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { auditCatalog } from './audit_mhp2g_catalog.mjs'
import { sha256 } from './mhp2g/sources.mjs'
import { applyItemJapaneseEvidence } from './mhp2g/itemJapaneseEvidence.mjs'
const require=createRequire(import.meta.url), {build}=createRequire(require.resolve('vite'))('esbuild')
const root=path.resolve(import.meta.dirname,'..'),output=path.resolve(process.argv[2]??path.join(root,'.runtime-assets/mhp2g-items-offline'))
const source=path.resolve(root,'../research/generated/mh-save-edit/mhp2g/pilot-r9/mhp2g-pilot.sqlite')
const withIcons=path.resolve(root,'../research/generated/mh-save-edit/mhp2g/catalog-items-icons-v1')
const deliveryOption=process.argv.indexOf('--delivery')
const delivery=deliveryOption>=0?path.resolve(process.argv[deliveryOption+1]):fs.existsSync(withIcons)?withIcons:path.resolve(root,'../research/generated/mh-save-edit/mhp2g/catalog-items-v1')
fs.mkdirSync(output,{recursive:true})
const audit=auditCatalog({source,delivery})
const moduleFile=path.join(output,'repository.mjs')
await build({entryPoints:[path.join(root,'api/catalog/p2gItemRepository.ts')],outfile:moduleFile,platform:'node',format:'esm',bundle:true,packages:'external'})
const {P2gItemCatalogRepository}=await import(pathToFileURL(moduleFile).href)
const file=path.join(root,'data/mhp2g.sqlite'),before=sha256(file)
const db=new Database(file,{readonly:true,fileMustExist:true})
try {
  let japaneseSupplement = null
  if (before !== audit.databaseSha256) {
    const localized = db.prepare("SELECT value FROM meta WHERE key='localization_sha256'").get()
    if (localized) assert(deliveryOption>=0, 'Original-backed catalog verification requires --delivery pointing to its audited build')
    const evidencePath = localized ? null : path.resolve(process.argv[3] ?? path.join(root, '../research/mhp2g/item-japanese-v2/evidence.json'))
    const evidence = evidencePath ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : null
    if (evidence) {
      assert(evidence.inputs?.length, 'Japanese evidence needs source fingerprints')
      for (const input of evidence.inputs) assert.equal(sha256(input.path), input.sha256, `Japanese source changed: ${input.path}`)
    }
    // Reconstruct in memory from the audited icon catalog, then compare every
    // table and schema object. No unrelated changes are accepted by this path.
    const expected = new Database(fs.readFileSync(path.join(delivery, 'mhp2g.sqlite')))
    try {
      const changed = evidence ? applyItemJapaneseEvidence(expected, evidence) : 0
      const schema = "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name"
      assert.deepEqual(db.prepare(schema).all(), expected.prepare(schema).all())
      for (const { name } of expected.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()) {
        const query = `SELECT * FROM "${name.replaceAll('"', '""')}"`
        const rows = database => database.prepare(query).raw().all().map(row => JSON.stringify(row)).sort()
        assert.deepEqual(rows(db), rows(expected), `Unexpected runtime change in ${name}`)
      }
      japaneseSupplement = evidencePath ? { path: evidencePath, sha256: sha256(evidencePath), changed } : null
    } finally { expected.close() }
  }
  const repo=new P2gItemCatalogRepository(db), first=repo.searchItems({gameId:'mhp2g',includePlaceholders:true,pageSize:100})
  assert.equal(first.total,1261)
  let read=0, linked=0, pending=0
  const ids=new Set(db.prepare('SELECT item_id FROM catalog_items').all().map(r=>r.item_id))
  for(let page=1;page<=Math.ceil(first.total/100);page++){
    const batch=repo.searchItems({gameId:'mhp2g',includePlaceholders:true,pageSize:100,page})
    for(const row of batch.items){
      const detail=repo.getItem({gameId:'mhp2g',itemId:row.itemId});assert.equal(detail.itemId,row.itemId);assert.equal(detail.gameId,'mhp2g');assert(!('saveId' in detail));read++
      if (detail.iconPath) {
        assert.match(detail.iconPath, /^catalog\/icons\/[a-f0-9]{64}\.png$/)
        assert.equal(sha256(path.join(root,'ui/public/assets',detail.iconPath)),path.basename(detail.iconPath,'.png'))
      } else if (audit.itemsWithIcons) assert(row.isPlaceholder,`Missing icon for item ${row.itemId}`)
      for(const relation of detail.relations){for(const item of relation.relatedItems){assert.equal(item.gameId,'mhp2g');assert(ids.has(item.itemId));linked++}if(relation.pendingTarget)pending++}
    }
  }
  assert.equal(read,1261)
  const jp=db.prepare("SELECT item_id,name_jp FROM catalog_items WHERE name_jp<>'' AND is_placeholder=0 LIMIT 1").get()
  assert(repo.searchItems({gameId:'mhp2g',query:jp.name_jp}).items.some(i=>i.itemId===jp.item_id))
  for(const facet of repo.getItemFacets().relations){assert(repo.searchItems({gameId:'mhp2g',...(facet.usageKind?{usageKinds:[facet.usageKind]}:{sourceKinds:[facet.sourceKind]}),pageSize:1}).total>0)}
  assert.equal(sha256(file),before)
  const report={status:'passed',databaseSha256:before,japaneseSupplement,itemsRead:read,relatedItemEndpointsRead:linked,pendingTargetsRead:pending,audit,limits:['Offline repository validation only. Electron IPC and visual checks are separate.']}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({status:report.status,itemsRead:read,relatedItemEndpointsRead:linked,pendingTargetsRead:pending,output}))
} finally {db.close();fs.unlinkSync(moduleFile)}
