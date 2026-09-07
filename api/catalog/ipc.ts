import { ipcMain } from 'electron'
import type DatabaseType from 'better-sqlite3'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import type { GameId } from '../core/loadout'
import { ItemCatalogRepository } from './repository'
import { DecorationCatalogRepository } from './decorationRepository'
import { WeaponCatalogRepository } from './weaponRepository'
import { decorationCatalogFiltersSchema, decorationIdentitySchema, gameIdSchema, itemCatalogFiltersSchema, itemIdentitySchema, weaponCatalogFiltersSchema, weaponIdentitySchema, weaponTreeRequestSchema } from './schemas'
import { catalogChannels } from './channels'
export { catalogChannels }

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof DatabaseType

export function resolveCatalogDataDir(isPackaged: boolean, resourcesPath: string): string {
  if (process.env.MH_SAVE_EDIT_DATA_DIR) return resolve(process.env.MH_SAVE_EDIT_DATA_DIR)
  return isPackaged ? join(resourcesPath, 'data') : resolve(process.cwd(), 'data')
}

export function registerCatalogIpc(dataDir: string): () => void {
  const repositories = new Map<GameId, { db: DatabaseType.Database; repository: ItemCatalogRepository; decorations: DecorationCatalogRepository; weapons: WeaponCatalogRepository }>()
  const repositoryEntry = (gameId: GameId) => {
    const cached = repositories.get(gameId)
    if (cached) return cached
    const file = join(dataDir, `${gameId}.sqlite`)
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(file, { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    const value = new ItemCatalogRepository(db)
    const decorations = new DecorationCatalogRepository(db)
    const weapons = new WeaponCatalogRepository(db)
    const entry = { db, repository: value, decorations, weapons }
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

  return () => {
    for (const channel of Object.values(catalogChannels)) ipcMain.removeHandler(channel)
    for (const value of repositories.values()) value.db.close()
    repositories.clear()
  }
}
