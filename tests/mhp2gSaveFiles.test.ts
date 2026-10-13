import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { P2gSaveFiles } from '../api/save/p2g/files'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const old = { bin: Buffer.from('synthetic old bin'), sfo: Buffer.from('synthetic old sfo') }
const next = { bin: Buffer.from('synthetic new bin'), sfo: Buffer.from('synthetic new sfo') }
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'p2g-pair-test-')); roots.push(root)
  const dir = join(root, 'original'); mkdirSync(dir)
  writeFileSync(join(dir, 'MHP2NDG.BIN'), old.bin); writeFileSync(join(dir, 'PARAM.SFO'), old.sfo); writeFileSync(join(dir, 'ICON0.PNG'), 'synthetic icon')
  return { root, dir, files: new P2gSaveFiles(join(dir, 'MHP2NDG.BIN')) }
}
const read = (dir: string) => ({ bin: readFileSync(join(dir, 'MHP2NDG.BIN')), sfo: readFileSync(join(dir, 'PARAM.SFO')) })
function pending(dir: string) {
  const journal = join(dir, '.mhp2g-save-pending'); mkdirSync(journal)
  for (const [name, before, after] of [['MHP2NDG.BIN', old.bin, next.bin], ['PARAM.SFO', old.sfo, next.sfo]] as const) { writeFileSync(join(journal, `${name}.before`), before); writeFileSync(join(journal, `${name}.after`), after) }
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex')
  writeFileSync(join(journal, 'journal.json'), JSON.stringify({ before: [old.bin, old.sfo].map(hash), after: [next.bin, next.sfo].map(hash) }))
}
describe('P2G two-file persistence', () => {
  test('rejects external SFO edits without writing BIN or creating a backup', () => {
    const { dir, files } = fixture(); writeFileSync(join(dir, 'PARAM.SFO'), 'external SFO')
    expect(() => files.save(next, () => {})).toThrow(/外部修改/)
    expect(read(dir).bin).toEqual(old.bin); expect(read(dir).sfo.toString()).toBe('external SFO')
    expect(readdirSync(dir).filter(n => n.includes('backup'))).toEqual([])
  })
  test('backs up complete source; restores both files after failure between writes', () => {
    const { dir, files } = fixture()
    expect(() => files.save(next, () => {}, undefined, i => { if (i === 0) throw new Error('injected disk failure') })).toThrow(/injected/)
    expect(read(dir)).toEqual(old)
    const backup = readdirSync(dir).find(n => n.startsWith('.mhp2g-backup-'))!
    expect(read(join(dir, backup))).toEqual(old); expect(readFileSync(join(dir, backup, 'ICON0.PNG'), 'utf8')).toBe('synthetic icon')
    expect(existsSync(join(dir, '.mhp2g-save-pending'))).toBe(false)
    files.save(next, actual => expect(actual).toEqual(next)); expect(read(dir)).toEqual(next)
  })
  test('recovers an interrupted save on reopen, but never clobbers externally changed files', () => {
    const { dir } = fixture(); pending(dir); writeFileSync(join(dir, 'MHP2NDG.BIN'), next.bin)
    expect(new P2gSaveFiles(join(dir, 'MHP2NDG.BIN')).pair).toEqual(old)
    pending(dir); writeFileSync(join(dir, 'PARAM.SFO'), 'external')
    expect(() => new P2gSaveFiles(join(dir, 'MHP2NDG.BIN'))).toThrow(/恢复记录/)
    expect(read(dir).sfo.toString()).toBe('external'); expect(existsSync(join(dir, '.mhp2g-save-pending'))).toBe(true)
  })
  test('stops if another writer changes SFO between the two writes; keeps recovery evidence', () => {
    const { dir, files } = fixture()
    expect(() => files.save(next, () => {}, undefined, i => { if (i === 0) writeFileSync(join(dir, 'PARAM.SFO'), 'external during write') })).toThrow(/外部修改/)
    expect(read(dir).sfo.toString()).toBe('external during write')
    expect(existsSync(join(dir, '.mhp2g-save-pending'))).toBe(true)
  })
  test('save as produces complete directory, rejects occupied destination, leaves original intact', () => {
    const { root, dir, files } = fixture(), destination = join(root, 'ULJM05500')
    const output = files.save(next, actual => expect(actual).toEqual(next), join(destination, 'MHP2NDG.BIN'))
    expect(output.files.pair).toEqual(next); expect(read(dir)).toEqual(old)
    expect(readFileSync(join(destination, 'ICON0.PNG'), 'utf8')).toBe('synthetic icon')
    expect(() => files.save(old, () => {}, join(destination, 'MHP2NDG.BIN'))).toThrow(/已存在/)
    expect(read(destination)).toEqual(next)
  })
  test('save as refuses the source directory instead of silently saving over the original', () => {
    const { dir, files } = fixture()
    expect(() => files.save(next, () => {}, join(dir, 'MHP2NDG.BIN'))).toThrow(/已存在/)
    expect(read(dir)).toEqual(old)
    expect(readdirSync(dir).some(name => name.startsWith('.mhp2g-'))).toBe(false)
  })
})
