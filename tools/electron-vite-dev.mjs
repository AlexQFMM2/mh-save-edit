#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { electronBinding } from './rebuild-electron-native.mjs'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_NO_ATTACH_CONSOLE

const args = process.argv.slice(2)
if (process.platform === 'linux' && args[0] === 'dev' && !args.includes('--noSandbox')) args.push('--noSandbox')

if (args[0] === 'dev' && !existsSync(electronBinding)) {
  console.info('[mh-save-edit] Preparing better-sqlite3 for Electron (first run only)…')
  const rebuild = spawnSync(process.execPath, [resolve('tools/rebuild-electron-native.mjs')], { cwd: process.cwd(), env, stdio: 'inherit' })
  if (rebuild.status !== 0) process.exit(rebuild.status ?? 1)
}
env.MH_SAVE_EDIT_SQLITE_BINDING = electronBinding

const electronVite = resolve('node_modules/electron-vite/bin/electron-vite.js')
const child = spawn(process.execPath, [electronVite, ...args], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})
