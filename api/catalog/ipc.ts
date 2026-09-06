import { ipcMain } from 'electron'
import type DatabaseType from 'better-sqlite3'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import type { GameId } from '../core/loadout'
import { ItemCatalogRepository } from './repository'
import { gameIdSchema, itemCatalogFiltersSchema, itemIdentitySchema } from './schemas'
import { catalogChannels } from './channels'
export { catalogChannels }

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof DatabaseType

export function resolveCatalogDataDir(isPackaged: boolean, resourcesPath: string): string {
  if (process.env.MH_SAVE_EDIT_DATA_DIR) return resolve(process.env.MH_SAVE_EDIT_DATA_DIR)
  return isPackaged ? join(resourcesPath, 'data') : resolve(process.cwd(), 'data')
}

export function registerCatalogIpc(dataDir: string): () => void {
  const repositories = new Map<GameId, { db: DatabaseType.Database; repository: ItemCatalogRepository }>()
  const repository = (gameId: GameId) => {
    const cached = repositories.get(gameId)
    if (cached) return cached.repository
    const file = join(dataDir, `${gameId}.sqlite`)
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(file, { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    const value = new ItemCatalogRepository(db)
    repositories.set(gameId, { db, repository: value })
    return value
  }

  ipcMain.handle(catalogChannels.searchItems, (_event, payload: unknown) => {
    const filters = itemCatalogFiltersSchema.parse(payload)
    return repository(filters.gameId).searchItems(filters)
  })
  ipcMain.handle(catalogChannels.getItem, (_event, payload: unknown) => {
    const identity = itemIdentitySchema.parse(payload)
    return repository(identity.gameId).getItem(identity)
  })
  ipcMain.handle(catalogChannels.getItemFacets, (_event, payload: unknown) => {
    const gameId = gameIdSchema.parse(payload)
    return repository(gameId).getItemFacets(gameId)
  })

  return () => {
    for (const channel of Object.values(catalogChannels)) ipcMain.removeHandler(channel)
    for (const value of repositories.values()) value.db.close()
    repositories.clear()
  }
}
