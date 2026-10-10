import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { createP2gSource } from './fixtures/p2gCatalogSource.mjs'
import { buildCatalog } from '../tools/build_mhp2g_catalog.mjs'
import { auditCatalog } from '../tools/audit_mhp2g_catalog.mjs'
import { sha256 } from '../tools/mhp2g/sources.mjs'
import { P2gItemCatalogRepository } from '../api/catalog/p2gItemRepository'

const cleanup=[]
afterEach(()=>cleanup.splice(0).reverse().forEach(fn=>fn()))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function png(color) {
  const crc = bytes => {let n=0xffffffff;for(const byte of bytes){n^=byte;for(let b=0;b<8;b++)n=n&1?0xedb88320^(n>>>1):n>>>1}return (n^0xffffffff)>>>0}
  const chunk=(kind,data)=>{const tag=Buffer.from(kind),header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([header,tag,data,tail])}
  const header=Buffer.alloc(13);header.writeUInt32BE(24,0);header.writeUInt32BE(24,4);header[8]=8;header[9]=6
  const scanlines=Buffer.concat(Array.from({length:24},()=>Buffer.concat([Buffer.from([0]),Buffer.from(Array.from({length:24},()=>color).flat())])))
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))])
}
function fixture() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p2g-icons-'));cleanup.push(()=>fs.rmSync(dir,{recursive:true,force:true}))
  const source=path.join(dir,'source.sqlite'),output=path.join(dir,'output'),folder=path.join(dir,'snapshot')
  createP2gSource(source);fs.mkdirSync(path.join(folder,'icons'),{recursive:true})
  const db=new Database(source)
  db.exec('ALTER TABLE native_item_catalog ADD COLUMN icon_id INTEGER; ALTER TABLE native_item_catalog ADD COLUMN color_id INTEGER; ALTER TABLE native_item_catalog ADD COLUMN row_sha256 TEXT;')
  const snapshot={schema:'mhp2g-item-icons-v1',gameId:'mhp2g',icons:[],items:[]}
  for(const [id,color,rgba] of [[1,2,[30,150,60,255]],[2,1,[240,50,50,255]]]){
    const bytes=png(rgba),sha=hash(bytes)
    snapshot.icons.push({iconId:id,colorId:color,pngSha256:sha,path:`catalog/icons/${sha}.png`})
    fs.writeFileSync(path.join(folder,'icons',`${sha}.png`),bytes)
  }
  for(const itemId of [1,2,3]){
    const iconId=itemId===3?2:1,colorId=itemId===3?1:2,rowSha256=hash(`synthetic row ${itemId}`)
    db.prepare('UPDATE native_item_catalog SET icon_id=?,color_id=?,row_sha256=? WHERE item_id=?').run(iconId,colorId,rowSha256,itemId)
    snapshot.items.push({itemId,iconKey:`${iconId}:${colorId}`,rowSha256})
  }
  db.close()
  const icons=path.join(folder,'manifest.json'),save=()=>fs.writeFileSync(icons,JSON.stringify(snapshot));save()
  return {source,output,icons,snapshot,save,expectedSha256:sha256(source)}
}

describe('P2G native icon pipeline',()=>{
  it('decodes synthetic tile crossings, palette transparency and PNG checksums',()=>{
    const run=spawnSync(process.platform==='win32'?'python':'python3',['tests/mhp2gItemIcons.test.py'],{encoding:'utf8'})
    expect(run.error??run.stderr).not.toContain('Traceback')
    expect(run.status,run.stderr).toBe(0)
  })
  it('maps all visible items through their native identities and exposes icons in list and detail',()=>{
    const f=fixture(),manifest=buildCatalog(f)
    expect(manifest.itemsWithIcons).toBe(3);expect(manifest.iconFiles).toBe(2)
    expect(auditCatalog({...f,delivery:f.output}).status).toBe('passed')
    expect(sha256(f.source)).toBe(f.expectedSha256)
    const db=new Database(path.join(f.output,'mhp2g.sqlite'));cleanup.push(()=>db.close())
    const repo=new P2gItemCatalogRepository(db),rows=repo.searchItems({gameId:'mhp2g'}).items
    expect(rows.every(row=>row.iconPath?.startsWith('catalog/icons/'))).toBe(true)
    expect(rows[0].iconPath).toBe(rows[1].iconPath)
    expect(rows[2].iconPath).not.toBe(rows[0].iconPath)
    expect(repo.getItem({gameId:'mhp2g',itemId:1}).iconPath).toBe(rows[0].iconPath)
    expect(repo.getItem({gameId:'mhp2g',itemId:0}).iconPath).toBeNull()
  })
  it.each(['missing','swapped','duplicate','corrupt'])('rejects %s mapping before publishing a catalog',kind=>{
    const f=fixture()
    if(kind==='missing')f.snapshot.items.pop()
    if(kind==='swapped')f.snapshot.items[0].iconKey='2:1'
    if(kind==='duplicate')f.snapshot.items.push(f.snapshot.items[0])
    if(kind==='corrupt')fs.writeFileSync(path.join(path.dirname(f.icons),'icons',`${f.snapshot.icons[0].pngSha256}.png`),'broken')
    f.save();expect(()=>buildCatalog(f)).toThrow();expect(fs.existsSync(f.output)).toBe(false)
  })
  it('audits swapped output paths even after the database checksum is refreshed',()=>{
    const f=fixture();buildCatalog(f)
    const file=path.join(f.output,'mhp2g.sqlite'),db=new Database(file)
    db.prepare('UPDATE catalog_items SET icon_path=? WHERE item_id=1').run(f.snapshot.icons[1].path);db.close()
    const manifestFile=path.join(f.output,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile));manifest.databaseSha256=sha256(file);fs.writeFileSync(manifestFile,JSON.stringify(manifest))
    expect(()=>auditCatalog({...f,delivery:f.output})).toThrow()
  })
})
