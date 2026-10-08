import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectMh4gArmorIdentities, repairMh4gArmorIdentities, auditMh4gArmorIdentities } from '../tools/runtime/mh4gArmorIdentities.mjs'

const databases = []
const stats = 'rarity INTEGER,slots INTEGER,base_defense INTEGER,fire_res INTEGER,water_res INTEGER,thunder_res INTEGER,ice_res INTEGER,dragon_res INTEGER'
function fixture() {
  const db = new Database(':memory:'); databases.push(db)
  db.exec(`CREATE TABLE catalog_armors(game_id TEXT,dex_id INTEGER,name_cn TEXT,name_en TEXT,part TEXT,gender TEXT,combat TEXT,is_placeholder INTEGER,mapping_status TEXT,${stats});
    CREATE TABLE catalog_armor_skills(game_id TEXT,armor_dex_id INTEGER,skill_id INTEGER,points INTEGER);
    CREATE TABLE armors(save_type INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,model_flags INTEGER,special_flags INTEGER,is_relic INTEGER,raw_hex TEXT,source TEXT,${stats});
    CREATE TABLE armor_skill_points(save_type INTEGER,save_id INTEGER,skill_tree_id INTEGER,points INTEGER);
    CREATE TABLE catalog_armor_save_identities(game_id TEXT,armor_dex_id INTEGER,save_type INTEGER,save_id INTEGER,mapping_status TEXT,source TEXT);
    CREATE TABLE sources(name TEXT,sha256 TEXT);
    INSERT INTO catalog_armors VALUES('mh4g',1,'Dex译名','Synthetic helm','head','both','blademaster',0,'dex_only',2,3,10,1,2,3,4,5);
    INSERT INTO catalog_armor_skills VALUES('mh4g',1,11,4),('mh4g',1,12,-2);`)
  addNative(db, 101)
  return db
}
function addNative(db, id, { cn = '原生异译', en = 'Synthetic helm', flags = 7, points = 4, fire = 1 } = {}) {
  const raw = Buffer.alloc(40)
  raw[4] = flags; raw[5] = 1; raw[7] = 10; raw[17] = 3
  for (const [offset, value] of [[12, fire], [13, 2], [14, 3], [16, 4], [15, 5], [30, 11], [31, points], [32, 12], [33, -2]]) raw.writeInt8(value, offset)
  db.prepare("INSERT INTO armors VALUES(5,?,?,?,?,0,0,?,'synthetic-native',2,3,10,?,2,3,4,5)").run(id, cn, en, flags, raw.toString('hex'), fire)
  db.prepare('INSERT INTO armor_skill_points VALUES(5,?,11,?),(5,?,12,-2)').run(id, points, id)
}
afterEach(() => databases.splice(0).forEach(db => db.close()))

describe('MH4G native armor save crosswalk', () => {
  it('repairs translations and stale identities, preserves Dex labels and is idempotent', () => {
    const db = fixture()
    db.exec("INSERT INTO catalog_armor_save_identities VALUES('mh4g',1,5,999,'old-name-fallback','old')")
    expect(repairMh4gArmorIdentities(db)).toMatchObject({ mapped: 1, identities: 1, changed: true })
    expect(db.prepare('SELECT save_id,gender FROM catalog_armor_save_identities').get()).toEqual({ save_id: 101, gender: 'both' })
    expect(db.prepare('SELECT name_cn FROM catalog_armors').pluck().get()).toBe('Dex译名')
    const version = db.prepare('SELECT * FROM catalog_build_metadata').all()
    expect(repairMh4gArmorIdentities(db).changed).toBe(false)
    expect(db.prepare('SELECT * FROM catalog_build_metadata').all()).toEqual(version)
    expect(auditMh4gArmorIdentities(db).unresolved).toBe(0)
  })
  it('uses full native stats and signed skills even when Chinese labels are equal', () => {
    const db = fixture()
    addNative(db, 102, { cn: 'Dex译名', points: -4 })
    addNative(db, 103, { cn: 'Dex译名', fire: -1 })
    expect(inspectMh4gArmorIdentities(db).identities.map(row => row.save_id)).toEqual([101])
  })
  it('accepts a unique full native fingerprint without an English-name join', () => {
    const db = fixture(); db.exec("UPDATE armors SET name_en='legacy regional label'")
    expect(repairMh4gArmorIdentities(db).mapped).toBe(1)
  })
  it('keeps regional replacements out even when their names and values coincide', () => {
    const db = fixture(); db.exec("UPDATE catalog_armors SET name_cn='【美】测试头盔'")
    expect(repairMh4gArmorIdentities(db)).toMatchObject({ foreign: 1, mapped: 0, identities: 0 })
    expect(db.prepare('SELECT mapping_status FROM catalog_armors').pluck().get()).toBe('foreign_variant')
  })
  it('keeps both gender records with explicit restrictions instead of taking the first', () => {
    const db = fixture(); db.exec('DELETE FROM armors; DELETE FROM armor_skill_points')
    addNative(db, 101, { en: 'untranslated male', flags: 5 })
    addNative(db, 102, { en: 'untranslated female', flags: 6 })
    expect(repairMh4gArmorIdentities(db)).toMatchObject({ mapped: 1, identities: 2 })
    expect(db.prepare('SELECT save_id,gender FROM catalog_armor_save_identities ORDER BY save_id').all()).toEqual([{ save_id: 101, gender: 'male' }, { save_id: 102, gender: 'female' }])
  })
  it('rejects ambiguous candidates atomically without assigning the first record', () => {
    const db = fixture(); addNative(db, 102)
    expect(() => repairMh4gArmorIdentities(db)).toThrow(/unresolved/)
    expect(db.prepare('SELECT count(*) FROM catalog_armor_save_identities').pluck().get()).toBe(0)
    expect(db.prepare('PRAGMA table_info(catalog_armor_save_identities)').all().some(row => row.name === 'gender')).toBe(false)
  })
  it('rejects collisions between distinct Dex entries', () => {
    const db = fixture()
    db.exec("INSERT INTO catalog_armors SELECT game_id,2,name_cn,name_en,part,gender,combat,is_placeholder,mapping_status,rarity,slots,base_defense,fire_res,water_res,thunder_res,ice_res,dragon_res FROM catalog_armors; INSERT INTO catalog_armor_skills SELECT game_id,2,skill_id,points FROM catalog_armor_skills;")
    expect(() => repairMh4gArmorIdentities(db)).toThrow(/duplicate native identity/)
  })
  it('refuses native columns that disagree with original bytes', () => {
    const db = fixture(); db.exec('UPDATE armors SET base_defense=99')
    expect(() => repairMh4gArmorIdentities(db)).toThrow(/native bytes/)
  })
  it('rejects gender mismatches and unaudited model flags', () => {
    const db = fixture(); db.exec("UPDATE catalog_armors SET gender='female'")
    expect(() => repairMh4gArmorIdentities(db)).toThrow(/gender-mismatch/)
    db.exec('DELETE FROM armors; DELETE FROM armor_skill_points'); addNative(db, 101, { flags: 2 })
    expect(() => repairMh4gArmorIdentities(db)).toThrow(/gender-mismatch/)
  })
  it('detects missing or altered mappings and changes version material when corrected', () => {
    const db = fixture(); repairMh4gArmorIdentities(db)
    const before = db.prepare('SELECT source_sha256 FROM catalog_build_metadata').pluck().get()
    db.exec('DELETE FROM catalog_armor_save_identities')
    expect(() => auditMh4gArmorIdentities(db)).toThrow(/stale/)
    repairMh4gArmorIdentities(db)
    db.exec('UPDATE armors SET save_id=102; UPDATE armor_skill_points SET save_id=102')
    repairMh4gArmorIdentities(db)
    expect(db.prepare('SELECT source_sha256 FROM catalog_build_metadata').pluck().get()).not.toBe(before)
  })
})
