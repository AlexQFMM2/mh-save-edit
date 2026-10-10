// Synthetic schema fixture: no game data or research snapshots.
import Database from 'better-sqlite3'
export function createP2gSource(file) {
  const db = new Database(file)
  db.exec(`
    CREATE TABLE native_item_catalog(item_id INTEGER PRIMARY KEY,name TEXT,description TEXT,stack_limit INTEGER,buy_price INTEGER,sell_price INTEGER,source_id TEXT);
    CREATE TABLE wiki_business_observations(kind TEXT,observation_key TEXT,payload_json TEXT);
    CREATE TABLE wiki_r7_gathering(key TEXT,native_item_id INTEGER,payload_json TEXT);
    CREATE TABLE wiki_r8_segment_links(document TEXT,line_key TEXT,segment_index INTEGER,target_kind TEXT,target_key TEXT,relation_status TEXT,native_item_id INTEGER);
    CREATE TABLE wiki_r8_segments(line_key TEXT,segment_index INTEGER,raw_segment TEXT);
    CREATE TABLE wiki_r9_links(source_name TEXT,line_key TEXT,segment_index INTEGER,target_kind TEXT,target_key TEXT);
    CREATE TABLE wiki_r9_decisions(source_name TEXT,native_item_id INTEGER);
    CREATE TABLE wiki_r6_records(kind TEXT,key TEXT,payload_json TEXT);
    CREATE TABLE wiki_r8_reward_links(reward_line_key TEXT,native_item_id INTEGER);
    CREATE TABLE monster_names(native_monster_id INTEGER,name TEXT);
    CREATE TABLE monster_rewards(link_id INTEGER,monster_id INTEGER,kind TEXT,part_code INTEGER,rank_slot TEXT,pool_key TEXT);
    CREATE TABLE reward_items(pool_key TEXT,ordinal INTEGER,item_id INTEGER,chance INTEGER,amount INTEGER);
    CREATE TABLE creation_recipes(recipe_key TEXT,target_equipment_key TEXT,target_item_id INTEGER);
    CREATE TABLE creation_materials(recipe_key TEXT,position INTEGER,item_id INTEGER,quantity INTEGER);
    CREATE TABLE records(record_key TEXT,name TEXT,native_table TEXT);
    CREATE TABLE upgrade_records(upgrade_key TEXT,equipment_key TEXT);
    CREATE TABLE upgrade_materials(upgrade_key TEXT,position INTEGER,item_id INTEGER,quantity INTEGER);
  `)
  for(const [id,name] of [[0,'－－－'],[1,'测试成品'],[2,'测试材料甲'],[3,'测试材料乙']]) db.prepare('INSERT INTO native_item_catalog VALUES(?,?,?,?,?,?,?)').run(id,name,'第一行\\n第二行',10,100,10,'synthetic')
  const business=(kind,key,payload)=>db.prepare('INSERT INTO wiki_business_observations VALUES(?,?,?)').run(kind,key,JSON.stringify(payload))
  const record=(kind,key,payload)=>db.prepare('INSERT INTO wiki_r6_records VALUES(?,?,?)').run(kind,key,JSON.stringify(payload))
  business('item-identity','1',{native_item_id:1,wiki_name_ja:'テスト品'})
  business('recipe','1',{source_page:1,table_index:0,row_index:1,native_result_id:1,native_material_a_id:2,native_material_b_id:3,amount_raw:'1–3',amount_min_wiki:1,amount_max_wiki:3,notes_ja:'合成条件',success_pct_wiki:75})
  business('quest','quest:1',{key:'quest:1',fields:{name:{text:'测试任务'},map:{text:'测试地图'}},rank_heading:'测试等级'})
  const line={map_name_ja:'测试地图',area_heading_ja:'测试区域',position_raw:'点甲',gathering_type_raw:'采集',rank_or_mode_raw:'测试模式',text:'测试材料甲',native_item_id:2}
  db.prepare('INSERT INTO wiki_r7_gathering VALUES(?,?,?)').run('line:1',2,JSON.stringify(line))
  db.prepare('INSERT INTO wiki_r7_gathering VALUES(?,?,?)').run('line:2',null,JSON.stringify({...line,text:'异名',native_item_id:null}))
  db.exec("INSERT INTO wiki_r8_segments VALUES('line:2',0,'异名'); INSERT INTO wiki_r8_segment_links VALUES('review','line:2',0,'item','item:3','candidate-other-map',3)")
  record('shop-condition','shop:1',{key:'shop:1',native_item_id:2,shop_scope:'测试商店',price_z_as_listed:12,pattern_number:4,discount_label:'表内半价',unlock_conditions:[{raw_text:'通过测试任务'}],unmarked_status:null,unmatched_colors:[]})
  record('reward-line','reward:1',{key:'reward:1',quest_key:'quest:1',native_item_id:2,explicit_quantity_wiki:2,raw_text:'测试材料甲 ×2'})
  db.exec("INSERT INTO monster_names VALUES(1,'测试怪物'); INSERT INTO monster_rewards VALUES(1,1,'capture',NULL,'unknown','pool'); INSERT INTO reward_items VALUES('pool',0,2,25,1); INSERT INTO records VALUES('weapon:1','测试武器','weapon'); INSERT INTO creation_recipes VALUES('craft:1','weapon:1',NULL); INSERT INTO creation_materials VALUES('craft:1',0,2,3)")
  db.close()
}
