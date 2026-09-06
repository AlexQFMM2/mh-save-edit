import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerCatalogIpc, resolveCatalogDataDir } from '../api/catalog/ipc'
function createWindow() { const window = new BrowserWindow({ width: 1280, height: 820, minWidth: 1040, minHeight: 680, backgroundColor: '#101827', webPreferences: { preload: join(__dirname, '../preload/preload.cjs'), contextIsolation: true, nodeIntegration: false } }); window.webContents.on('preload-error', (_event, preloadPath, error) => console.error(`[preload-error] ${preloadPath}`, error)); window.webContents.once('did-finish-load', () => { void window.webContents.executeJavaScript('Boolean(window.mhSaveEditor?.catalog)').then((ready) => console.info(`[preload] catalog bridge ${ready ? 'ready' : 'missing'}`)) }); if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL); else window.loadFile(join(__dirname, '../renderer/index.html')) }
let disposeCatalog: (() => void) | undefined
app.whenReady().then(() => { disposeCatalog = registerCatalogIpc(resolveCatalogDataDir(app.isPackaged, process.resourcesPath)); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() }) })
app.on('before-quit', () => disposeCatalog?.())
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
