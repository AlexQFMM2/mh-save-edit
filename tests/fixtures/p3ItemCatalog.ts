import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'

// Synthetic labels, recipes and prices; no game/research data.
export function p3ItemFixture(file = ':memory:') {
  const db = new Database(file)
  db.exec(readFileSync('tools/mhp3/schema.sql', 'utf8'))
  db.prepare('INSERT INTO meta VALUES(?,?)').run('catalog_schema','mhp3-items-v1')
  const insert = db.prepare(`INSERT INTO catalog_items VALUES('mhp3',?,NULL,NULL,?,'',?,'测试原文的译文',2,?,17,3,NULL,?,'native-item-definition;save-id-unverified',?,?,?,?)`)
  for (const [id,cn,jp,category,quantity,count,decoration] of [
    [0,'空位','placeholder','general','internal',null,null],
    [10,'测试材料','テスト材料','general','count',10,null],
    [20,'测试副料','テスト副料','general','count',20,null],
    [30,'测试成品','テスト成品','general','count',5,null],
    [94,'测试无限弹','テスト無限','ammo','infinite',null,null],
    [129,'内部瓶','テスト内部','coating','internal',null,null],
    [684,'测试冷却物','テスト冷却','general','reusable-cooldown',null,null],
    [825,'同名珠【1】','テスト珠甲','decoration','count',99,{slots:1,skills:[{id:1,nameCn:'测试技能',nameJp:'テスト技能',nameEn:'Test',points:1},{id:2,nameCn:'负向技能',nameJp:'テスト負',nameEn:'Negative',points:-1}]}],
    [826,'同名珠【1】','テスト珠乙','decoration','count',99,{slots:1,skills:[{id:1,nameCn:'测试技能',nameJp:'テスト技能',nameEn:'Test',points:2}]}],
  ] as const) {
    insert.run(id,cn,jp,count,[0,129].includes(id)?1:0,category,quantity,decoration?JSON.stringify(decoration):null,JSON.stringify(id===825?['审定旧称']:[]))
    db.prepare('INSERT INTO catalog_item_localization VALUES(?,?,?,?,?,?,?)').run(id,jp,'项目译名','reviewed','テスト説明','项目译文','reviewed')
  }
  db.exec(`INSERT INTO p3_combinations VALUES(0,0,10,20,30,75,1,3,'[30,40,30]');
    INSERT INTO p3_forge_recipes VALUES(0,825),(1,825),(2,826);
    INSERT INTO p3_forge_materials VALUES(0,0,10,2),(0,1,20,1),(1,0,20,3),(2,0,10,5);
    INSERT INTO p3_shops VALUES('common',10,'测试商店',NULL,17,0),('peddler:1',10,'测试行商',1,8,1);`)
  return db
}
