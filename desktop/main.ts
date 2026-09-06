import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
function createWindow() { const window = new BrowserWindow({ width: 1280, height: 820, minWidth: 1040, minHeight: 680, backgroundColor: '#101827', webPreferences: { preload: join(__dirname, '../preload/index.mjs'), contextIsolation: true, sandbox: true, nodeIntegration: false } }); if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL); else window.loadFile(join(__dirname, '../renderer/index.html')) }
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() }) })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
