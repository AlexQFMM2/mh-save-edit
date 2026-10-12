// Entirely synthetic catalog and image; no research inputs.
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { deflateSync } from 'node:zlib'
import { createP2gSource } from './p2gCatalogSource.mjs'
import { buildCatalog } from '../../tools/build_mhp2g_catalog.mjs'
import { sha256 } from '../../tools/mhp2g/sources.mjs'
function png() {
  const crc=bytes=>{let n=0xffffffff;for(const byte of bytes){n^=byte;for(let b=0;b<8;b++)n=n&1?0xedb88320^(n>>>1):n>>>1}return (n^0xffffffff)>>>0}
  const chunk=(kind,data)=>{const tag=Buffer.from(kind),head=Buffer.alloc(4),tail=Buffer.alloc(4);head.writeUInt32BE(data.length);tail.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([head,tag,data,tail])}
  const head=Buffer.alloc(13);head.writeUInt32BE(36);head.writeUInt32BE(36,4);head[8]=8;head[9]=6
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.alloc(36*(1+36*4)))),chunk('IEND',Buffer.alloc(0))])
}
export function createMonsterFixture(dir) {
  const source=path.join(dir,'source.sqlite');createP2gSource(source)
  const db=new Database(source)
  db.exec("UPDATE monster_rewards SET rank_slot='high'; UPDATE reward_items SET amount=NULL")
  db.close()
  const items=path.join(dir,'items');buildCatalog({source,output:items,expectedSha256:sha256(source)})
  const base=path.join(items,'mhp2g.sqlite'),folder=path.join(dir,'icon-source');fs.mkdirSync(path.join(folder,'icons'),{recursive:true})
  const image=path.join(folder,'image.png');fs.writeFileSync(image,png());const hash=sha256(image),iconPath=`catalog/icons/${hash}.png`
  fs.renameSync(image,path.join(folder,'icons',`${hash}.png`))
  const icons=path.join(folder,'manifest.json')
  fs.writeFileSync(icons,JSON.stringify({schema:'mhp2g-monster-icons-v1',definitions:[{monsterId:1,path:iconPath,pngSha256:hash}],monsters:[{monsterId:1,iconMonsterId:1}]}))
  const snapshot={schema:'mhp2g-monster-evidence-v1',inputs:{icons:{sha256:sha256(icons)}},audit:[],monsters:[{
    monsterId:1,nameCn:'测试兽',nameJp:'テスト獣',nameEn:'Test Beast',aliases:['别名兽'],iconPath,
    weakness:[{partOrdinal:0,partNameCn:'未标注部位 1',conditionCn:'未标注状态 1',cut:1,impact:2,shot:3,fire:0,water:4,thunder:70,ice:60,dragon:5,stun:6}],
    ailments:[{statusId:0,nameCn:'测试异常',nameEn:'',toleranceInitial:null,toleranceIncrease:null,toleranceMax:null,duration:null,damage:null,applicable:null}],
    traps:[{trapId:0,nameCn:'测试陷阱',nameEn:'',isEffective:null,duration:null,durationEnraged:null,durationFatigued:null,noteJp:'未確認'}],
    quests:[{questKey:'wiki:synthetic:1',nameJp:'試験任務',fields:[{label:'体力',value:'123'}]}],
    drops:[{linkId:1,ordinal:0,kind:'capture',partCode:null,rankSlot:'high',itemId:2,quantity:null,probability:25,methodNameCn:'捕获'}],
  }]}
  const evidence=path.join(dir,'evidence.json'),save=()=>fs.writeFileSync(evidence,JSON.stringify(snapshot));save()
  return {base,icons,evidence,output:path.join(dir,'monsters'),snapshot,save}
}
