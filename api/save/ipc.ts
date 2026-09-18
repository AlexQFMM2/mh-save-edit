import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { SaveOpenRequest } from './types'
import { saveChannels } from './channels'
import { saveArmorAppearanceSchema, saveBoxWriteTargetSchema, saveCatalogEquipmentSchema, saveCatalogItemSchema, saveCharacterSchema, saveCloseSchema, saveCommandSchema, saveIdentitySchema, saveImportApplySchema, saveLoadoutPreviewSchema, saveLoadoutWriteSchema, saveOpenSchema, saveSectionSchema, saveSessionIdSchema, saveTransferSchema } from './schemas'
import { SaveSessionService } from './sessionService'

export type RegisteredSaveIpc = { dispose(): void; confirmWindowClose(window: BrowserWindow): boolean }

export function registerSaveIpc(dataDir: string): RegisteredSaveIpc {
  const service = new SaveSessionService(dataDir)
  const unsubscribe = service.subscribe(snapshot => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send(saveChannels.sessionChanged, snapshot)
  })
  const openTitle = (request: SaveOpenRequest) => request.formatId.includes('mhgu') || request.formatId.includes('mhxx') ? '选择 system 存档' : '选择角色存档文件'

  ipcMain.handle(saveChannels.getSession, () => service.snapshot())
  ipcMain.handle(saveChannels.searchArmorAppearances, (_event, payload: unknown) => service.searchArmorAppearances(saveArmorAppearanceSchema.parse(payload)))
  ipcMain.handle(saveChannels.open, async (_event, payload: unknown) => {
    const request = saveOpenSchema.parse(payload)
    const selected = await dialog.showOpenDialog({ title: openTitle(request), properties: ['openFile'], filters: [{ name: 'Monster Hunter 存档', extensions: ['*'] }] })
    if (selected.canceled || !selected.filePaths[0]) return { cancelled: true, session: service.snapshot(), characters: [] }
    return service.openPath(selected.filePaths[0], request)
  })
  ipcMain.handle(saveChannels.listCharacters, (_event, payload: unknown) => { const request = saveSessionIdSchema.parse(payload); return service.characters(request.sessionId, request.revision) })
  ipcMain.handle(saveChannels.selectCharacter, (_event, payload: unknown) => { const request = saveCharacterSchema.parse(payload); return service.selectCharacter(request.sessionId, request.slot, request.revision) })
  ipcMain.handle(saveChannels.getSection, (_event, payload: unknown) => service.getSection(saveSectionSchema.parse(payload)))
  ipcMain.handle(saveChannels.applyCommand, (_event, payload: unknown) => service.apply(saveCommandSchema.parse(payload)))
  ipcMain.handle(saveChannels.undo, (_event, payload: unknown) => { const value = saveIdentitySchema.parse(payload); return service.undo(value.sessionId, value.revision) })
  ipcMain.handle(saveChannels.redo, (_event, payload: unknown) => { const value = saveIdentitySchema.parse(payload); return service.redo(value.sessionId, value.revision) })
  ipcMain.handle(saveChannels.validate, (_event, payload: unknown) => { const value = saveIdentitySchema.parse(payload); return service.validate(value.sessionId, value.revision) })
  ipcMain.handle(saveChannels.saveCurrent, (_event, payload: unknown) => { const value = saveIdentitySchema.parse(payload); return service.save(value.sessionId, value.revision) })
  ipcMain.handle(saveChannels.saveAs, async (_event, payload: unknown) => {
    const value = saveIdentitySchema.parse(payload)
    const selected = await dialog.showSaveDialog({ title: '另存存档为', defaultPath: service.suggestedFileName(), properties: ['showOverwriteConfirmation'] })
    if (selected.canceled || !selected.filePath) return { cancelled: true, session: service.snapshot(), message: '已取消另存为' }
    return service.save(value.sessionId, value.revision, selected.filePath)
  })
  ipcMain.handle(saveChannels.close, (_event, payload: unknown) => { const value = saveCloseSchema.parse(payload); service.close(value.sessionId, value.discard, value.revision); return null })
  ipcMain.handle(saveChannels.previewImport, async (_event, payload: unknown) => {
    const value = saveTransferSchema.parse(payload)
    const selected = await dialog.showOpenDialog({ title: '导入箱子数据', properties: ['openFile'], filters: value.format === 'csv' ? [{ name: 'CSV', extensions: ['csv'] }] : [{ name: 'MH Save Editor 箱子备份', extensions: ['mhbox', 'json'] }] })
    if (selected.canceled || !selected.filePaths[0]) return null
    return service.previewImport(value, selected.filePaths[0])
  })
  ipcMain.handle(saveChannels.applyImport, (_event, payload: unknown) => service.applyImport(saveImportApplySchema.parse(payload)))
  ipcMain.handle(saveChannels.previewBoxWriteTarget, (_event, payload: unknown) => service.previewBoxWriteTarget(saveBoxWriteTargetSchema.parse(payload)))
  ipcMain.handle(saveChannels.previewCatalogItemWrite, (_event, payload: unknown) => service.previewCatalogItemWrite(saveCatalogItemSchema.parse(payload)))
  ipcMain.handle(saveChannels.exportBox, async (_event, payload: unknown) => {
    const value = saveTransferSchema.parse(payload); const extension = value.format === 'csv' ? 'csv' : 'mhbox'
    const selected = await dialog.showSaveDialog({ title: '导出箱子数据', defaultPath: `${value.domain}.${extension}`, filters: [{ name: value.format === 'csv' ? 'CSV' : 'MH Save Editor 箱子备份', extensions: [extension] }], properties: ['showOverwriteConfirmation'] })
    if (selected.canceled || !selected.filePath) return { cancelled: true, message: '已取消导出' }
    service.exportBox(value, selected.filePath); return { cancelled: false, message: '箱子数据已导出' }
  })
  ipcMain.handle(saveChannels.addCatalogItem, (_event, payload: unknown) => service.addCatalogItem(saveCatalogItemSchema.parse(payload)))
  ipcMain.handle(saveChannels.addCatalogEquipment, (_event, payload: unknown) => service.addCatalogEquipment(saveCatalogEquipmentSchema.parse(payload)))
  ipcMain.handle(saveChannels.previewLoadoutWrite, (_event, payload: unknown) => service.previewLoadoutWrite(saveLoadoutPreviewSchema.parse(payload)))
  ipcMain.handle(saveChannels.addLoadout, (_event, payload: unknown) => service.addLoadout(saveLoadoutWriteSchema.parse(payload)))

  return {
    confirmWindowClose(window) {
      const snapshot = service.snapshot()
      if (!snapshot) return true
      const buttons = snapshot.dirty ? ['取消', '保存并退出', '放弃修改并退出'] : ['取消', '关闭存档并退出']
      const choice = dialog.showMessageBoxSync(window, {
        type: 'warning',
        title: snapshot.dirty ? '存档尚未保存' : '关闭存档会话',
        message: snapshot.dirty ? '当前存档还有未保存修改。' : '当前仍有一份已读取的存档。',
        detail: snapshot.dirty ? '可以先安全保存，也可以放弃内存中的修改后退出。' : '退出应用将关闭这次存档会话。',
        buttons,
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      if (choice === 0) return false
      try {
        if (snapshot.dirty && choice === 1) {
          const result = service.save(snapshot.sessionId, snapshot.revision)
          service.close(result.session.sessionId, false, result.session.revision)
        } else service.close(snapshot.sessionId, true, snapshot.revision)
        return true
      } catch (cause) {
        dialog.showErrorBox('无法关闭存档', cause instanceof Error ? cause.message : '保存或关闭存档失败')
        return false
      }
    },
    dispose() { unsubscribe(); for (const channel of Object.values(saveChannels)) { ipcMain.removeHandler(channel) }; service.dispose() },
  }
}
