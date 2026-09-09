import { ipcMain } from 'electron'
import type DatabaseType from 'better-sqlite3'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import type { GameId } from '../core/loadout'
import { ItemCatalogRepository } from './repository'
import { DecorationCatalogRepository } from './decorationRepository'
import { WeaponCatalogRepository } from './weaponRepository'
import { WeaponMotionCatalogRepository } from './weaponMotionRepository'
import { ArmorCatalogRepository } from './armorRepository'
import { SkillCatalogRepository } from './skillRepository'
import { MonsterCatalogRepository } from './monsterRepository'
import { HunterArtCatalogRepository, QuestCatalogRepository } from './questRepository'
import { armorCatalogFiltersSchema, armorIdentitySchema, armorSetFiltersSchema, decorationCatalogFiltersSchema, decorationIdentitySchema, gameIdSchema, hunterArtCatalogFiltersSchema, hunterArtIdentitySchema, itemCatalogFiltersSchema, itemIdentitySchema, monsterCatalogFiltersSchema, monsterIdentitySchema, questCatalogFiltersSchema, questIdentitySchema, skillIdentitySchema, weaponCatalogFiltersSchema, weaponIdentitySchema, weaponMotionFiltersSchema, weaponTreeRequestSchema } from './schemas'
import { catalogChannels } from './channels'
export { catalogChannels }

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof DatabaseType

export function resolveCatalogDataDir(isPackaged: boolean, resourcesPath: string): string {
  if (process.env.MH_SAVE_EDIT_DATA_DIR) return resolve(process.env.MH_SAVE_EDIT_DATA_DIR)
  return isPackaged ? join(resourcesPath, 'data') : resolve(process.cwd(), 'data')
}

export function registerCatalogIpc(dataDir: string): () => void {
  const repositories = new Map<GameId, { db: DatabaseType.Database; repository: ItemCatalogRepository; decorations: DecorationCatalogRepository; weapons: WeaponCatalogRepository; weaponMotions: WeaponMotionCatalogRepository; armors: ArmorCatalogRepository; skills: SkillCatalogRepository; monsters: MonsterCatalogRepository; quests: QuestCatalogRepository; hunterArts: HunterArtCatalogRepository }>()
  const repositoryEntry = (gameId: GameId) => {
    const cached = repositories.get(gameId)
    if (cached) return cached
    const file = join(dataDir, `${gameId}.sqlite`)
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(file, { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    const value = new ItemCatalogRepository(db)
    const decorations = new DecorationCatalogRepository(db)
    const weapons = new WeaponCatalogRepository(db)
    const weaponMotions = new WeaponMotionCatalogRepository(db)
    const armors = new ArmorCatalogRepository(db)
    const skills = new SkillCatalogRepository(db)
    const monsters = new MonsterCatalogRepository(db)
    const quests = new QuestCatalogRepository(db)
    const hunterArts = new HunterArtCatalogRepository(db)
    const entry = { db, repository: value, decorations, weapons, weaponMotions, armors, skills, monsters, quests, hunterArts }
    repositories.set(gameId, entry)
    return entry
  }

  ipcMain.handle(catalogChannels.searchItems, (_event, payload: unknown) => {
    const filters = itemCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).repository.searchItems(filters)
  })
  ipcMain.handle(catalogChannels.getItem, (_event, payload: unknown) => {
    const identity = itemIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).repository.getItem(identity)
  })
  ipcMain.handle(catalogChannels.getItemFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).repository.getItemFacets(gameId)
  })
  ipcMain.handle(catalogChannels.searchDecorations, (_event, payload: unknown) => {
    const filters = decorationCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).decorations.searchDecorations(filters)
  })
  ipcMain.handle(catalogChannels.getDecoration, (_event, payload: unknown) => {
    const identity = decorationIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).decorations.getDecoration(identity)
  })
  ipcMain.handle(catalogChannels.getDecorationFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).decorations.getDecorationFacets(gameId)
  })
  ipcMain.handle(catalogChannels.searchWeapons, (_event, payload: unknown) => {
    const filters = weaponCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).weapons.searchWeapons(filters)
  })
  ipcMain.handle(catalogChannels.getWeapon, (_event, payload: unknown) => {
    const identity = weaponIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).weapons.getWeapon(identity)
  })
  ipcMain.handle(catalogChannels.getWeaponFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).weapons.getWeaponFacets(gameId)
  })
  ipcMain.handle(catalogChannels.getWeaponTree, (_event, payload: unknown) => {
    const request = weaponTreeRequestSchema.parse(payload)
    return repositoryEntry(request.gameId).weapons.getWeaponTree(request.gameId, request.weaponTypeId)
  })
  ipcMain.handle(catalogChannels.searchWeaponMotions, (_event, payload: unknown) => {
    const filters = weaponMotionFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).weaponMotions.searchWeaponMotions(filters)
  })
  ipcMain.handle(catalogChannels.getWeaponMotionFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    if (gameId !== 'mhgu') throw new Error('当前游戏没有动作值图鉴')
    return repositoryEntry(gameId).weaponMotions.getWeaponMotionFacets(gameId)
  })
  ipcMain.handle(catalogChannels.searchArmors, (_event, payload: unknown) => {
    const filters = armorCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).armors.searchArmors(filters)
  })
  ipcMain.handle(catalogChannels.searchArmorSets, (_event, payload: unknown) => {
    const filters = armorSetFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).armors.searchArmorSets(filters)
  })
  ipcMain.handle(catalogChannels.getArmor, (_event, payload: unknown) => {
    const identity = armorIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).armors.getArmor(identity)
  })
  ipcMain.handle(catalogChannels.getArmorFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).armors.getArmorFacets(gameId)
  })
  ipcMain.handle(catalogChannels.getSkill, (_event, payload: unknown) => {
    const identity = skillIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).skills.getSkill(identity)
  })
  ipcMain.handle(catalogChannels.searchMonsters, (_event, payload: unknown) => {
    const filters = monsterCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).monsters.searchMonsters(filters)
  })
  ipcMain.handle(catalogChannels.getMonster, (_event, payload: unknown) => {
    const identity = monsterIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).monsters.getMonster(identity)
  })
  ipcMain.handle(catalogChannels.getMonsterFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).monsters.getMonsterFacets(gameId)
  })
  ipcMain.handle(catalogChannels.getQuest, (_event, payload: unknown) => {
    const identity = questIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).quests.getQuest(identity)
  })
  ipcMain.handle(catalogChannels.searchQuests, (_event, payload: unknown) => {
    const filters = questCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).quests.searchQuests(filters)
  })
  ipcMain.handle(catalogChannels.getQuestFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).quests.getQuestFacets(gameId)
  })
  ipcMain.handle(catalogChannels.searchHunterArts, (_event, payload: unknown) => {
    const filters = hunterArtCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).hunterArts.searchHunterArts(filters)
  })
  ipcMain.handle(catalogChannels.getHunterArt, (_event, payload: unknown) => {
    const identity = hunterArtIdentitySchema.parse(payload)
    return repositoryEntry(identity.gameId).hunterArts.getHunterArt(identity)
  })
  ipcMain.handle(catalogChannels.getHunterArtFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    if (gameId !== 'mhgu') return { weaponTypes: [], levels: [], unlockKinds: [] }
    return repositoryEntry(gameId).hunterArts.getHunterArtFacets(gameId)
  })

  return () => {
    for (const channel of Object.values(catalogChannels)) ipcMain.removeHandler(channel)
    for (const value of repositories.values()) value.db.close()
    repositories.clear()
  }
}
