import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
export const target = Object.freeze({ identity: 'weapon_blademaster:28', table: 3, index: 28 })
export const replacement = 'P2G-BONE-BLADE-PROBE-OK'
const bootHash = '3c221249fcc1c3455ea8aff372993cb78a88ad90bde03a07c3da6974c2bcc846'
const expectedPrologue = [0x27bdffe0, 0xafbf000c, 0xafb10008, 0x00c08821, 0x0e2144eb, 0xafb00004, 0x00408021, 0x3223ffff]

/** Read frozen files only. No SSH, emulator or new capture is part of a build. */
export function verifyEquipmentEvidence({ nativeDirectory, localizationDirectory, liveFile, disassemblyFile }) {
  const nativeFile = path.join(nativeDirectory, 'texts.json')
  const nativeBytes = fs.readFileSync(nativeFile), nativeManifest = readJson(path.join(nativeDirectory, 'manifest.json'))
  assert.equal(nativeManifest.schema, 'mhp2g-japanese-catalog-source-v1')
  assert.equal(nativeManifest.files['texts.json'].sha256, sha256(nativeBytes), 'Native snapshot hash mismatch')
  assert.equal(nativeManifest.files['texts.json'].bytes, nativeBytes.length, 'Native snapshot size mismatch')
  const native = JSON.parse(nativeBytes)
  assert.equal(native.boot.sha256, bootHash, 'Unsupported executable version')
  assert.equal(native.isoSha256, nativeManifest.isoSha256, 'ISO provenance mismatch')
  assert.equal(native.expandedFilesMatchRelevantIsoRanges, true, 'Native extraction not verified')
  assert.equal(native.textContainer.member, 15)
  assert.equal(native.textContainer.tableCount, 23)
  assert.equal(native.textContainer.paddedBytes, 536576)
  const tables = native.tables.filter(t => t.tableId === target.table)
  assert.equal(tables.length, 1, 'Missing/duplicate target table')
  const rows = tables[0].rows.filter(r => r.index === target.index)
  assert.equal(rows.length, 1, 'Missing/duplicate native target')
  const row = rows[0], original = Buffer.from(row.text, 'utf8')
  assert(original.length > 0 && original.length < 256 && !original.includes(0), 'Invalid source text')
  const localizationFile = path.join(localizationDirectory, 'localization.json')
  const localizationBytes = fs.readFileSync(localizationFile), localizationManifest = readJson(path.join(localizationDirectory, 'manifest.json'))
  assert.equal(localizationManifest.outputs['localization.json'], sha256(localizationBytes), 'Localization hash mismatch')
  assert(localizationManifest.inputs.some(input => input.sha256 === sha256(nativeBytes) && path.basename(input.path) === 'texts.json'), 'Localization uses different native input')
  const localization = JSON.parse(localizationBytes)
  assert.equal(localization.schema, 'mhp2g-catalog-localization-v1')
  assert.equal(localization.bindings[target.identity]?.kind, 'weapon')
  assert.equal(localization.bindings[target.identity]?.name, `${target.table}:${target.index}`, 'Wrong equipment binding')
  assert.equal(localization.units[`${target.table}:${target.index}`]?.japanese, row.text, 'Wrong original text')
  const live = readJson(liveFile), disassembly = readJson(disassemblyFile)
  assert.equal(live.table, target.table); assert.equal(live.index, target.index)
  assert.equal(live.text, row.text); assert.equal(live.hex, original.toString('hex'), 'Runtime bytes mismatch')
  assert.equal(Number(live.base), 0x089c7510)
  assert(Number.isInteger(row.pointer) && row.pointer >= 0 && row.pointer + original.length + 1 <= 536576)
  assert.equal(Number(live.address), Number(live.base) + row.pointer, 'Runtime pointer mismatch')
  assert.equal(disassembly.range.start, 0x088513cc)
  const lines = disassembly.lines.slice(0, 8)
  assert.deepEqual(lines.map(x => x.encoding), expectedPrologue, 'Unverified query instructions')
  assert(lines.every((line, i) => line.address === 0x088513cc + 4*i && line.addressSize === 4), 'Noncontiguous instructions')
  const inputs = Object.fromEntries([nativeFile, path.join(nativeDirectory, 'manifest.json'), localizationFile,
    path.join(localizationDirectory, 'manifest.json'), liveFile, disassemblyFile].map(file => [path.resolve(file), sha256(fs.readFileSync(file))]))
  return { ...target, original: row.text, replacement, queryAddress: 0x088513cc, tableBase: Number(live.base),
    tableBytes: 536576, tableCount: 23, prologue: expectedPrologue, bootHash, isoHash: native.isoSha256, inputs }
}

export function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i=0; i<8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
export function encodeConfig({ table, index, original, replacement: marker }, mode) {
  assert(mode === 0 || mode === 1)
  assert(Number.isInteger(table) && table >= 0 && table < 23 && Number.isInteger(index) && index >= 0 && index <= 65535)
  const a = Buffer.from(original), b = Buffer.from(marker)
  assert(a.length && a.length < 256 && !a.includes(0), 'Invalid original length/NUL')
  assert(b.length && b.length < 256 && [...b].every(n => n >= 32 && n <= 126), 'Invalid ASCII marker')
  const payload = Buffer.concat([a, Buffer.from([0]), b, Buffer.from([0])]), header = Buffer.alloc(28)
  header.write('HPR1'); [mode, table, index, a.length, b.length, crc32(payload)].forEach((n,i) => header.writeUInt32LE(n,4+i*4))
  return Buffer.concat([header,payload])
}

export function profileHeader(profile) {
  assert(/^[a-zA-Z0-9_-]{1,80}$/.test(profile.buildId), 'Invalid build ID')
  const word = n => { assert(Number.isInteger(n) && n >= 0 && n <= 0xffffffff); return `0x${n.toString(16)}u` }
  return `/* Generated from verified private evidence. */\n#define PROBE_BUILD_ID "${profile.buildId}"\n` +
    Object.entries({ MODE: profile.mode, TABLE: profile.table, INDEX: profile.index, CONFIG_CRC: profile.configCrc,
      QUERY_ADDRESS: profile.queryAddress, TABLE_BASE: profile.tableBase, TABLE_BYTES: profile.tableBytes,
      TABLE_COUNT: profile.tableCount }).map(([k,v]) => `#define PROBE_${k} ${word(v)}\n`).join('') +
    `#define PROBE_PROLOGUE { ${profile.prologue.map(word).join(', ')} }\n`
}
