#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const projectRoot=path.resolve(import.meta.dirname,'..')
const args=process.argv.slice(2);const at=args.indexOf('--research-root');const researchRoot=path.resolve(projectRoot,at>=0?args[at+1]:'../research')
const file=path.join(researchRoot,'generated/mh-save-edit/catalog/data/mhgu.sqlite')
if(!fs.existsSync(file))throw new Error(`Missing private catalog database: ${file}`)
const db=new Database(file,{readonly:true})
const counts=db.prepare("SELECT weapon_type_id,count(*) count FROM catalog_weapon_motions WHERE game_id='mhgu' GROUP BY weapon_type_id ORDER BY weapon_type_id").all()
if(counts.length!==14||counts.some(row=>row.weapon_type_id<1||row.weapon_type_id>14||row.count<1))throw new Error(`Expected all 14 hunter weapon types: ${JSON.stringify(counts)}`)
const prowler=db.prepare("SELECT count(*) count FROM catalog_weapon_motions WHERE weapon_type_id NOT BETWEEN 1 AND 14").get().count
const invalid=db.prepare("SELECT count(*) count FROM catalog_weapon_motions WHERE name_en='' OR (motion_value_total IS NULL AND notes='')").get().count
const orphanHits=db.prepare('SELECT count(*) count FROM catalog_weapon_motion_hits h LEFT JOIN catalog_weapon_motions m ON m.game_id=h.game_id AND m.motion_key=h.motion_key WHERE m.motion_key IS NULL').get().count
const orphanHunterArts=db.prepare("SELECT count(*) count FROM catalog_weapon_motions WHERE game_id='mhgu' AND category='hunterArt' AND hunter_art_id IS NULL").get().count
const parameterCoverage=db.prepare("SELECT count(*) total,sum(attack_type IS NOT NULL) attackType,sum(sharpness_modifier IS NOT NULL) sharpness,sum(exhaust IS NOT NULL) exhaust,sum(stun IS NOT NULL) stun,sum(name_cn<>name_en) localizedCn,sum(name_jp<>name_en) localizedJp FROM catalog_weapon_motions WHERE game_id='mhgu'").get()
const greatSword=[48,65,80,100].every(value=>db.prepare("SELECT 1 FROM catalog_weapon_motion_hits h JOIN catalog_weapon_motions m ON m.game_id=h.game_id AND m.motion_key=h.motion_key WHERE m.weapon_type_id=1 AND h.motion_value=?").get(value))
if(prowler||invalid||orphanHits||orphanHunterArts||!greatSword)throw new Error(`Weapon motion audit failed: ${JSON.stringify({prowler,invalid,orphanHits,orphanHunterArts,greatSword})}`)
db.close()
console.log(JSON.stringify({format:'mh-save-edit-weapon-motion-audit-v1',weaponTypes:counts,prowler,invalid,orphanHits,orphanHunterArts,greatSword,parameterCoverage,nativeParameterCrosswalkComplete:parameterCoverage.attackType===parameterCoverage.total&&parameterCoverage.sharpness===parameterCoverage.total&&parameterCoverage.exhaust===parameterCoverage.total&&parameterCoverage.stun===parameterCoverage.total},null,2))
