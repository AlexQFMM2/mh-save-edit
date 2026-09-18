import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectArmorSkillIds, migrateArmorSkillIds } from '../tools/runtime/armorSkillMigration.mjs'

const databases = []
function fixture() {
  const db = new Database(':memory:'); databases.push(db)
  db.exec(`CREATE TABLE catalog_skills(game_id TEXT,skill_id INTEGER,dex_id INTEGER,name_cn TEXT,name_en TEXT);
    CREATE TABLE catalog_armor_skills(game_id TEXT,armor_dex_id INTEGER,skill_id INTEGER,name_cn TEXT,name_en TEXT,points INTEGER,active_skill_name_cn TEXT,active_skill_name_en TEXT,source TEXT,PRIMARY KEY(game_id,armor_dex_id,skill_id));
    INSERT INTO catalog_skills VALUES ('mhgu',10,11,'测试技能A','Test A'),('mhgu',11,12,'测试技能B','Test B'),('mhgu',12,13,'测试技能C','Test C');
    INSERT INTO catalog_armor_skills VALUES ('mhgu',1,11,'测试技能A','Test A',4,NULL,NULL,'synthetic-dex'),('mhgu',1,12,'测试技能B','Test B',-2,NULL,NULL,'synthetic-dex');`)
  return db
}
afterEach(() => databases.splice(0).forEach(db => db.close()))
describe('runtime armor crosswalk migration', () => {
  it('translates a recognized old domain atomically, preserving points and provenance', () => {
    const db = fixture()
    expect(migrateArmorSkillIds(db)).toMatchObject({ migrated: true, corrected: 2 })
    expect(db.prepare('SELECT skill_id,points,source FROM catalog_armor_skills ORDER BY skill_id').all()).toEqual([{ skill_id: 10, points: 4, source: 'synthetic-dex' }, { skill_id: 11, points: -2, source: 'synthetic-dex' }])
    const metadata = db.prepare('SELECT * FROM catalog_build_metadata').all()
    expect(migrateArmorSkillIds(db)).toMatchObject({ migrated: false, corrected: 0 })
    expect(db.prepare('SELECT * FROM catalog_build_metadata').all()).toEqual(metadata)
  })
  it('rejects mixed native and Dex rows before changing any data', () => {
    const db = fixture(); db.prepare('UPDATE catalog_armor_skills SET skill_id=10 WHERE skill_id=11').run()
    const before = db.prepare('SELECT * FROM catalog_armor_skills').all()
    expect(() => migrateArmorSkillIds(db)).toThrow(/mixed/)
    expect(db.prepare('SELECT * FROM catalog_armor_skills').all()).toEqual(before)
  })
  it('rejects a missing crosswalk without using a numeric offset', () => {
    const db = fixture(); db.prepare('UPDATE catalog_skills SET dex_id=50 WHERE skill_id=10').run()
    expect(() => migrateArmorSkillIds(db)).toThrow(/unrecognized/)
  })
  it('rejects duplicate crosswalk identities', () => {
    const db = fixture(); db.exec("UPDATE catalog_skills SET dex_id=11 WHERE skill_id=12")
    expect(() => inspectArmorSkillIds(db, 'mhgu')).toThrow(/duplicate/)
  })
  it('changes dataVersion material when skill contributions change', () => {
    const db = fixture(); migrateArmorSkillIds(db)
    const before = db.prepare('SELECT source_sha256 FROM catalog_build_metadata').pluck().get()
    db.exec('UPDATE catalog_armor_skills SET points=5 WHERE skill_id=10')
    migrateArmorSkillIds(db)
    expect(db.prepare('SELECT source_sha256 FROM catalog_build_metadata').pluck().get()).not.toBe(before)
  })
})
