// Deliberately synthetic records: no game data, extracted icons or real mappings.
import Database from 'better-sqlite3'
import { appendArmors } from '../../tools/mhp2g/armorCatalog.mjs'
export function armorFixture() {
  const db=new Database(':memory:')
  db.pragma('foreign_keys=ON')
  db.exec(`CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT); INSERT INTO meta VALUES ('weapon_schema','mhp2g-weapons-v1');
    CREATE TABLE catalog_items(item_id INTEGER PRIMARY KEY,name_cn TEXT,name_jp TEXT,name_en TEXT,is_placeholder INTEGER);
    INSERT INTO catalog_items VALUES (1,'测试矿石','テスト鉱石','Test Ore',0),(2,'测试木材','テスト木材','Test Wood',0);
    CREATE TABLE p2g_skills(skill_id INTEGER PRIMARY KEY,detail_json TEXT);
    CREATE TABLE catalog_item_relations(id INTEGER PRIMARY KEY,source_key TEXT,item_id INTEGER,quantity INTEGER,usage_kind TEXT);
  `)
  db.prepare('INSERT INTO p2g_skills VALUES (?,?)').run(1,JSON.stringify({nameCn:'测试技能',nameJp:'テスト技能'}))
  const make=(part,index,gender='both')=>({equipmentKey:`armor_${part}:${index}`,index,part,rowSha256:`synthetic-${part}-${index}`,nameJp:`テスト${part}${index}`,nameCn:`测试${part}${index}`,nameSource:'reviewed',legacyName:`旧名称${part}${index}`,combat:'both',gender,rarity:2,slots:1,priceRaw:100,baseDefense:4,maxDefense:14,maxBeforeFinalUnlock:10,fireRes:-2,waterRes:0,thunderRes:1,iceRes:0,dragonRes:0})
  const armors=[make('head',1),make('chest',1,'male'),make('chest',2,'female')]
  const recipe=(id,key,itemId)=>({recipe_key:id,target_equipment_key:key,materials:[{position:0,item_id:itemId,quantity:2}]})
  const recipes=[recipe('first',armors[0].equipmentKey,1),recipe('alternative',armors[0].equipmentKey,2),recipe('male',armors[1].equipmentKey,1)]
  recipes.forEach((r,i)=>db.prepare('INSERT INTO catalog_item_relations VALUES (?,?,?,?,?)').run(i+1,`creation:${r.recipe_key}:0`,r.materials[0].item_id,2,'armor'))
  const sets=['male','female'].map((gender,i)=>({setKey:`test:${gender}`,nameCn:`测试套装${gender}`,nameJp:`テスト${gender}`,gender,sources:[{page:'synthetic'}],rows:{blademaster:{head:armors[0].equipmentKey,chest:armors[i+1].equipmentKey},gunner:{head:armors[0].equipmentKey,chest:armors[i+1].equipmentKey}}}))
  const evidence={armors,recipes,points:armors.map((a,i)=>({owner_key:a.equipmentKey,skill_id:1,points:i?-3:2})),sets,eligibility:{normal:armors.map(a=>a.equipmentKey),excluded:[],rewards:[{equipmentKey:armors[2].equipmentKey,descriptionCn:'测试奖励条件'}]},icons:{icons:[{iconKey:'test',path:'catalog/icons/synthetic.png'}],armors:armors.map(a=>({equipmentKey:a.equipmentKey,rowSha256:a.rowSha256,part:a.part,rarityRaw:1,iconKey:'test'}))}}
  const install=()=>{db.transaction(()=>appendArmors(db,evidence))();db.prepare('INSERT INTO meta VALUES (?,?)').run('armor_schema','mhp2g-armors-v1')}
  return {db,evidence,install}
}
