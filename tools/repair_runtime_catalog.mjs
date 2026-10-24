#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { repairRuntimeArmorSkills } from './runtime/repairArmorSkills.mjs'
import { repairMh4gCharms } from './runtime/repairMh4gCharms.mjs'
import { repairMh4gArmorIdentities } from './runtime/mh4gArmorIdentities.mjs'
import { repairRuntimeMonsterNames } from './runtime/monsterNames.mjs'

function repairMh3gDecorations() {
const root = path.resolve(import.meta.dirname, '..')
const databasePath = path.join(root, 'data/mh3g.sqlite')

// Runtime assets are intentionally private and may lag behind the public
// builder commit. This idempotent migration keeps an older injected catalog
// compatible with the corrected MH3G decoration crosswalk.
if (!fs.existsSync(databasePath)) return

const db = new Database(databasePath)
db.pragma('foreign_keys = ON')

const itemByDex = new Map(db.prepare('SELECT dex_id,save_id,icon_path FROM catalog_items WHERE game_id=?').all('mh3g').map(row => [row.dex_id, row]))
const item = (dexId) => {
  const value = itemByDex.get(dexId)
  if (!value) throw new Error(`Missing MH3G catalog item for dex_id=${dexId}`)
  return value
}

const updateDecoration = db.prepare(`UPDATE catalog_decorations SET
  dex_id=?, item_save_id=?, item_dex_id=?, name_cn=?, name_en=?, slots=?, price=?, icon_path=?,
  is_placeholder=0, mapping_status='confirmed-save-dex-item'
  WHERE game_id='mh3g' AND save_id=?`)
const deleteSkills = db.prepare("DELETE FROM catalog_decoration_skills WHERE game_id='mh3g' AND decoration_save_id=?")
const insertSkill = db.prepare(`INSERT INTO catalog_decoration_skills
  (game_id,decoration_save_id,skill_id,name_cn,name_en,points,active_skill_name_cn,active_skill_name_en,source)
  VALUES ('mh3g',?,?,?,?,?,?,?,'existing-content-db')`)
const deleteSources = db.prepare("DELETE FROM catalog_decoration_dex_sources WHERE game_id='mh3g' AND decoration_save_id=?")
const insertSource = db.prepare(`INSERT INTO catalog_decoration_dex_sources
  (game_id,decoration_save_id,dex_id,item_dex_id,source) VALUES ('mh3g',?,?,?,'DB_Jew.csv:Jew_ID=' || ?)`)
const deleteMaterials = db.prepare("DELETE FROM catalog_decoration_materials WHERE game_id='mh3g' AND decoration_save_id=?")
const insertMaterial = db.prepare(`INSERT INTO catalog_decoration_materials
  (game_id,decoration_save_id,recipe_index,item_save_id,item_dex_id,quantity,source)
  VALUES ('mh3g',?,?,?,?,?,?)`)

const canonical = [
  {
    saveId: 40, jewIds: [147, 148], itemDexId: 1122, dexId: 147,
    nameCn: '通常弹珠【２】', nameEn: 'ShotPlus Jewel 2', slots: 2, price: 375,
    skills: [
      [56, '装填速度', 'Reload Spd', -1, '装填速度+3 (+20) / 装填速度+2 (+15) / 装填速度+1 (+10) / 装填速度-1 (-10) / 装填速度-2 (-15) / 装填速度-3 (-20)', 'Reload Speed +3 (+20) / Reload Speed +2 (+15) / Reload Speed +1 (+10) / Reload Speed -1 (-10) / Reload Speed -2 (-15) / Reload Speed -3 (-20)'],
      [64, '通常弹追加', 'Normal S+ ', 3, '通常弹全LV追加 (+10)', 'Use Any Normal S (+10)'],
    ],
    materials: [[1, 780, 1, 147], [2, 483, 2, 148]],
  },
  {
    saveId: 173, jewIds: [160], itemDexId: 1249, dexId: 160,
    nameCn: '强瓶珠【２】', nameEn: 'Powercoat Jwl 2', slots: 2, price: 375,
    skills: [
      [18, '达人', 'Expert', -1, '洞悉+3 (+20) / 洞悉+2 (+15) / 洞悉+1 (+10) / 洞悉-1 (-10) / 洞悉-2 (-15) / 洞悉-3 (-20)', 'Critical Eye +3 (+20) / Critical Eye +2 (+15) / Critical Eye +1 (+10) / Critical Eye -1 (-10) / Critical Eye -2 (-15) / Critical Eye -3 (-20)'],
      [74, '强击瓶追加', 'Power C+', 3, '强击瓶追加 (+10)', 'Use Power Coat (+10)'],
    ],
    materials: [[1, 1080, 1, 160]],
  },
]

db.transaction(() => {
  for (const entry of canonical) {
    const targetItem = item(entry.itemDexId)
    updateDecoration.run(entry.dexId, targetItem.save_id, entry.itemDexId, entry.nameCn, entry.nameEn, entry.slots, entry.price, targetItem.icon_path, entry.saveId)
    deleteSkills.run(entry.saveId)
    for (const [skillId, nameCn, nameEn, points, activeCn, activeEn] of entry.skills) insertSkill.run(entry.saveId, skillId, nameCn, nameEn, points, activeCn, activeEn)
    deleteSources.run(entry.saveId)
    for (const jewId of entry.jewIds) insertSource.run(entry.saveId, jewId, entry.itemDexId, jewId)
    deleteMaterials.run(entry.saveId)
    for (const [recipeIndex, itemDexId, quantity, jewId] of entry.materials) {
      const materialItem = item(itemDexId)
      insertMaterial.run(entry.saveId, recipeIndex, materialItem.save_id, itemDexId, quantity, `DB_ItmtoJew.csv:Jew_ID=${jewId}`)
    }
  }
})()

const rows = db.prepare("SELECT save_id,dex_id,name_cn,name_en,slots FROM catalog_decorations WHERE game_id='mh3g' AND save_id IN (40,173) ORDER BY save_id").all()
if (rows[0]?.dex_id !== 147 || rows[0]?.name_en !== 'ShotPlus Jewel 2' || rows[1]?.dex_id !== 160 || rows[1]?.name_en !== 'Powercoat Jwl 2') {
  throw new Error(`MH3G decoration runtime migration verification failed: ${JSON.stringify(rows)}`)
}
db.close()
console.log('MH3G decoration crosswalk runtime migration applied')
}

repairMh3gDecorations()
repairRuntimeArmorSkills(path.resolve(import.meta.dirname, '..', 'data'))
const mh4gPath = path.resolve(import.meta.dirname, '..', 'data/mh4g.sqlite')
if (fs.existsSync(mh4gPath)) {
  const db = new Database(mh4gPath)
  try {
    db.pragma('foreign_keys=ON')
    console.log('MH4G charm source crosswalk prepared', repairMh4gCharms(db))
    console.log('MH4G armor save identities prepared', repairMh4gArmorIdentities(db))
  } finally { db.close() }
}
repairRuntimeMonsterNames(path.resolve(import.meta.dirname, '..', 'data'))
