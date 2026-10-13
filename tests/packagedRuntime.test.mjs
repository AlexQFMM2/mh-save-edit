import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { verifyPackagedRuntime } from '../tools/runtime/verifyPackagedRuntime.mjs'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-runtime-copy-'))
  const source = path.join(root, 'source'), packaged = path.join(root, 'packaged')
  fs.mkdirSync(source); fs.mkdirSync(packaged)
  for (const name of ['mh3g.sqlite', 'mh4g.sqlite', 'mhgu.sqlite', 'mhp2g.sqlite', 'item-terminology.sqlite', 'mhp2g-save-profile.json']) {
    // These are synthetic bytes, not real SQLite/game data. The guard only
    // compares identity; the preceding runtime audit owns schema/evidence.
    const bytes = Buffer.from(`synthetic-${name}`)
    fs.writeFileSync(path.join(source, name), bytes)
    fs.writeFileSync(path.join(packaged, name), bytes)
  }
  return { root, source, packaged }
}

describe('packaged runtime identity guard', () => {
  it('checks all runtime data without loading an ABI-specific SQLite module', () => {
    const f = fixture()
    try { expect(verifyPackagedRuntime(f.source, f.packaged).files.map(row => row.name)).toEqual(['mh3g.sqlite', 'mh4g.sqlite', 'mhgu.sqlite', 'mhp2g.sqlite', 'item-terminology.sqlite', 'mhp2g-save-profile.json']) }
    finally { fs.rmSync(f.root, { recursive: true, force: true }) }
  })
  it.each(['mhp2g.sqlite', 'item-terminology.sqlite', 'mhp2g-save-profile.json'])('rejects missing or stale %s', name => {
    const f = fixture()
    try {
      fs.appendFileSync(path.join(f.packaged, name), 'stale')
      expect(() => verifyPackagedRuntime(f.source, f.packaged)).toThrow(/differs/)
      fs.unlinkSync(path.join(f.packaged, name))
      expect(() => verifyPackagedRuntime(f.source, f.packaged)).toThrow(/ENOENT/)
    } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
  })
  it('rejects development report bytes even in otherwise identical assets', () => {
    const f = fixture()
    try {
      for (const folder of [f.source, f.packaged]) fs.appendFileSync(path.join(folder, 'mh4g.sqlite'), '"initialState"')
      expect(() => verifyPackagedRuntime(f.source, f.packaged)).toThrow(/development report bytes/)
    } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
  })
  it.each(['source', 'packaged'])('rejects a live WAL or unexpected SQLite in %s', location => {
    const f = fixture()
    try {
      const wal = path.join(f[location], 'mhgu.sqlite-wal')
      fs.writeFileSync(wal, 'synthetic-live-wal')
      expect(() => verifyPackagedRuntime(f.source, f.packaged)).toThrow(/live WAL/)
      fs.unlinkSync(wal)
      fs.writeFileSync(path.join(f[location], 'unexpected-state.sqlite'), 'synthetic-state')
      expect(() => verifyPackagedRuntime(f.source, f.packaged)).toThrow(/Unexpected SQLite/)
    } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
  })
  it.each(['stale', 'missing', 'same-directory'])('rejects a %s output', kind => {
    const f = fixture()
    try {
      if (kind === 'stale') fs.appendFileSync(path.join(f.packaged, 'mhgu.sqlite'), 'old')
      if (kind === 'missing') fs.unlinkSync(path.join(f.packaged, 'mh4g.sqlite'))
      expect(() => verifyPackagedRuntime(f.source, kind === 'same-directory' ? f.source : f.packaged)).toThrow(kind === 'stale' ? /differs/ : kind === 'missing' ? /ENOENT/ : /separate/)
    } finally { fs.rmSync(f.root, { recursive: true, force: true }) }
  })
})
