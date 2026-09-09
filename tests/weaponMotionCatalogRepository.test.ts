import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { WeaponMotionCatalogRepository } from '../api/catalog/weaponMotionRepository'

const databases:Database.Database[]=[]
function fixture(){const db=new Database(':memory:');databases.push(db);db.exec(`
CREATE TABLE catalog_weapon_types(game_id TEXT,type_id INTEGER,save_type INTEGER,name_cn TEXT,name_en TEXT,sort_order INTEGER,icon_key_prefix TEXT);
CREATE TABLE catalog_weapon_motions(game_id TEXT,motion_key TEXT,weapon_type_id INTEGER,native_action_id TEXT,name_cn TEXT,name_en TEXT,name_jp TEXT,category TEXT,result_kind TEXT,attack_type TEXT,sharpness_modifier REAL,exhaust INTEGER,stun INTEGER,hit_count_min INTEGER,hit_count_max INTEGER,motion_value_min REAL,motion_value_max REAL,motion_value_total REAL,notes TEXT,hunter_art_id INTEGER,source_order INTEGER,evidence_status TEXT);
CREATE TABLE catalog_weapon_motion_styles(game_id TEXT,motion_key TEXT,style_id TEXT);
CREATE TABLE catalog_weapon_motion_variants(game_id TEXT,motion_key TEXT,variant_id TEXT,label_cn TEXT,condition_cn TEXT,style_id TEXT,motion_value_total REAL);
CREATE TABLE catalog_weapon_motion_hits(game_id TEXT,motion_key TEXT,variant_id TEXT,sequence INTEGER,motion_value REAL,attack_type TEXT,sharpness_modifier REAL,exhaust INTEGER,stun INTEGER,is_damage INTEGER);
CREATE TABLE catalog_bowgun_motion_values(game_id TEXT,motion_key TEXT,projectile_kind TEXT,rapid_fire_modifier REAL,siege_modifier REAL,native_modifier_text TEXT);
CREATE TABLE catalog_bow_motion_values(game_id TEXT,motion_key TEXT,shot_type TEXT,charge_level INTEGER,charge_modifier REAL,coating_modifier REAL,distance_modifier TEXT);
INSERT INTO catalog_weapon_types VALUES('mhgu',1,7,'大剑','Great Sword',1,'Wpn_00'),('mhgu',12,17,'轻弩','Light Bowgun',12,'Wpn_12'),('mhgu',14,19,'弓','Bow',14,'Wpn_14');
INSERT INTO catalog_weapon_motions VALUES('mhgu','1:charge:base',1,'charge','蓄力斩','Charge Slash','溜め斬り','standard','melee','切断',1.1,5,0,1,1,48,100,100,'',NULL,1,'verified');
INSERT INTO catalog_weapon_motion_styles VALUES('mhgu','1:charge:base','guild'),('mhgu','1:charge:base','valor');
INSERT INTO catalog_weapon_motion_variants VALUES('mhgu','1:charge:base','lv3','三级蓄力','蓄力三级','guild',100);
INSERT INTO catalog_weapon_motion_hits VALUES('mhgu','1:charge:base','lv3',1,100,'切断',1.1,5,0,1);
`);return new WeaponMotionCatalogRepository(db)}
afterEach(()=>databases.splice(0).forEach(db=>db.close()))
describe('WeaponMotionCatalogRepository',()=>{
  it('returns discriminated melee data with styles, variants and hits',()=>{const result=fixture().searchWeaponMotions({gameId:'mhgu',weaponTypeId:1,styleIds:['valor']});expect(result.kind).toBe('melee');expect(result.motions[0]).toMatchObject({nameCn:'蓄力斩',styles:['guild','valor'],motionValueTotal:100});expect(result.motions[0].variants[0].hits[0].motionValue).toBe(100)})
  it('supports multilingual search and any-selected-style filtering',()=>{const repo=fixture();expect(repo.searchWeaponMotions({gameId:'mhgu',weaponTypeId:1,query:'Charge'}).motions).toHaveLength(1);expect(repo.searchWeaponMotions({gameId:'mhgu',weaponTypeId:1,styleIds:['aerial','valor']}).motions).toHaveLength(1);expect(repo.searchWeaponMotions({gameId:'mhgu',weaponTypeId:1,styleIds:['aerial']}).motions).toHaveLength(0)})
  it('returns fourteen hunter weapon facets without prowler when provided',()=>{const repo=fixture();expect(repo.getWeaponMotionFacets('mhgu').weaponTypes.every(type=>type.typeId<=14)).toBe(true);expect(repo.getWeaponMotionFacets('mhgu').styles).toHaveLength(6)})
})
