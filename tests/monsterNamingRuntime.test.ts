import Database from 'better-sqlite3'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MonsterCatalogRepository } from '../api/catalog/monsterRepository'
import { P2gMonsterCatalogRepository } from '../api/catalog/p2gMonsterRepository'
import { QuestCatalogRepository } from '../api/catalog/questRepository'
import { P2gQuestCatalogRepository } from '../api/catalog/p2gQuestRepository'
import { WeaponCatalogRepository } from '../api/catalog/weaponRepository'
import { P2gWeaponCatalogRepository } from '../api/catalog/p2gWeaponRepository'
import { ArmorCatalogRepository } from '../api/catalog/armorRepository'
import { P2gArmorCatalogRepository } from '../api/catalog/p2gArmorRepository'
import { ItemTermRepository } from '../api/terminology/itemTermRepository'

const dataRoot = process.env.MH_MONSTER_NAMING_TEST_DATA_DIR ?? path.resolve('data')
const open = (game: string) => new Database(path.join(dataRoot, `${game}.sqlite`), { readonly: true, fileMustExist: true })

describe('published catalog monster naming integration', () => {
  it.each(['mh4g','mhgu','mhp2g'] as const)('%s resolves new and legacy names to the same native monster and task set', gameId => {
    const db = open(gameId)
    try {
      const monsters = gameId === 'mhp2g' ? new P2gMonsterCatalogRepository(db) : new MonsterCatalogRepository(db)
      const base = monsters.searchMonsters({gameId,query:'奇怪龙'}).find(row=>row.nameEn==='Khezu')!
      expect(base).toMatchObject({nameCn:'奇怪龙',nameJp:'フルフル'})
      for(const query of ['白电','白电龙']) expect(monsters.searchMonsters({gameId,query}).map(row=>row.monsterId)).toEqual(monsters.searchMonsters({gameId,query:'奇怪龙'}).map(row=>row.monsterId))
      const quests = gameId === 'mhp2g' ? new P2gQuestCatalogRepository(db) : new QuestCatalogRepository(db)
      const current = quests.searchQuests({gameId,query:'奇怪龙'})
      expect(current.total).toBeGreaterThan(0)
      const legacy = quests.searchQuests({gameId,query:'白电'})
      expect(legacy.total).toBe(current.total)
      expect(legacy.items.map(row=>row.questKey)).toEqual(current.items.map(row=>row.questKey))
    } finally { db.close() }
  })
  it.each(['mhgu','mhp2g'] as const)('%s keeps old equipment queries after updating display names', gameId => {
    const db = open(gameId)
    try {
      const weapons = gameId === 'mhp2g'
        ? (query: string) => new P2gWeaponCatalogRepository(db).searchWeapons({gameId,query})
        : (query: string) => new WeaponCatalogRepository(db).searchWeapons({gameId,query})
      const armors = gameId === 'mhp2g'
        ? (query: string) => new P2gArmorCatalogRepository(db).searchArmors({gameId,query})
        : (query: string) => new ArmorCatalogRepository(db).searchArmors({gameId,query})
      const currentWeapons = weapons('奇怪龙')
      const currentArmors = armors('奇怪龙')
      expect(currentWeapons.total).toBeGreaterThan(0); expect(currentArmors.total).toBeGreaterThan(0)
      expect(weapons('白电')).toEqual(currentWeapons)
      expect(armors('白电')).toEqual(currentArmors)
    } finally { db.close() }
  })
  it('keeps each catalog paired with its terminology and keeps old material aliases', () => {
    const db = open('item-terminology')
    try {
      const terms = new ItemTermRepository(db)
      for(const gameId of ['mh3g','mh4g','mhgu','mhp2g'] as const) {
        const catalog = open(gameId)
        try { expect(()=>terms.bindCatalog(catalog,gameId)).not.toThrow() } finally { catalog.close() }
      }
      const current = terms.search({gameId:'mhgu',query:'奇怪龙'})
      expect(current.total).toBeGreaterThan(0)
      expect(terms.search({gameId:'mhgu',query:'白电'}).items.map(row=>row.id)).toEqual(current.items.map(row=>row.id))
    } finally { db.close() }
  })
})
