import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'desktop/main.ts'), 'auto-search-worker': resolve(__dirname, 'api/loadout/autoSearchWorker.ts') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'desktop/preload.ts') },
        output: { format: 'cjs', entryFileNames: 'preload.cjs' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'ui'),
    base: './',
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, 'ui/index.html') } },
  },
})
