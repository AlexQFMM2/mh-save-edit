import Database from 'better-sqlite3'

// Synthetic identities and values only; no runtime database or save is required.
export function createRelicSaveCatalog(path: string) {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE catalog_weapon_types(game_id TEXT,type_id INTEGER,save_type INTEGER,name_cn TEXT,sort_order INTEGER);
    CREATE TABLE catalog_weapons(game_id TEXT,weapon_key TEXT,save_type INTEGER,save_id INTEGER,save_level INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,icon_path TEXT,type_id INTEGER,is_placeholder INTEGER);
    CREATE TABLE catalog_armor_save_identities(game_id TEXT,armor_dex_id INTEGER,save_type INTEGER,save_id INTEGER);
    CREATE TABLE catalog_armors(game_id TEXT,dex_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,icon_path TEXT,part TEXT,part_order INTEGER,is_placeholder INTEGER);
    CREATE TABLE catalog_armor_skills(game_id TEXT,armor_dex_id INTEGER,skill_id INTEGER);
    CREATE TABLE catalog_decorations(game_id TEXT,save_id INTEGER,name_cn TEXT,slots INTEGER);
    CREATE TABLE catalog_skills(game_id TEXT,skill_id INTEGER,name_cn TEXT);
    CREATE TABLE charm_classes(save_id INTEGER,name_cn TEXT,name_en TEXT);
    CREATE TABLE catalog_loadout_relic_weapon_templates(game_id TEXT,template_key TEXT,save_type INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,type_id INTEGER,type_name_cn TEXT,rarity INTEGER,slots INTEGER,attack REAL,affinity REAL,defense REAL,record_hex TEXT,source TEXT);
    CREATE TABLE catalog_loadout_relic_armor_templates(game_id TEXT,template_key TEXT,save_type INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,part TEXT,rarity INTEGER,slots INTEGER,record_hex TEXT,source TEXT);
    CREATE TABLE catalog_loadout_relic_value_lookups(game_id TEXT,lookup_kind TEXT,lookup_key TEXT,payload_json TEXT,source TEXT);
    INSERT INTO catalog_weapon_types VALUES('mh4g',10,20,'盾斧',10),('mh4g',1,7,'大剑',1);
    INSERT INTO catalog_weapons VALUES('mh4g','synthetic:normal',7,10129,0,'合成普通武器','Synthetic Normal','',NULL,1,0);
    INSERT INTO catalog_decorations VALUES('mh4g',1,'合成固定珠',1);
  `)
  const insert = db.prepare('INSERT INTO catalog_loadout_relic_weapon_templates VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  for (let id = 10000; id <= 10129; id++) {
    const record = Buffer.alloc(28); record[0] = 20; record.writeUInt16LE(id, 2)
    insert.run('mh4g', `w:20:${id}`, 20, id, '合成同名发掘武器', 'Synthetic Relic', 10, '盾斧', 1, 0, 0, 0, 0, record.toString('hex'), 'synthetic')
  }
  const armor = Buffer.alloc(28); armor[0] = 5; armor.writeUInt16LE(10129, 2)
  db.prepare('INSERT INTO catalog_loadout_relic_armor_templates VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('mh4g', 'a:5:10129', 5, 10129, '合成发掘头盔', 'Synthetic Helm', 'head', 1, 0, armor.toString('hex'), 'synthetic')
  const lookups: [string, string, number, string][] = [
    ['attack_tier', 'melee', 20, '321|0|DEF0'], ['attack_tier', 'melee', 21, '345|0|DEF0'],
    ['attribute_type', 'relic', 4, 'Dragon'], ['attribute_value', 'medium', 3, '120'], ['attribute_value', 'medium', 4, '160'],
    ['sharpness', 'melee', 21, '21'], ['upgrade', 'weapon', 3, '3'], ['weapon_special', 'relic_phial', 1, 'Impact'],
    ['slots', 'all', 3, '3'], ['rarity', 'relic', 9, '9'], ['polish_requirement', 'all', 4, '4'], ['honing', 'weapon', 192, 'Life'],
  ]
  const addLookup = db.prepare('INSERT INTO catalog_loadout_relic_value_lookups VALUES(?,?,?,?,?)')
  for (const [domain, variant, code, name] of lookups) addLookup.run('mh4g', 'equipment_lookup', `${domain}:${code}`, JSON.stringify({ domain, variant, code, save_type: 20, name_cn: name, name_en: name }), 'synthetic')
  return db
}

export function syntheticRelicRecord() {
  const record = Buffer.alloc(28)
  record[0] = 20; record.writeUInt16LE(10129, 2)
  record[4] = 3; record[5] = 4; record.writeUInt16LE(0x8001, 6)
  record[12] = 21; record[13] = 20; record[14] = 3; record[15] = 1
  record[16] = 0xac; record[17] = 9; record[18] = 4; record[19] = 192
  record.set([0xa5, 0x5a, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66], 20)
  return record
}
