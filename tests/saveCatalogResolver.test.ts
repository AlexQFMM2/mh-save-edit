import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SaveCatalogResolver } from '../api/save/catalogResolver'
import { saveArmorAppearanceSchema } from '../api/save/schemas'

const directories: string[] = []
afterEach(() => { for (const value of directories.splice(0)) rmSync(value, { recursive: true, force: true }) })

describe('SaveCatalogResolver', () => {
  it('pages native-only appearances by stable ID and preserves duplicate names', () => {
    const directory = mkdtempSync(join(tmpdir(), 'native-appearance-')); directories.push(directory)
    const db = new Database(join(directory, 'mhgu.sqlite'))
    db.exec("CREATE TABLE cn__armor_head(id INTEGER,name TEXT,english TEXT,rarity INTEGER); INSERT INTO cn__armor_head VALUES(0,'none','none',0),(7,'同名外观','same',1),(8,'同名外观','same',1),(107,'原生专用','native-only',1),(116,'其他','other',1)")
    db.close()
    const resolver = new SaveCatalogResolver(directory)
    try {
      const first = resolver.searchArmorAppearances({ gameId: 'mhgu', saveType: 1, pageSize: 2 })
      expect(first).toMatchObject({ total: 4, page: 1, hasNext: true })
      expect(first.items.map(item => item.appearanceId)).toEqual([7, 8])
      expect(first.items.map(item => item.nameCn)).toEqual(['同名外观', '同名外观'])
      const second = resolver.searchArmorAppearances({ gameId: 'mhgu', saveType: 1, page: 2, pageSize: 2 })
      expect(second.hasNext).toBe(false); expect(second.items.map(item => item.appearanceId)).toEqual([107, 116])
      for (const query of ['0x6b', 'native-only', '原生专用']) expect(resolver.searchArmorAppearances({ gameId: 'mhgu', saveType: 1, query }).items.map(item => item.appearanceId)).toEqual([107])
      expect(resolver.searchArmorAppearances({ gameId: 'mhgu', saveType: 1, query: "' OR 1=1--" }).items).toEqual([])
      expect(() => resolver.searchArmorAppearances({ gameId: 'mhgu', saveType: 7 })).toThrow(/部位/)
      for (const invalid of [{ gameId: 'mh4g', saveType: 1 }, { gameId: 'mhgu', saveType: 6 }, { gameId: 'mhgu', saveType: 1, page: 0 }, { gameId: 'mhgu', saveType: 1, pageSize: 101 }]) expect(saveArmorAppearanceSchema.safeParse(invalid).success).toBe(false)
    } finally { resolver.close() }
  })

  it('resolves all five GU appearance parts independently and keeps older identity numbering', () => {
    const directory = mkdtempSync(join(tmpdir(), 'save-appearance-')); directories.push(directory)
    const orders = { mhgu: ['head', 'chest', 'arms', 'waist', 'legs'], mh3g: ['chest', 'arms', 'waist', 'legs', 'head'], mh4g: ['chest', 'arms', 'waist', 'legs', 'head'] } as const
    for (const [game, parts] of Object.entries(orders)) {
      const db = new Database(join(directory, `${game}.sqlite`))
      db.exec('CREATE TABLE catalog_armor_save_identities(game_id TEXT,armor_dex_id INTEGER,save_type INTEGER,save_id INTEGER); CREATE TABLE catalog_armors(game_id TEXT,dex_id INTEGER,name_cn TEXT,name_en TEXT,icon_path TEXT,part TEXT,slots INTEGER,is_placeholder INTEGER)')
      parts.forEach((part, index) => {
        db.prepare('INSERT INTO catalog_armor_save_identities VALUES(?,?,?,?)').run(game, index + 1, index + 1, 9)
        db.prepare('INSERT INTO catalog_armors VALUES(?,?,?,?,?,?,?,?)').run(game, index + 1, `base-${part}`, '', '/ordinary.png', part, 1, 0)
        if (game === 'mhgu') { db.exec(`CREATE TABLE cn__armor_${part}(id INTEGER,name TEXT,english TEXT,rarity INTEGER)`); db.prepare(`INSERT INTO cn__armor_${part} VALUES(?,?,?,?)`).run(7, `appearance-${part}`, part, 5) }
      })
      if (game === 'mhgu') db.exec("INSERT INTO cn__armor_chest VALUES(99,'chest-only','chest-only',1)")
      db.close()
    }
    const resolver = new SaveCatalogResolver(directory)
    try {
      for (const [game, parts] of Object.entries(orders)) parts.forEach((part, index) => {
        expect(resolver.resolveEquipmentIdentity(game as keyof typeof orders, index + 1, 9, false)?.nameCn).toBe(`base-${part}`)
        if (game === 'mhgu') expect(resolver.resolveArmorAppearance('mhgu', index + 1, 7)).toMatchObject({ part, nameCn: `appearance-${part}`, iconSource: 'custom-appearance-sprite' })
        else expect(resolver.resolveArmorAppearance(game as 'mh3g' | 'mh4g', index + 1, 7)).toBeNull()
      })
      expect(resolver.resolveArmorAppearance('mhgu', 1, 99)).toBeNull()
      expect(resolver.resolveArmorAppearance('mhgu', 2, 99)?.part).toBe('chest')
      expect(resolver.resolveArmorAppearance('mhgu', 1, 0)).toBeNull()
      expect(resolver.resolveArmorAppearance('mhgu', 7, 7)).toBeNull()
      const cell = resolver.equipment('mhgu', { slot: 0, empty: false, level: 0, slots: 1, appearanceId: 7, decorations: [], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, recordHex: '00'.repeat(36), kind: 'armor', saveType: 1, saveId: 9 })
      expect(cell.iconPath).toBe('/ordinary.png')
      expect(cell.appearance?.part).toBe('head')
      const unknown = resolver.equipment('mhgu', { ...cell, appearanceId: 99 })
      expect(unknown.appearance).toBeNull()
      expect(unknown.diagnostics.some(value => value.code === 'equipment.appearance.unknown')).toBe(true)
    } finally { resolver.close() }
  })

  it('hydrates stable embedded-detail identities, decoration names and GU talisman names', () => {
    const directory = mkdtempSync(join(tmpdir(), 'save-resolver-')); directories.push(directory)
    const db = new Database(join(directory, 'mhgu.sqlite'))
    db.exec(`
      CREATE TABLE catalog_weapon_types(game_id TEXT,type_id INTEGER,save_type INTEGER,name_cn TEXT);
      CREATE TABLE catalog_weapons(game_id TEXT,weapon_key TEXT,save_type INTEGER,save_id INTEGER,save_level INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,icon_path TEXT);
      CREATE TABLE catalog_armor_save_identities(game_id TEXT,armor_dex_id INTEGER,save_type INTEGER,save_id INTEGER);
      CREATE TABLE catalog_armors(game_id TEXT,dex_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,icon_path TEXT,part TEXT);
      CREATE TABLE catalog_palico_weapons(game_id TEXT,equipment_id INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,icon_path TEXT);
      CREATE TABLE catalog_palico_armors(game_id TEXT,equipment_id INTEGER,save_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,icon_path TEXT,part TEXT);
      CREATE TABLE catalog_decorations(game_id TEXT,save_id INTEGER,name_cn TEXT,slots INTEGER);
      CREATE TABLE catalog_skills(game_id TEXT,skill_id INTEGER,name_cn TEXT);
      CREATE TABLE cn__talismans(id INTEGER,name TEXT,english TEXT);
      CREATE TABLE catalog_palico_generation_patterns(game_id TEXT,scope TEXT,pattern_id INTEGER,sequence TEXT,valid_length INTEGER,weight INTEGER);
      CREATE TABLE catalog_palico_forte_grants(game_id TEXT,forte_id INTEGER,kind TEXT,role TEXT,entry_id INTEGER);
      CREATE TABLE catalog_palico_generation_pool(game_id TEXT,kind TEXT,generation_group TEXT,entry_id INTEGER);
      INSERT INTO catalog_weapon_types VALUES('mhgu',1,7,'大剑');
      INSERT INTO catalog_weapons VALUES('mhgu','greatsword:7:5:2',7,5,2,'测试大剑','Test GS','',NULL);
      INSERT INTO catalog_armor_save_identities VALUES('mhgu',88,1,9);
      INSERT INTO catalog_armors VALUES('mhgu',88,'测试头盔','Test Helm','',NULL,'head');
      INSERT INTO catalog_palico_weapons VALUES('mhgu',44,144,'测试猫剑','Test Cat Sword','',NULL);
      INSERT INTO catalog_palico_armors VALUES('mhgu',45,145,'测试猫头','Test Cat Helm','',NULL,'head');
      INSERT INTO catalog_decorations VALUES('mhgu',101,'达人珠',1);
      INSERT INTO catalog_skills VALUES('mhgu',18,'痛击');
      INSERT INTO cn__talismans VALUES(4,'天之护石','Creator Talisman');
      INSERT INTO catalog_palico_generation_patterns VALUES('mhgu','normal_move',3,'ABCC',8,4);
      INSERT INTO catalog_palico_forte_grants VALUES('mhgu',2,'move','primary',7);
      INSERT INTO catalog_palico_generation_pool VALUES('mhgu','move','A',10);
    `)
    db.close()
    const resolver = new SaveCatalogResolver(directory)
    const base = { slot: 0, empty: false, level: 2, slots: 1, appearanceId: null, decorations: [101, 0, 0], skill1Id: null, skill1Points: null, skill2Id: null, skill2Points: null, recordHex: '00'.repeat(36) }
    expect(resolver.equipment('mhgu', { ...base, kind: 'weapon', saveType: 7, saveId: 5 })).toMatchObject({ weaponKey: 'greatsword:7:5:2', decorationLabels: [{ saveId: 101, nameCn: '达人珠', slots: 1 }] })
    expect(resolver.equipment('mhgu', { ...base, kind: 'armor', saveType: 1, saveId: 9 })).toMatchObject({ armorDexId: 88 })
    expect(resolver.equipment('mhgu', { ...base, kind: 'palico-weapon', saveType: 22, saveId: 144, decorations: [] })).toMatchObject({ palicoEquipmentId: 44, nameCn: '测试猫剑' })
    expect(resolver.equipment('mhgu', { ...base, kind: 'charm', saveType: 6, saveId: 4, skill1Id: 18, skill1Points: 5 })).toMatchObject({ nameCn: '天之护石', skill1NameCn: '痛击' })
    expect(resolver.equipmentSearchKeys('mhgu', '天之', false)).toContain('6:4')
    expect(resolver.palicoGenerationRules()).toEqual({
      patterns: [{ scope: 'normal_move', patternId: 3, sequence: 'ABCC', validLength: 8, weight: 4 }],
      grants: [{ forteId: 2, kind: 'move', role: 'primary', entryId: 7 }],
      pools: [{ kind: 'move', group: 'A', entryId: 10 }],
      source: 'MHGU/XX 原生猎猫生成表',
    })
    resolver.close()
  })
})
