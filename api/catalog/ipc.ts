import { ipcMain } from 'electron'
import type DatabaseType from 'better-sqlite3'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { GameId } from '../core/loadout'
import { P2gItemCatalogRepository } from './p2gItemRepository'
import { P2gQuestCatalogRepository } from './p2gQuestRepository'
import { P2gMonsterCatalogRepository } from './p2gMonsterRepository'
import { ItemTermRepository } from '../terminology/itemTermRepository'
import { itemTermFiltersSchema } from './schemas'
import { ItemCatalogRepository } from './repository'
import { DecorationCatalogRepository } from './decorationRepository'
import { WeaponCatalogRepository } from './weaponRepository'
import { WeaponMotionCatalogRepository } from './weaponMotionRepository'
import { ArmorCatalogRepository } from './armorRepository'
import { SkillCatalogRepository } from './skillRepository'
import { MonsterCatalogRepository } from './monsterRepository'
import { HunterArtCatalogRepository, QuestCatalogRepository } from './questRepository'
import { PalicoCatalogRepository } from './palicoRepository'
import { armorCatalogFiltersSchema, armorIdentitySchema, armorSetFiltersSchema, decorationCatalogFiltersSchema, decorationIdentitySchema, gameIdSchema, catalogGameIdSchema, hunterArtCatalogFiltersSchema, hunterArtIdentitySchema, itemCatalogFiltersSchema, itemIdentitySchema, monsterCatalogFiltersSchema, monsterIdentitySchema, palicoArmorFiltersSchema, palicoEquipmentIdentitySchema, palicoSkillFiltersSchema, palicoSkillIdentitySchema, palicoSupportMoveFiltersSchema, palicoSupportMoveIdentitySchema, palicoTypeIdentitySchema, palicoWeaponFiltersSchema, questCatalogFiltersSchema, questIdentitySchema, skillCatalogFiltersSchema, skillIdentitySchema, weaponCatalogFiltersSchema, weaponIdentitySchema, weaponMotionFiltersSchema, weaponTreeRequestSchema } from './schemas'
import { catalogChannels } from './channels'
export { catalogChannels }

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof DatabaseType

export function resolveCatalogDataDir(isPackaged: boolean, resourcesPath: string): string {
  if (process.env.MH_SAVE_EDIT_DATA_DIR) return resolve(process.env.MH_SAVE_EDIT_DATA_DIR)
  return isPackaged ? join(resourcesPath, 'data') : resolve(process.cwd(), 'data')
}

export function registerCatalogIpc(dataDir: string): () => void {
  let dictionary: { db: DatabaseType.Database; repository: ItemTermRepository } | undefined
  const itemTerms = () => {
    if (dictionary) return dictionary.repository
    const file = join(dataDir, 'item-terminology.sqlite')
    if (!existsSync(file)) return undefined
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(file, { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    try { dictionary = { db, repository: new ItemTermRepository(db) }; return dictionary.repository }
    catch (error) { db.close(); throw error }
  }
  const repositories = new Map<GameId, { db: DatabaseType.Database; repository: ItemCatalogRepository; decorations: DecorationCatalogRepository; weapons: WeaponCatalogRepository; weaponMotions: WeaponMotionCatalogRepository; armors: ArmorCatalogRepository; skills: SkillCatalogRepository; monsters: MonsterCatalogRepository; quests: QuestCatalogRepository; hunterArts: HunterArtCatalogRepository; palicoes: PalicoCatalogRepository }>()
  const repositoryEntry = (gameId: GameId) => {
    const cached = repositories.get(gameId)
    if (cached) return cached
    const file = join(dataDir, `${gameId}.sqlite`)
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(file, { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    let value: ItemCatalogRepository
    try { value = new ItemCatalogRepository(db, itemTerms()) }
    catch (error) { db.close(); throw error }
    const decorations = new DecorationCatalogRepository(db)
    const weapons = new WeaponCatalogRepository(db)
    const weaponMotions = new WeaponMotionCatalogRepository(db)
    const armors = new ArmorCatalogRepository(db)
    const skills = new SkillCatalogRepository(db)
    const monsters = new MonsterCatalogRepository(db)
    const quests = new QuestCatalogRepository(db)
    const hunterArts = new HunterArtCatalogRepository(db)
    const palicoes = new PalicoCatalogRepository(db)
    const entry = { db, repository: value, decorations, weapons, weaponMotions, armors, skills, monsters, quests, hunterArts, palicoes }
    repositories.set(gameId, entry)
    return entry
  }

  let p2g: { db: DatabaseType.Database; repository: P2gItemCatalogRepository; monsters?: P2gMonsterCatalogRepository; quests?: P2gQuestCatalogRepository } | undefined
  const p2gItems = () => {
    if (p2g) return p2g.repository
    if (!existsSync(join(dataDir, 'mhp2g.sqlite'))) throw new Error('P2G 道具资料库尚未安装，请查看 README 中的 P2G 本地接入说明。')
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(join(dataDir, 'mhp2g.sqlite'), { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    try { p2g = { db, repository: new P2gItemCatalogRepository(db, itemTerms()) }; return p2g.repository }
    catch (error) { db.close(); throw error }
  }

  const p2gMonsters = () => {
    p2gItems()
    return p2g!.monsters ??= new P2gMonsterCatalogRepository(p2g!.db)
  }

  ipcMain.handle(catalogChannels.searchItemTerms, (_event, payload: unknown) => {
    const filters = itemTermFiltersSchema.parse(payload)
    return itemTerms()?.search(filters) ?? { available: false, message: '译名词典尚未安装，当前显示各作原译名。', items: [], total: 0, page: filters.page ?? 1, pageSize: filters.pageSize ?? 30, hasNext: false }
  })
  ipcMain.handle(catalogChannels.searchItems, (_event, payload: unknown) => {
    const filters = itemCatalogFiltersSchema.parse(payload)
    return filters.gameId === 'mhp2g' ? p2gItems().searchItems(filters) : repositoryEntry(filters.gameId).repository.searchItems({ ...filters, gameId: filters.gameId })
  })
  ipcMain.handle(catalogChannels.getItem, (_event, payload: unknown) => {
    const identity = itemIdentitySchema.parse(payload)
    return identity.gameId === 'mhp2g' ? p2gItems().getItem(identity) : repositoryEntry(identity.gameId).repository.getItem(identity)
  })
  ipcMain.handle(catalogChannels.getItemFacets, (_event, payload: unknown) => {
    const gameId = catalogGameIdSchema.parse(payload)
    return gameId === 'mhp2g' ? p2gItems().getItemFacets() : repositoryEntry(gameId).repository.getItemFacets(gameId)
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
  ipcMain.handle(catalogChannels.searchSkills, (_event, payload: unknown) => {
    const filters = skillCatalogFiltersSchema.parse(payload)
    return repositoryEntry(filters.gameId).skills.searchSkills(filters)
  })
  ipcMain.handle(catalogChannels.getSkillFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repositoryEntry(gameId).skills.getSkillFacets(gameId)
  })
  ipcMain.handle(catalogChannels.searchMonsters, (_event, payload: unknown) => {
    const filters = monsterCatalogFiltersSchema.parse(payload)
    return filters.gameId === 'mhp2g' ? p2gMonsters().searchMonsters(filters) : repositoryEntry(filters.gameId).monsters.searchMonsters(filters)
  })
  ipcMain.handle(catalogChannels.getMonster, (_event, payload: unknown) => {
    const identity = monsterIdentitySchema.parse(payload)
    return identity.gameId === 'mhp2g' ? p2gMonsters().getMonster(identity.monsterId) : repositoryEntry(identity.gameId).monsters.getMonster({...identity,gameId:identity.gameId})
  })
  ipcMain.handle(catalogChannels.getMonsterFacets, (_event, payload: unknown) => {
    const gameId = catalogGameIdSchema.parse(payload)
    return gameId === 'mhp2g' ? p2gMonsters().getMonsterFacets() : repositoryEntry(gameId).monsters.getMonsterFacets(gameId)
  })
  const p2gQuests = () => { p2gItems(); return p2g!.quests ??= new P2gQuestCatalogRepository(p2g!.db) }
  ipcMain.handle(catalogChannels.getQuest, (_event, payload: unknown) => {
    const identity = questIdentitySchema.parse(payload)
    return identity.gameId==='mhp2g'?p2gQuests().getQuest(identity.questKey):repositoryEntry(identity.gameId).quests.getQuest(identity)
  })
  ipcMain.handle(catalogChannels.searchQuests, (_event, payload: unknown) => {
    const filters = questCatalogFiltersSchema.parse(payload)
    return filters.gameId==='mhp2g'?p2gQuests().searchQuests(filters):repositoryEntry(filters.gameId).quests.searchQuests(filters)
  })
  ipcMain.handle(catalogChannels.getQuestFacets, (_event, payload: unknown) => {
    const gameId = catalogGameIdSchema.parse(payload)
    return gameId==='mhp2g'?p2gQuests().getQuestFacets():repositoryEntry(gameId).quests.getQuestFacets(gameId)
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
  ipcMain.handle(catalogChannels.searchPalicoTypes, (_event, payload: unknown) => { const gameId=gameIdSchema.parse(payload);if(gameId!=='mhgu')throw new Error('当前游戏没有猎猫图鉴');return repositoryEntry(gameId).palicoes.searchTypes() })
  ipcMain.handle(catalogChannels.getPalicoType, (_event,payload:unknown)=>{const value=palicoTypeIdentitySchema.parse(payload);return repositoryEntry(value.gameId).palicoes.getType(value.typeId)})
  ipcMain.handle(catalogChannels.searchPalicoSupportMoves,(_event,payload:unknown)=>{const value=palicoSupportMoveFiltersSchema.parse(payload);return repositoryEntry(value.gameId).palicoes.searchSupportMoves(value)})
  ipcMain.handle(catalogChannels.getPalicoSupportMove,(_event,payload:unknown)=>{const value=palicoSupportMoveIdentitySchema.parse(payload);return repositoryEntry(value.gameId).palicoes.getSupportMove(value.supportMoveId)})
  ipcMain.handle(catalogChannels.searchPalicoSkills,(_event,payload:unknown)=>{const value=palicoSkillFiltersSchema.parse(payload);return repositoryEntry(value.gameId).palicoes.searchSkills(value)})
  ipcMain.handle(catalogChannels.getPalicoSkill,(_event,payload:unknown)=>{const value=palicoSkillIdentitySchema.parse(payload);return repositoryEntry(value.gameId).palicoes.getSkill(value.palicoSkillId)})
  ipcMain.handle(catalogChannels.searchPalicoWeapons,(_event,payload:unknown)=>{const value=palicoWeaponFiltersSchema.parse(payload);return repositoryEntry(value.gameId).palicoes.searchWeapons(value)})
  ipcMain.handle(catalogChannels.getPalicoWeapon,(_event,payload:unknown)=>{const value=palicoEquipmentIdentitySchema.parse(payload);if(value.kind!=='weapon')throw new Error('猫装备类型不匹配');return repositoryEntry(value.gameId).palicoes.getWeapon(value.equipmentId)})
  ipcMain.handle(catalogChannels.searchPalicoArmors,(_event,payload:unknown)=>{const value=palicoArmorFiltersSchema.parse(payload);return repositoryEntry(value.gameId).palicoes.searchArmors(value)})
  ipcMain.handle(catalogChannels.getPalicoArmor,(_event,payload:unknown)=>{const value=palicoEquipmentIdentitySchema.parse(payload);if(value.kind!=='armor')throw new Error('猫装备类型不匹配');return repositoryEntry(value.gameId).palicoes.getArmor(value.equipmentId)})
  ipcMain.handle(catalogChannels.getPalicoCatalogFacets,(_event,payload:unknown)=>{const gameId=gameIdSchema.parse(payload);if(gameId!=='mhgu')throw new Error('当前游戏没有猎猫图鉴');return repositoryEntry(gameId).palicoes.getFacets()})

  return () => {
    dictionary?.db.close(); dictionary = undefined
    p2g?.db.close(); p2g = undefined
    for (const channel of Object.values(catalogChannels)) ipcMain.removeHandler(channel)
    for (const value of repositories.values()) value.db.close()
    repositories.clear()
  }
}
