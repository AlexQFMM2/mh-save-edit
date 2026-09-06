import { contextBridge } from 'electron'
contextBridge.exposeInMainWorld('mhSaveEditor', { version: '0.1.0' })
