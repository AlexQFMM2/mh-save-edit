#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot=path.resolve(import.meta.dirname,'..')
const args=process.argv.slice(2),researchIndex=args.indexOf('--research-root')
const researchRoot=path.resolve(projectRoot,researchIndex>=0?args[researchIndex+1]:'../research')
const dbFile=path.join(researchRoot,'generated/mh-save-edit/catalog/data/mhgu.sqlite')
if(!fs.existsSync(dbFile))throw new Error(`缺少猎猫图鉴数据库：${dbFile}`)
const db=new Database(dbFile,{readonly:true,fileMustExist:true})
const scalar=sql=>Number(db.prepare(sql).pluck().get('mhgu'))
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex')
const tableOrder={catalog_palico_types:'type_id',catalog_palico_support_moves:'support_move_id',catalog_palico_type_support_moves:'type_id,support_move_id',catalog_palico_support_move_unlocks:'support_move_id,unlock_key',catalog_palico_skills:'palico_skill_id',catalog_palico_type_skills:'type_id,palico_skill_id',catalog_palico_skill_unlocks:'palico_skill_id,unlock_key',catalog_palico_weapons:'equipment_id',catalog_palico_weapon_materials:'equipment_id,row_id',catalog_palico_armors:'equipment_id',catalog_palico_armor_materials:'equipment_id,row_id',catalog_palico_sources:'source_key'}
const expected={types:8,support_moves:56,support_move_unlocks:56,skills:95,skill_unlocks:95,weapons:508,armors:1024,weapon_materials:1018,armor_materials:1769}
const counts=Object.fromEntries(Object.keys(expected).map(name=>[name,scalar(`SELECT count(*) FROM catalog_palico_${name} WHERE game_id=?`)]))
for(const[name,value]of Object.entries(expected))if(counts[name]!==value)throw new Error(`${name} 数量错误：${counts[name]}，预期 ${value}`)
const heads=scalar("SELECT count(*) FROM catalog_palico_armors WHERE game_id=? AND part='head'"),bodies=scalar("SELECT count(*) FROM catalog_palico_armors WHERE game_id=? AND part='body'")
if(heads!==501||bodies!==523)throw new Error(`猫防具部位数量错误：head=${heads}, body=${bodies}`)
const legacySetTables=Number(db.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('catalog_palico_armor_sets','catalog_palico_armor_set_members')").pluck().get())
if(legacySetTables)throw new Error('猫防具套装表仍然存在，产品数据应只保留武器与防具列表')
const generationGroups={
  supportMoves:Object.fromEntries(db.prepare("SELECT COALESCE(generation_group,'unassigned') value,count(*) count FROM catalog_palico_support_moves WHERE game_id=? GROUP BY generation_group ORDER BY value").all('mhgu').map(row=>[row.value,Number(row.count)])),
  skills:Object.fromEntries(db.prepare("SELECT COALESCE(generation_group,'unassigned') value,count(*) count FROM catalog_palico_skills WHERE game_id=? GROUP BY generation_group ORDER BY value").all('mhgu').map(row=>[row.value,Number(row.count)])),
}
const expectedGroups={supportMoves:{A:7,B:13,C:19,unassigned:17},skills:{A:7,B:13,C:16,unassigned:59}}
if(JSON.stringify(generationGroups)!==JSON.stringify(expectedGroups))throw new Error(`猎猫原生随机池分组错误：${JSON.stringify(generationGroups)}`)
const supportUnlockKinds=Object.fromEntries(db.prepare("SELECT unlock_kind,count(*) count FROM catalog_palico_support_move_unlocks WHERE game_id=? GROUP BY unlock_kind ORDER BY unlock_kind").all('mhgu').map(row=>[row.unlock_kind,Number(row.count)]))
const skillUnlockKinds=Object.fromEntries(db.prepare("SELECT unlock_kind,count(*) count FROM catalog_palico_skill_unlocks WHERE game_id=? GROUP BY unlock_kind ORDER BY unlock_kind").all('mhgu').map(row=>[row.unlock_kind,Number(row.count)]))
if(JSON.stringify(supportUnlockKinds)!==JSON.stringify({initial:4,innate:8,monster:44}))throw new Error(`支援行动解锁分类错误：${JSON.stringify(supportUnlockKinds)}`)
if(JSON.stringify(skillUnlockKinds)!==JSON.stringify({distribution:43,innate:4,level:48}))throw new Error(`随从技能解锁分类错误：${JSON.stringify(skillUnlockKinds)}`)
const nativeUnlockIds=db.prepare("SELECT native_unlock_id FROM catalog_palico_support_move_unlocks WHERE game_id=? AND unlock_kind='monster' ORDER BY native_unlock_id").pluck().all('mhgu').map(Number)
if(JSON.stringify(nativeUnlockIds)!==JSON.stringify(Array.from({length:44},(_,index)=>index+1)))throw new Error(`原生支援行动解锁索引未完整覆盖 1～44：${JSON.stringify(nativeUnlockIds)}`)
const incompleteUnlocks=Number(db.prepare(`SELECT
  (SELECT count(*) FROM catalog_palico_support_moves m WHERE m.game_id='mhgu' AND NOT EXISTS(SELECT 1 FROM catalog_palico_support_move_unlocks u WHERE u.game_id=m.game_id AND u.support_move_id=m.support_move_id))+
  (SELECT count(*) FROM catalog_palico_skills s WHERE s.game_id='mhgu' AND NOT EXISTS(SELECT 1 FROM catalog_palico_skill_unlocks u WHERE u.game_id=s.game_id AND u.palico_skill_id=s.palico_skill_id))+
  (SELECT count(*) FROM catalog_palico_support_moves WHERE game_id='mhgu' AND gauge_cost IS NULL)+
  (SELECT count(*) FROM catalog_palico_skills WHERE game_id='mhgu' AND (memory_cost IS NULL OR learn_level IS NULL)) count`).pluck().get())
if(incompleteUnlocks)throw new Error(`存在 ${incompleteUnlocks} 条猎猫能力资料或解锁关系未闭合`)
const badSharpness=db.prepare('SELECT equipment_id,sharpness_id FROM catalog_palico_weapons WHERE game_id=? AND sharpness_id NOT BETWEEN 2 AND 7').all('mhgu')
const missingIcons=scalar(`SELECT (SELECT count(*) FROM catalog_palico_weapons WHERE game_id=? AND icon_path IS NULL)+(SELECT count(*) FROM catalog_palico_armors WHERE game_id='mhgu' AND icon_path IS NULL)`)
const itemRelations=Object.fromEntries((db.prepare("SELECT usage_kind,count(*) count FROM catalog_item_relations WHERE game_id=? AND usage_kind IN ('palico-weapon','palico-armor') GROUP BY usage_kind ORDER BY usage_kind").all('mhgu')).map(row=>[row.usage_kind,Number(row.count)]))
const missingReverseRelations=Number(db.prepare(`SELECT
  (SELECT count(*) FROM catalog_palico_weapon_materials m WHERE m.game_id='mhgu' AND NOT EXISTS(
    SELECT 1 FROM catalog_palico_weapons w JOIN catalog_item_relations r ON r.game_id=w.game_id AND r.usage_kind='palico-weapon' AND r.target_id=w.dex_id AND r.item_save_id=m.item_save_id
    WHERE w.game_id=m.game_id AND w.equipment_id=m.equipment_id
  ))+
  (SELECT count(*) FROM catalog_palico_armor_materials m WHERE m.game_id='mhgu' AND NOT EXISTS(
    SELECT 1 FROM catalog_palico_armors a JOIN catalog_item_relations r ON r.game_id=a.game_id AND r.usage_kind='palico-armor' AND r.target_id=a.dex_id AND r.item_save_id=m.item_save_id
    WHERE a.game_id=m.game_id AND a.equipment_id=m.equipment_id
  )) count`).pluck().get())
const tableSha256=Object.fromEntries(Object.entries(tableOrder).map(([table,order])=>[table,sha256(JSON.stringify(db.prepare(`SELECT * FROM ${table} WHERE game_id='mhgu' ORDER BY ${order}`).all()))]))
const contentSha256=sha256(JSON.stringify(tableSha256))
const foreignKeys=db.pragma('foreign_key_check')
db.close()
if(badSharpness.length)throw new Error(`存在未知猫武器斩味：${JSON.stringify(badSharpness.slice(0,5))}`)
if(missingIcons)throw new Error(`存在 ${missingIcons} 条猫装备图标缺失`)
if(itemRelations['palico-weapon']!==expected.weapon_materials||itemRelations['palico-armor']!==expected.armor_materials)throw new Error(`道具反向猫装备关系数量错误：${JSON.stringify(itemRelations)}`)
if(missingReverseRelations)throw new Error(`存在 ${missingReverseRelations} 条制作材料缺少道具反向关系`)
if(foreignKeys.length)throw new Error(`外键检查失败：${JSON.stringify(foreignKeys.slice(0,5))}`)
console.log(JSON.stringify({format:'mh-save-edit-palico-audit-v3',counts,armorParts:{head:heads,body:bodies},generationGroups,unlocks:{supportMoves:supportUnlockKinds,skills:skillUnlockKinds,nativeSupportIds:'1-44',incomplete:incompleteUnlocks},itemRelations,missingReverseRelations,iconCoverage:'100%',sharpnessIds:[2,3,4,5,6,7],contentSha256,tableSha256,foreignKeys:'ok'},null,2))
