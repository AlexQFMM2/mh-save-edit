// Entirely synthetic combined native catalog, shared by repository and IPC tests.
import path from 'node:path'
import Database from 'better-sqlite3'
import { createWeaponFixture } from './p2gWeaponCatalog.mjs'
import { armorFixture } from './p2gArmorCatalog.mjs'
import { buildWeaponCatalog } from '../../tools/build_mhp2g_weapon_catalog.mjs'
import { appendArmors } from '../../tools/mhp2g/armorCatalog.mjs'
export function createLoadoutCatalog(dir) {
  const weapon = createWeaponFixture(dir)
  buildWeaponCatalog(weapon)
  const synthetic = armorFixture(), db = new Database(path.join(weapon.output, 'mhp2g.sqlite'))
  try {
    for (const recipe of synthetic.evidence.recipes) recipe.recipe_key = `armor:${recipe.recipe_key}`
    db.exec("DELETE FROM catalog_item_relation_targets WHERE relation_id IN (SELECT id FROM catalog_item_relations WHERE usage_kind='armor'); DELETE FROM catalog_item_relations WHERE usage_kind='armor'")
    for (const r of synthetic.evidence.recipes) for (const m of r.materials) db.prepare("INSERT INTO catalog_item_relations(source_key,item_id,source_kind,usage_kind,target_name,quantity,metadata) VALUES (?,?,'armor','armor','Synthetic',?,'{}')").run(`creation:${r.recipe_key}:${m.position}`, m.item_id, m.quantity)
    // More than one repository page; no fixed snapshot counts can hide truncation.
    const prototype = synthetic.evidence.armors[0]
    for (let i = 2; i <= 102; i++) {
      const armor = { ...prototype, equipmentKey: `armor_head:${i}`, index: i, nameCn: `测试头${i}`, nameJp: `テスト頭${i}`, rowSha256: `synthetic-head-${i}` }
      synthetic.evidence.armors.push(armor)
      synthetic.evidence.points.push({ owner_key: armor.equipmentKey, skill_id: 1, points: -1 })
      synthetic.evidence.eligibility.normal.push(armor.equipmentKey)
      synthetic.evidence.eligibility.rewards.push({ equipmentKey: armor.equipmentKey, descriptionCn: '合成取得条件' })
      synthetic.evidence.icons.armors.push({ equipmentKey: armor.equipmentKey, rowSha256: armor.rowSha256, part: 'head', rarityRaw: 1, iconKey: 'test' })
    }
    appendArmors(db, synthetic.evidence)
    db.prepare('INSERT INTO meta VALUES (?,?)').run('armor_schema', 'mhp2g-armors-v1')
  } finally { synthetic.db.close(); db.close() }
  return weapon.output
}
