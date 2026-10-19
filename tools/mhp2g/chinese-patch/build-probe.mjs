#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { crc32, profileHeader } from './equipment-evidence.mjs'

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prx')
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

/** Build in a new private directory; never leave ELF/object files beside source. */
export function buildProbe({ toolchain, output, hookConfig, equipmentProfile }) {
  toolchain = path.resolve(toolchain)
  output = path.resolve(output)
  assert(!fs.existsSync(output), 'Output exists; use a new version directory')
  assert(fs.existsSync(path.join(toolchain, 'bin/psp-gcc')), 'Missing PSPDev toolchain')
  const env = { ...process.env, PSPDEV: toolchain, PATH: `${toolchain}/bin:${process.env.PATH}` }
  const compiler = spawnSync('psp-gcc', ['--version'], { env, encoding: 'utf8' })
  assert.equal(compiler.status, 0, compiler.stderr)
  const temporary = fs.mkdtempSync(path.join(path.dirname(output), '.p2g-probe-'))
  try {
    const build = path.join(temporary, 'build')
    fs.mkdirSync(build)
    const sources = equipmentProfile
      ? ['equipment_main.c', 'equipment_hook.c', 'equipment_hook.h', 'probe_core.c', 'probe_core.h', 'probe_log.c', 'probe_log.h', 'Makefile']
      : ['main.c', 'Makefile', ...(hookConfig ? ['hook_probe.c', 'hook_probe.h'] : [])]
    for (const name of sources) fs.copyFileSync(path.join(source, name), path.join(build, name))
    if (equipmentProfile) {
      assert(hookConfig && crc32(fs.readFileSync(hookConfig)) === equipmentProfile.configCrc, 'Configuration/profile mismatch')
      fs.writeFileSync(path.join(build, 'probe_profile.h'), profileHeader(equipmentProfile))
    }
    const result = spawnSync('make', ['-C', build, ...(equipmentProfile ? ['EQUIPMENT_PROBE=1'] : hookConfig ? ['HOOK_PROBE=1'] : [])], { env, encoding: 'utf8' })
    fs.writeFileSync(path.join(temporary, 'build.log'), result.stdout + result.stderr)
    assert.equal(result.status, 0, `PRX build failed: ${result.stderr}`)
    const plugin = path.join(temporary, 'PSP/PLUGINS/mhp2g_zh_cn')
    fs.mkdirSync(plugin, { recursive: true })
    fs.copyFileSync(path.join(build, 'mhp2g_zh_cn.prx'), path.join(plugin, 'mhp2g_zh_cn.prx'))
    fs.copyFileSync(path.join(source, 'plugin.ini'), path.join(plugin, 'plugin.ini'))
    fs.writeFileSync(path.join(plugin, 'probe.txt'), 'mhp2g-zh-pilot-v1\r\n')
    if (hookConfig) fs.copyFileSync(hookConfig, path.join(plugin, 'hook-probe.bin'))
    const manifest = {
      schema: 'mhp2g-plugin-probe-build-v1',
      purpose: hookConfig ? 'Development single-entry text hook experiment; no Chinese font/package' : 'Load/file-access probe only; no game patches or Chinese text',
      compiler: compiler.stdout.trim(),
      sources: Object.fromEntries([...sources, 'plugin.ini'].map(name => [name, digest(path.join(source, name))])),
      files: Object.fromEntries(fs.readdirSync(plugin).map(name => [name, { sha256: digest(path.join(plugin, name)), bytes: fs.statSync(path.join(plugin, name)).size }])),
      ...(equipmentProfile ? { probe: { format: 1, buildId: equipmentProfile.buildId, mode: equipmentProfile.mode,
        table: equipmentProfile.table, index: equipmentProfile.index }, generatedProfileSha256: digest(path.join(build, 'probe_profile.h')) } : {}),
    }
    fs.writeFileSync(path.join(temporary, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    fs.renameSync(temporary, output)
    return manifest
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [toolchain, output, hookConfig] = process.argv.slice(2)
  assert(toolchain && output, 'Usage: build-probe.mjs <pspdev-directory> <new-private-output-directory> [development-hook-config]')
  console.log(JSON.stringify(buildProbe({ toolchain, output, hookConfig }), null, 2))
}
