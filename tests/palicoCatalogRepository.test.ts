import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { PalicoCatalogRepository } from '../api/catalog/palicoRepository'

const databases: Database.Database[] = []

function fixture() {
  const db = new Database(':memory:')
  databases.push(db)
  db.exec(`
    CREATE TABLE catalog_palico_types(game_id TEXT,type_id INTEGER,type_key TEXT,name_cn TEXT,name_en TEXT,name_jp TEXT,description_cn TEXT,description_en TEXT,description_jp TEXT,source TEXT);
    CREATE TABLE catalog_palico_support_moves(game_id TEXT,support_move_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,description_cn TEXT,description_en TEXT,description_jp TEXT,generation_tier INTEGER,generation_group TEXT,role TEXT,teachable INTEGER,gauge_cost INTEGER,evidence_status TEXT,is_placeholder INTEGER,source TEXT);
    CREATE TABLE catalog_palico_type_support_moves(game_id TEXT,type_id INTEGER,support_move_id INTEGER,relation_kind TEXT,source TEXT);
    CREATE TABLE catalog_palico_support_move_unlocks(game_id TEXT,support_move_id INTEGER,unlock_key TEXT,native_unlock_id INTEGER,unlock_kind TEXT,unlock_level INTEGER,monster_id INTEGER,description_cn TEXT,description_en TEXT,evidence_status TEXT,source TEXT);
    CREATE TABLE catalog_palico_skills(game_id TEXT,palico_skill_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,description_cn TEXT,description_en TEXT,description_jp TEXT,generation_tier INTEGER,generation_group TEXT,role TEXT,teachable INTEGER,memory_cost INTEGER,learn_level INTEGER,evidence_status TEXT,is_placeholder INTEGER,source TEXT);
    CREATE TABLE catalog_palico_type_skills(game_id TEXT,type_id INTEGER,palico_skill_id INTEGER,relation_kind TEXT,source TEXT);
    CREATE TABLE catalog_palico_skill_unlocks(game_id TEXT,palico_skill_id INTEGER,unlock_key TEXT,native_unlock_id INTEGER,unlock_kind TEXT,unlock_level INTEGER,monster_id INTEGER,description_cn TEXT,description_en TEXT,evidence_status TEXT,source TEXT);
    CREATE TABLE catalog_palico_weapons(game_id TEXT,equipment_id INTEGER,dex_id INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,description_cn TEXT,description_en TEXT,description_jp TEXT,rarity INTEGER,attack_type TEXT,specialization_id INTEGER,specialization_cn TEXT,specialization_en TEXT,melee_attack INTEGER,melee_affinity INTEGER,ranged INTEGER,ranged_affinity INTEGER,special_attack_id INTEGER,special_attack_cn TEXT,special_attack_en TEXT,special_attack_value INTEGER,defense INTEGER,sharpness_id INTEGER,price INTEGER,icon_path TEXT,source TEXT);
    CREATE TABLE catalog_palico_weapon_materials(game_id TEXT,equipment_id INTEGER,row_id INTEGER,item_save_id INTEGER,quantity INTEGER,source TEXT);
    CREATE TABLE catalog_palico_armors(game_id TEXT,equipment_id INTEGER,dex_id INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,description_cn TEXT,description_en TEXT,description_jp TEXT,part TEXT,rarity INTEGER,defense INTEGER,fire_res INTEGER,water_res INTEGER,thunder_res INTEGER,ice_res INTEGER,dragon_res INTEGER,price INTEGER,image_key TEXT,icon_path TEXT,source TEXT);
    CREATE TABLE catalog_palico_armor_materials(game_id TEXT,equipment_id INTEGER,row_id INTEGER,item_save_id INTEGER,quantity INTEGER,source TEXT);
    CREATE TABLE catalog_items(game_id TEXT,save_id INTEGER,name_cn TEXT,name_en TEXT);
    CREATE TABLE catalog_monsters(game_id TEXT,monster_id INTEGER,name_cn TEXT);

    INSERT INTO catalog_palico_types VALUES('mhgu',0,'charisma','领袖','Charisma','カリスマ','说明','Description','説明','native');
    INSERT INTO catalog_palico_support_moves VALUES('mhgu',16,'设置型爆弹','Anti-Monster Mine','設置型爆弾','说明','Description','説明',2,'B','generated',1,2,'verified',0,'native');
    INSERT INTO catalog_palico_type_support_moves VALUES('mhgu',0,16,'innate','native');
    INSERT INTO catalog_monsters VALUES('mhgu',20,'迅龙');
    INSERT INTO catalog_palico_support_move_unlocks VALUES('mhgu',16,'monster:20',16,'monster',NULL,20,'狩猎迅龙','Hunt Nargacuga','verified','native');
    INSERT INTO catalog_palico_skills VALUES('mhgu',87,'弱点特效之术','Weakness Exploit','弱点特効の術','说明','Description','説明',0,NULL,'special',1,4,35,'wiki_only',0,'wiki');
    INSERT INTO catalog_palico_type_skills VALUES('mhgu',0,87,'innate','native');
    INSERT INTO catalog_palico_skill_unlocks VALUES('mhgu',87,'distribution',NULL,'distribution',NULL,NULL,'配信随从携带','Distributed Palico','wiki_only','wiki');

    INSERT INTO catalog_palico_weapons VALUES
      ('mhgu',16,16,16,'迅猫剑','Narga F Sword','ナルガネコ手裏剣','中','EN','JP',7,'cut',2,'近战特化','Melee',180,20,150,10,1,'毒','Poison',18,5,5,1200,'/weapon.png','dex'),
      ('mhgu',17,17,17,'轰猫锤','Tigrex F Hammer','ティガネコ轟槌','中','EN','JP',8,'blunt',3,'平衡','Balanced',210,-10,190,-5,NULL,NULL,NULL,NULL,0,6,1400,'/hammer.png','dex');
    INSERT INTO catalog_items VALUES('mhgu',300,'迅龙素材','Nargacuga Material');
    INSERT INTO catalog_palico_weapon_materials VALUES('mhgu',16,1,300,2,'dex');

    INSERT INTO catalog_palico_armors VALUES
      ('mhgu',100,100,100,'迅猫头盔','Narga F Helm','ナルガネコヘルム','中','EN','JP','head',7,60,1,0,-2,1,0,800,'narga','/head.png','dex'),
      ('mhgu',101,101,101,'迅猫铠甲','Narga F Mail','ナルガネコメイル','中','EN','JP','body',7,90,2,0,-3,2,0,1000,'narga','/body.png','dex'),
      ('mhgu',102,102,102,'孤猫头盔','Solo Helm','ソロネコヘルム','中','EN','JP','head',2,20,0,0,0,0,0,100,'solo','/solo.png','dex');
  `)
  return new PalicoCatalogRepository(db)
}

afterEach(() => databases.splice(0).forEach((db) => db.close()))

describe('PalicoCatalogRepository', () => {
  it('searches localized names and hexadecimal IDs', () => {
    const repo = fixture()
    expect(repo.searchSupportMoves({ gameId: 'mhgu', query: 'Anti-Monster' })[0]?.supportMoveId).toBe(16)
    expect(repo.searchSupportMoves({ gameId: 'mhgu', query: '設置型' })[0]?.supportMoveId).toBe(16)
    expect(repo.searchSupportMoves({ gameId: 'mhgu', query: '0x10' })[0]?.supportMoveId).toBe(16)
    expect(repo.searchWeapons({ gameId: 'mhgu', query: 'ナルガ', pageSize: 100 }).items[0]?.equipmentId).toBe(16)
  })

  it('sorts weapons by combat values and filters armor parts', () => {
    const repo = fixture()
    expect(repo.searchWeapons({ gameId: 'mhgu', sort: 'meleeAttack', direction: 'desc' }).items.map((item) => item.equipmentId)).toEqual([17, 16])
    expect(repo.searchWeapons({ gameId: 'mhgu', sort: 'sharpness', direction: 'desc' }).items[0]?.sharpnessId).toBe(6)
    expect(repo.searchArmors({ gameId: 'mhgu', part: 'body' }).items.map((item) => item.equipmentId)).toEqual([101])
  })

  it('filters native random groups separately from fixed and special entries', () => {
    const repo = fixture()
    expect(repo.searchSupportMoves({ gameId: 'mhgu', generationGroup: 'B' }).map((item) => item.supportMoveId)).toEqual([16])
    expect(repo.searchSkills({ gameId: 'mhgu', generationGroup: 'fixed' }).map((item) => item.palicoSkillId)).toEqual([87])
    expect(repo.searchSkills({ gameId: 'mhgu', generationGroup: 'A' })).toEqual([])
  })

  it('returns materials, unlock relations, and complete facets', () => {
    const repo = fixture()
    expect(repo.getWeapon(16)?.materials).toEqual([{ gameId: 'mhgu', saveId: 300, nameCn: '迅龙素材', nameEn: 'Nargacuga Material', quantity: 2 }])
    expect(repo.getSupportMove(16)?.unlocks[0]).toMatchObject({ nativeUnlockId: 16, kind: 'monster', monsterId: 20, monsterNameCn: '迅龙' })
    expect(repo.getSkill(87)?.unlocks[0]).toMatchObject({ kind: 'distribution', evidenceStatus: 'wiki_only' })
    expect(repo.searchSkills({ gameId: 'mhgu', unlockKind: 'distribution' }).map((item) => item.palicoSkillId)).toEqual([87])
    expect(repo.getFacets()).toMatchObject({ generationGroups: ['B'], unlockKinds: ['distribution'], rarities: [2, 7, 8], sharpnessIds: [5, 6] })
  })
})
