#!/usr/bin/env node
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const projectRoot = resolve(import.meta.dirname, '..')
const electronVersion = require('electron/package.json').version
const betterSqliteRoot = dirname(require.resolve('better-sqlite3/package.json'))
const sourceBinding = join(betterSqliteRoot, 'build', 'Release', 'better_sqlite3.node')
export const electronBinding = join(projectRoot, '.electron-native', `better_sqlite3-electron-${electronVersion}-${process.platform}-${process.arch}.node`)

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function rebuild(extraEnv) {
  const result = spawnSync(pnpm, ['rebuild', 'better-sqlite3'], {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  rebuild({
    npm_config_runtime: 'electron',
    npm_config_target: electronVersion,
    npm_config_disturl: 'https://electronjs.org/headers',
    npm_config_build_from_source: 'true',
  })
  mkdirSync(dirname(electronBinding), { recursive: true })
  copyFileSync(sourceBinding, electronBinding)

  const nodeEnv = { ...process.env }
  delete nodeEnv.npm_config_runtime
  delete nodeEnv.npm_config_target
  delete nodeEnv.npm_config_disturl
  delete nodeEnv.npm_config_build_from_source
  const restore = spawnSync(pnpm, ['rebuild', 'better-sqlite3'], {
    cwd: projectRoot,
    env: nodeEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (restore.status !== 0) process.exit(restore.status ?? 1)
  console.info(`[mh-save-edit] Electron SQLite binding ready: ${electronBinding}`)
}
