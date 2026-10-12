// Synthetic identities and relationships only; no game-derived records.
import path from 'node:path'
import Database from 'better-sqlite3'
import { createSkillFixture } from './p2gSkillCatalog.mjs'
import { buildSkillCatalog } from '../../tools/build_mhp2g_skill_catalog.mjs'
import { sha256 } from '../../tools/mhp2g/sources.mjs'
export function createDecorationFixture(dir) {
  const skill=createSkillFixture(dir)
  const first=skill.snapshot.equipment[0]
  skill.snapshot.equipment.push({...first,equipmentKey:'item:3',itemId:3,sourceKey:'decoration_items:1',nameCn:'乙合成珠',nameJp:'テスト珠乙',slots:3,skills:[{skillId:2,points:5}],recipes:[{recipeKey:'test:recipe:3',materials:[{itemId:2,quantity:4}]}]})
  skill.save();buildSkillCatalog(skill)
  const base=path.join(skill.output,'mhp2g.sqlite'),db=new Database(base)
  for(const e of skill.snapshot.equipment.filter(e=>e.kind==='decoration')) {
    db.prepare('UPDATE catalog_items SET name_cn=?,name_jp=? WHERE item_id=?').run(e.nameCn,e.nameJp,e.itemId)
    for(const recipe of e.recipes)recipe.materials.forEach((m,i)=>db.prepare('INSERT INTO catalog_item_relations(source_key,item_id,source_kind,usage_kind,target_name,quantity,probability,metadata,pending_target) VALUES(?,?,?,?,?,?,NULL,?,?)').run(`creation:${recipe.recipeKey}:${i}`,m.itemId,'decoration','decoration',e.nameCn,m.quantity,JSON.stringify({sourceKey:recipe.recipeKey}),JSON.stringify({kind:'decoration',name:e.nameCn})))
  }
  db.close()
  return {base,baseSha256:sha256(base),output:path.join(dir,'decorations'),expected:{decorations:2,points:3,recipes:3,materials:3}}
}
