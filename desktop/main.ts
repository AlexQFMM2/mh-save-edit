import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerCatalogIpc, resolveCatalogDataDir } from '../api/catalog/ipc'
import { registerLoadoutIpc } from '../api/loadout/ipc'
import { registerSaveIpc, type RegisteredSaveIpc } from '../api/save/ipc'

function createWindow() {
  const icon = app.isPackaged
    ? join(process.resourcesPath, 'app-icon.ico')
    : join(process.cwd(), 'build', 'app-icon.ico')
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#21150f',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  window.on('close', (event) => { if (saveIpc && !saveIpc.confirmWindowClose(window)) event.preventDefault() })
  window.webContents.on('preload-error', (_event, preloadPath, error) => console.error(`[preload-error] ${preloadPath}`, error))
  window.webContents.once('did-finish-load', () => {
    void window.webContents.executeJavaScript('Boolean(window.mhSaveEditor?.catalog)').then((ready) => console.info(`[preload] catalog bridge ${ready ? 'ready' : 'missing'}`))
  })
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
}

let disposeCatalog: (() => void) | undefined
let disposeLoadout: (() => void) | undefined
let saveIpc: RegisteredSaveIpc | undefined
app.whenReady().then(() => { const dataDir = resolveCatalogDataDir(app.isPackaged, process.resourcesPath); disposeCatalog = registerCatalogIpc(dataDir); disposeLoadout = registerLoadoutIpc(dataDir, join(app.getPath('userData'), 'state')); saveIpc = registerSaveIpc(dataDir); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() }) })
// Keep the save service alive while BrowserWindow emits `close`; its dirty guard
// must run before IPC handlers and the in-memory document are disposed.
app.on('will-quit', () => { saveIpc?.dispose(); disposeLoadout?.(); disposeCatalog?.() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
