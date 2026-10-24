import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { repairMonsterNames, repairMonsterDictionary } from '../tools/runtime/monsterNames.mjs'
import { MonsterCatalogRepository } from '../api/catalog/monsterRepository'
import { modernMonsterText } from '../api/catalog/monsterNaming.mjs'
import { catalogIdentityRows, identityFingerprint } from '../api/terminology/catalogIdentity.mjs'
import { createItemDictionary } from '../tools/terminology/itemDictionary.mjs'

const databases = []
const database = () => { const db = new Database(':memory:'); databases.push(db); return db }
afterEach(() => databases.splice(0).forEach(db => db.close()))
function fixture(game = 'mhgu') {
  const db = database()
  db.exec(`
    CREATE TABLE catalog_monsters(game_id TEXT,monster_id INTEGER,name_cn TEXT,name_en TEXT,name_jp TEXT,
      icon_small_path TEXT,icon_large_path TEXT,is_placeholder INTEGER,source TEXT,PRIMARY KEY(game_id,monster_id));
    CREATE TABLE catalog_quests(game_id TEXT,quest_key TEXT,name_cn TEXT,goal_cn TEXT,sub_goal_cn TEXT);
    CREATE TABLE catalog_quest_targets(game_id TEXT,quest_key TEXT,monster_id INTEGER);
    CREATE TABLE catalog_quest_search_terms(row_id INTEGER PRIMARY KEY,game_id TEXT,quest_key TEXT,term_kind TEXT,label TEXT,normalized_text TEXT);
    CREATE TABLE catalog_item_relations(id INTEGER PRIMARY KEY,game_id TEXT,source_kind TEXT,target_id INTEGER,target_name TEXT,quantity INTEGER,probability REAL);
    CREATE TABLE catalog_weapons(weapon_key TEXT,name_cn TEXT,attack INTEGER,source TEXT);
    CREATE TABLE catalog_build_metadata(domain TEXT,game_id TEXT,source_sha256 TEXT,builder_sha256 TEXT,PRIMARY KEY(domain,game_id));
  `)
  const insert = db.prepare('INSERT INTO catalog_monsters VALUES (?,?,?,?,?,NULL,NULL,0,?)')
  insert.run(game, 7, game === 'mh4g' ? '电龙' : '白电', 'Khezu', 'フルフル', 'native evidence unchanged')
  insert.run(game, 8, '赤电龙', 'Red Khezu', 'フルフル亜種', 'subspecies')
  insert.run(game, 9, '电龙', 'Astalos', 'ライゼクス', 'other species')
  db.prepare('INSERT INTO catalog_item_relations VALUES (1,?,?,?,?,2,25)').run(game, 'monster', 7, '白电')
  db.prepare('INSERT INTO catalog_item_relations VALUES (2,?,?,?,?,1,50)').run(game, 'monster', 9, '电龙')
  db.prepare('INSERT INTO catalog_quests VALUES (?,?,?,?,?)').run(game, 'synthetic:one', '白电测试任务', '狩猎白电', '')
  db.prepare('INSERT INTO catalog_quest_targets VALUES (?,?,?)').run(game, 'synthetic:one', 7)
  db.prepare('INSERT INTO catalog_quest_search_terms VALUES (1,?,?,?,?,?)').run(game, 'synthetic:one', 'name', '白电测试任务', '白电测试任务')
  db.prepare('INSERT INTO catalog_weapons VALUES (?,?,100,?)').run('synthetic:weapon', '白电测试锤', 'raw 白电 source must stay unchanged')
  return db
}
const dump = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({name}) => [name, db.prepare(`SELECT * FROM "${name}"`).all()])

describe('current monster wording and legacy search', () => {
  it('renames the identified Khezu, its display references and equipment without changing other species or data', () => {
    const db = fixture()
    repairMonsterNames(db, 'mhgu')
    expect(db.prepare('SELECT name_cn,name_en,name_jp,source FROM catalog_monsters WHERE monster_id=7').get()).toEqual({name_cn:'奇怪龙',name_en:'Khezu',name_jp:'フルフル',source:'native evidence unchanged'})
    expect(db.prepare('SELECT name_cn FROM catalog_monsters WHERE monster_id IN (8,9) ORDER BY monster_id').all()).toEqual([{name_cn:'赤电龙'},{name_cn:'电龙'}])
    expect(db.prepare('SELECT target_name,quantity,probability FROM catalog_item_relations ORDER BY id').all()).toEqual([{target_name:'奇怪龙',quantity:2,probability:25},{target_name:'电龙',quantity:1,probability:50}])
    expect(db.prepare('SELECT * FROM catalog_weapons').get()).toMatchObject({name_cn:'奇怪龙测试锤',attack:100,source:'raw 白电 source must stay unchanged'})
  })
  it('finds the same current monster by its new name and both old spellings without confusing Astalos', () => {
    const db = fixture(); repairMonsterNames(db, 'mhgu')
    const repository = new MonsterCatalogRepository(db)
    for (const query of ['奇怪龙','白电','白电龙','Khezu','フルフル']) {
      expect(repository.searchMonsters({gameId:'mhgu',query}).filter(row => row.nameEn === 'Khezu')).toEqual([expect.objectContaining({monsterId:7,nameCn:'奇怪龙'})])
    }
    expect(repository.searchMonsters({gameId:'mhgu',query:'白电'}).map(row=>row.monsterId)).toEqual([7])
    expect(repository.searchMonsters({gameId:'mhgu',query:'电龙'}).some(row=>row.monsterId===9)).toBe(true)
  })
  it('preserves full old task-title indexes while adding current spelling, and is idempotent', () => {
    const db = fixture(); repairMonsterNames(db, 'mhgu')
    expect(db.prepare('SELECT label,normalized_text FROM catalog_quest_search_terms ORDER BY row_id').all()).toEqual([
      {label:'奇怪龙测试任务',normalized_text:'白电测试任务'},
      {label:'奇怪龙测试任务',normalized_text:'奇怪龙测试任务'},
    ])
    const before = dump(db); repairMonsterNames(db, 'mhgu'); expect(dump(db)).toEqual(before)
  })
  it('retains original Japanese, evidence and signed skills when changing P2G JSON names', () => {
    const db = fixture('mhp2g')
    db.exec("ALTER TABLE catalog_monsters ADD aliases TEXT DEFAULT '[]'; CREATE TABLE p2g_armors(armor_key TEXT,detail_json TEXT)")
    const raw = {nameCn:'白电测试甲',nameJp:'フルフルテスト',nameAliases:['旧测试甲'],skills:[{skillId:3,points:-2}],raw:{name:'白电 evidence'}}
    db.prepare('INSERT INTO p2g_armors VALUES (?,?)').run('synthetic:armor',JSON.stringify(raw))
    repairMonsterNames(db, 'mhp2g')
    const changed = JSON.parse(db.prepare('SELECT detail_json FROM p2g_armors').get().detail_json)
    expect(changed).toEqual({...raw,nameCn:'奇怪龙测试甲',nameAliases:['旧测试甲','白电测试甲']})
    expect(JSON.parse(db.prepare('SELECT aliases FROM catalog_monsters WHERE monster_id=7').get().aliases)).toEqual(['白电','白电龙'])
  })
  it('scopes 4G 电龙 replacement to base-monster quest links and retains subspecies spelling', () => {
    const db = fixture('mh4g')
    db.prepare('UPDATE catalog_quests SET name_cn=?,goal_cn=?').run('电龙与赤电龙','狩猎电龙和赤电龙')
    repairMonsterNames(db,'mh4g')
    expect(db.prepare('SELECT name_cn,goal_cn FROM catalog_quests').get()).toEqual({name_cn:'奇怪龙与赤电龙',goal_cn:'狩猎奇怪龙和赤电龙'})
    expect(new MonsterCatalogRepository(db).searchMonsters({gameId:'mh4g',query:'电龙'}).some(row=>row.monsterId===7)).toBe(true)
  })
  it('refuses ambiguous identities without changing any record', () => {
    const db = fixture()
    db.exec("INSERT INTO catalog_monsters SELECT game_id,17,name_cn,name_en,name_jp,icon_small_path,icon_large_path,is_placeholder,source FROM catalog_monsters WHERE monster_id=7")
    const before = dump(db)
    expect(()=>repairMonsterNames(db,'mhgu')).toThrow(/Ambiguous/)
    expect(dump(db)).toEqual(before)
  })
  it('updates paired terminology with both aliases and rejects stale fingerprints before mutation', () => {
    const db = database()
    db.exec(`CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); CREATE TABLE terms(id TEXT,preferred_name TEXT,source TEXT);
      CREATE TABLE members(game_id TEXT,item_id INTEGER,term_id TEXT);
      CREATE TABLE aliases(term_id TEXT,name TEXT,normalized TEXT,game_id TEXT,source TEXT,UNIQUE(term_id,name,game_id,source));`)
    db.prepare('INSERT INTO meta VALUES (?,?)').run('catalog:mhgu','original')
    db.exec("INSERT INTO terms VALUES ('synthetic:item','白电测试素材','old'); INSERT INTO members VALUES ('mhgu',1,'synthetic:item')")
    const rows=[{id:1,name_cn:'奇怪龙测试素材'}]
    const input=[{gameId:'mhgu',beforeFingerprint:'wrong',rows}]
    const before=dump(db)
    expect(()=>repairMonsterDictionary(db,input)).toThrow(/stale/); expect(dump(db)).toEqual(before)
    repairMonsterDictionary(db,[{...input[0],beforeFingerprint:'original'}])
    expect(db.prepare('SELECT preferred_name FROM terms').get().preferred_name).toBe('奇怪龙测试素材')
    expect(db.prepare('SELECT name FROM aliases ORDER BY name').all().map(row=>row.name)).toEqual(['奇怪龙测试素材','白电测试素材'])
    expect(db.prepare('SELECT value FROM meta').get().value).toBe(identityFingerprint(rows))
  })
  it('rebuilds terminology from frozen old wording and current reviewed names without losing provenance', () => {
    const db=database()
    const input=[{id:'synthetic:term',kind:'item',ja:'テスト素材',zhHans:'白电测试素材',chineseSource:'gu_official'}]
    const catalogs=[{gameId:'mhp2g',rows:[{id:1,dex_id:null,name_cn:'奇怪龙测试素材',name_en:'',name_jp:'テスト素材',is_placeholder:0,name_status:'reviewed'}]}]
    expect(()=>createItemDictionary(db,input,catalogs)).not.toThrow()
    expect(db.prepare('SELECT preferred_name,source FROM terms').get()).toEqual({preferred_name:'奇怪龙测试素材',source:'项目译名：按用户确认的崛起怪物名称统一相关称呼'})
    expect(db.prepare('SELECT name FROM aliases WHERE name IN (?,?) GROUP BY name ORDER BY name').all('白电测试素材','奇怪龙测试素材').map(row=>row.name)).toEqual(['奇怪龙测试素材','白电测试素材'])
  })
})
