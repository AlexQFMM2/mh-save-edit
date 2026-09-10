import { BrowserWindow, ipcMain } from 'electron'
import type DatabaseType from 'better-sqlite3'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { gameIdSchema } from '../catalog/schemas'
import type { GameId } from '../core/loadout'
import { loadoutChannels } from './channels'
import { normalizeLegacyTransientLoadoutFields, reconcileImportedLoadout } from './file'
import { AutoLoadoutJobService } from './jobService'
import { LoadoutCatalogRepository } from './repository'
import { autoLoadoutControlSchema, autoLoadoutDeleteSchema, autoLoadoutJobFiltersSchema, autoLoadoutJobSchema, autoLoadoutRequestSchema, autoLoadoutResultSelectionSchema, loadoutArmorFiltersSchema, loadoutCharmSchema, loadoutDecorationFiltersSchema, loadoutWeaponFiltersSchema, logicalLoadoutSchema } from './schemas'
import type { AutoLoadoutRequest } from './types'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3') as typeof DatabaseType

export function registerLoadoutIpc(dataDir: string, stateDir: string): () => void {
  const repositories = new Map<GameId, { db: DatabaseType.Database; repository: LoadoutCatalogRepository }>()
  const repository = (gameId: GameId) => {
    const cached = repositories.get(gameId)
    if (cached) return cached.repository
    const nativeBinding = process.env.MH_SAVE_EDIT_SQLITE_BINDING
    const db = new Database(join(dataDir, `${gameId}.sqlite`), { readonly: true, fileMustExist: true, ...(nativeBinding ? { nativeBinding } : {}) })
    const value = new LoadoutCatalogRepository(db, gameId)
    repositories.set(gameId, { db, repository: value })
    return value
  }

  const prepareRequest = (input: AutoLoadoutRequest, retry: boolean) => {
    const snapshot = repository(input.gameId).getSnapshot()
    if (!retry && snapshot.dataVersion !== input.dataVersion) throw new Error('配装数据版本已变化，请刷新页面')
    const versionedLoadout = retry ? { ...input.baseLoadout, dataVersion: snapshot.dataVersion } : input.baseLoadout
    if (versionedLoadout.gameId !== input.gameId) throw new Error('配装与请求游戏不一致')
    const baseLoadout = reconcileImportedLoadout(snapshot, versionedLoadout)
    const targets = input.targets.map(target => {
      const activation = snapshot.skills.flatMap(skill => skill.activations).find(value => value.activationKey === target.activationKey && value.skillId === target.skillId && value.direction === 'positive')
      if (!activation) throw new Error(`自动配装目标不存在或不可用：${target.nameCn}`)
      return { activationKey: activation.activationKey, skillId: activation.skillId, threshold: activation.threshold, nameCn: activation.nameCn }
    })
    const request = { ...input, dataVersion: snapshot.dataVersion, baseLoadout, targets }
    return { snapshot, request }
  }
  const service = new AutoLoadoutJobService(join(stateDir, 'loadout-jobs.sqlite'), join(__dirname, 'auto-search-worker.js'), prepareRequest)
  const unsubscribe = service.subscribe(summary => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send(loadoutChannels.autoJobsChanged, summary)
  })

  ipcMain.handle(loadoutChannels.searchWeapons, (_event, payload: unknown) => { const filters = loadoutWeaponFiltersSchema.parse(payload); return repository(filters.gameId).searchWeapons(filters) })
  ipcMain.handle(loadoutChannels.searchArmors, (_event, payload: unknown) => { const filters = loadoutArmorFiltersSchema.parse(payload); return repository(filters.gameId).searchArmors(filters) })
  ipcMain.handle(loadoutChannels.searchDecorations, (_event, payload: unknown) => { const filters = loadoutDecorationFiltersSchema.parse(payload); return repository(filters.gameId).searchDecorations(filters) })
  ipcMain.handle(loadoutChannels.getFacets, (_event, payload: unknown) => { const gameId = gameIdSchema.parse(payload); return repository(gameId).getFacets() })
  ipcMain.handle(loadoutChannels.getBootstrap, (_event, payload: unknown) => { const gameId = gameIdSchema.parse(payload); return repository(gameId).getBootstrap() })
  ipcMain.handle(loadoutChannels.getSnapshot, (_event, payload: unknown) => { const gameId = gameIdSchema.parse(payload); return repository(gameId).getSnapshot() })
  ipcMain.handle(loadoutChannels.reconcileLoadout, (_event, payload: unknown) => { const loadout = logicalLoadoutSchema.parse(normalizeLegacyTransientLoadoutFields(payload)); return reconcileImportedLoadout(repository(loadout.gameId).getSnapshot(), loadout) })
  ipcMain.handle(loadoutChannels.validateCharm, (_event, payload: unknown) => { const charm = loadoutCharmSchema.parse(payload); return repository(charm.gameId).validateCharm(charm) })
  ipcMain.handle(loadoutChannels.startAuto, (_event, payload: unknown) => service.start(autoLoadoutRequestSchema.parse(payload)))
  ipcMain.handle(loadoutChannels.listAutoJobs, (_event, payload: unknown) => service.list(autoLoadoutJobFiltersSchema.parse(payload)))
  ipcMain.handle(loadoutChannels.getAutoJob, (_event, payload: unknown) => service.get(autoLoadoutJobSchema.parse(payload).jobId))
  ipcMain.handle(loadoutChannels.controlAuto, (_event, payload: unknown) => { const value = autoLoadoutControlSchema.parse(payload); service.control(value.jobId, value.action) })
  ipcMain.handle(loadoutChannels.retryAutoJob, (_event, payload: unknown) => service.retry(autoLoadoutJobSchema.parse(payload).jobId))
  ipcMain.handle(loadoutChannels.deleteAutoJobs, async (_event, payload: unknown) => service.delete(autoLoadoutDeleteSchema.parse(payload).jobIds))
  ipcMain.handle(loadoutChannels.markAutoJobViewed, (_event, payload: unknown) => service.markViewed(autoLoadoutJobSchema.parse(payload).jobId))
  ipcMain.handle(loadoutChannels.selectAutoJobResult, (_event, payload: unknown) => { const value = autoLoadoutResultSelectionSchema.parse(payload); service.selectResult(value.jobId, value.fingerprint) })
  ipcMain.handle(loadoutChannels.getAutoState, (_event, payload: unknown) => {
    const detail = service.get(autoLoadoutJobSchema.parse(payload).jobId)
    return { status: detail.status, progress: detail.progress, results: detail.results, ...(detail.error ? { error: detail.error } : {}) }
  })

  return () => {
    unsubscribe()
    for (const channel of Object.values(loadoutChannels)) ipcMain.removeHandler(channel)
    service.dispose()
    for (const value of repositories.values()) value.db.close()
    repositories.clear()
  }
}
