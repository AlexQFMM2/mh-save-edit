import { readFileSync } from 'node:fs'
import { p3ArmorFixture } from './p3ArmorCatalog'
import type { P3WeaponDetail, P3WeaponSpecial, P3WeaponType } from '../../api/catalog/p3WeaponTypes'

/** All names, values, routes and special parameters are synthetic. */
export const p3WeaponTypes: P3WeaponType[] = [
  [5,1,'standardMelee'],[12,2,'standardMelee'],[6,3,'standardMelee'],[16,4,'standardMelee'],[7,5,'standardMelee'],[17,6,'huntingHorn'],[8,7,'standardMelee'],[14,8,'gunlance'],[13,9,'switchAxe'],[11,12,'bowgun'],[9,13,'bowgun'],[15,14,'bow'],
].map(([nativeType,typeId,kind],sortOrder)=>({nativeType:Number(nativeType),typeId:Number(typeId),kind:kind as P3WeaponType['kind'],nameCn:`合成类型${typeId}`,nameEn:`Type ${typeId}`,sortOrder}))
function special(type: P3WeaponType): P3WeaponSpecial {
  const source='synthetic'
  switch(type.kind) {
    case 'switchAxe': return {kind:type.kind,phialName:'测试瓶',phialValue:12,swordAttributeValue:null,source}
    case 'gunlance': return {kind:type.kind,shellingType:'通常型',level:2,source}
    case 'huntingHorn': return {kind:type.kind,notes:['白','赤','青'],songs:[{songKey:'test-song',notes:['白','白'],effectCn:'合成效果',repeatEffectCn:'合成重奏',notesCn:'合成说明',duration:{seconds:30,maestroSeconds:40,mode:'replace'},repeatDuration:{seconds:10,maestroSeconds:15,mode:'extend'},source}],source}
    case 'bow': return {kind:type.kind,arcType:'合成曲射',charges:[{level:1,typeCode:'连射',shotLevel:1,available:true,requiresLoadUp:false},{level:2,typeCode:null,shotLevel:null,available:false,requiresLoadUp:false},{level:3,typeCode:'扩散',shotLevel:2,available:false,requiresLoadUp:true},{level:4,typeCode:null,shotLevel:null,available:false,requiresLoadUp:false}],coatings:[{itemId:20,available:true,enhanced:true},{itemId:30,available:false,enhanced:false}],source}
    case 'bowgun': return {kind:type.kind,weaponKind:type.nativeType===11?'light':'heavy',reload:'普通',recoil:'中',deviation:'无',ammo:[{itemId:94,available:true,requiresSkill:false,capacity:4,skillCapacity:null},{itemId:20,available:false,requiresSkill:true,capacity:null,skillCapacity:2},{itemId:30,available:false,requiresSkill:false,capacity:null,skillCapacity:null}],rapidFire:type.nativeType===11?[{itemId:94,shots:3,recoil:'小',multiplierText:'0.5'}]:[],crouchFire:type.nativeType===9?[{itemId:94,capacity:20}]:[],attachments:[{kind:'barrel',name:'合成枪管',cost:30,baseAttack:110,boostedAttack:125,effect:'合成攻击提升'}],source}
    default: return {kind:'standardMelee',source}
  }
}
export function p3WeaponFixture(file=':memory:') {
  const db=p3ArmorFixture(file)
  db.exec(readFileSync('tools/mhp3/weapon_schema.sql','utf8'))
  db.exec("INSERT INTO meta VALUES('weapon_schema','mhp3-weapons-v1'),('weapon_data_version','synthetic-v1')")
  for(const t of p3WeaponTypes) db.prepare('INSERT INTO p3_weapon_types VALUES(?,?,?)').run(t.nativeType,t.typeId,JSON.stringify(t))
  for(const [t,id,status] of [...p3WeaponTypes.map(t=>[t,1,'obtainable'] as const),[p3WeaponTypes[0],2,'obtainable'] as const,[p3WeaponTypes[0],3,'special'] as const,[p3WeaponTypes[0],4,'unknown'] as const]) {
    const w:Omit<P3WeaponDetail,'parents'|'children'|'recipes'>={gameId:'mhp3',weaponKey:`mhp3:weapon:${t.nativeType}:${id}`,nativeType:t.nativeType,nativeId:id,typeId:t.typeId,typeNameCn:t.nameCn,typeNameEn:t.nameEn,kind:t.kind,nameCn:id===2?'合成同名武器':'合成武器',nameJp:`テスト${t.nativeType}_${id}`,nameEn:'',rarity:2,slots:1,affinity:-15,defense:4,displayAttack:100+id,trueRawAttack:100+id,attributes:[],sharpness:t.kind==='bow'||t.kind==='bowgun'?null:{base:[30,40,50,30,0,0,0],handicraft:[30,40,50,60,20,0,0]},iconPath:'',isDirectlyProducible:id===1,isFinalForm:id!==1,acquisitionStatus:status,nameSource:'synthetic',aliases:['合成别名'],acquisition:'合成取得证据',acquisitionSource:'synthetic',nativeRowSha256:'a'.repeat(64),boost:{attack:115+id,cost:1000,material:{itemId:10,quantity:2}},fieldSources:{core:'synthetic'},special:special(t)}
    db.prepare('INSERT INTO p3_weapons VALUES(?,?,?,?)').run(w.weaponKey,t.nativeType,id,JSON.stringify(w))
    db.prepare('INSERT INTO p3_weapon_item_links VALUES(?,?,?,?)').run(w.weaponKey,10,'boost',0)
    if(t.kind==='bowgun') db.prepare('INSERT INTO p3_weapon_item_links VALUES(?,?,?,?),(?,?,?,?)').run(w.weaponKey,94,'ammo',0,w.weaponKey,20,'ammo',1)
    if(t.kind==='bow') db.prepare('INSERT INTO p3_weapon_item_links VALUES(?,?,?,?)').run(w.weaponKey,20,'coating',0)
  }
  for(const [i,kind,cost,item] of [[0,'production',150,10],[1,'production',150,20],[2,'appraisal',null,30],[3,'upgrade',100,20]] as const) {
    db.prepare('INSERT INTO p3_weapon_recipes VALUES(?,?,?,?,?)').run(`test:${i}`,i===3?'mhp3:weapon:5:2':'mhp3:weapon:5:1',kind,cost,'synthetic')
    db.prepare('INSERT INTO p3_weapon_materials VALUES(?,?,?,?,?)').run(`test:${i}`,'material',0,item,kind==='appraisal'?null:2)
    if(i===0)db.prepare('INSERT INTO p3_weapon_materials VALUES(?,?,?,?,?)').run(`test:${i}`,'byproduct',0,30,1)
  }
  db.exec("INSERT INTO p3_weapon_edges VALUES('mhp3:weapon:5:1','mhp3:weapon:5:2',0),('mhp3:weapon:5:2','mhp3:weapon:5:1',0),('mhp3:weapon:5:2','mhp3:weapon:12:1',1)")
  return db
}
