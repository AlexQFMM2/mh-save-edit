import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { crc32 } from './equipment-evidence.mjs'

export const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const decoder = new TextDecoder('utf-8', { fatal: true })
export const nativeKey = row => `${row.member}:${row.table}:${row.index}`
export const BATCH_MAX_ROWS = 32768
export const BATCH_MAX_BYTES = 4 * 1024 * 1024
// Quest rows identify a physical record and one of its six text fields. The
// flag stores the native quest ID, not an NPC pagination flag.
export const questIdentity = row => row.member >= 4759 && row.member <= 5322 &&
  row.table % 4 === 0 && row.table + 48 <= row.resourceBytes && row.index < 6 && row.flag <= 65535
export const batchIdentity = row => (row.member === 15 && row.table < 19 && row.flag === 0) ||
  ([4756,4757,4758].includes(row.member) && row.table < (row.member===4756?2:row.member===4757?4:1) && row.flag===0) ||
  questIdentity(row) ||
  ([5369,5370,5371,5372].includes(row.member) && row.table < 100 && row.flag <= 2)

export function validateText(original, translated, {batch = false} = {}) {
  for (const text of [original, translated]) {
    assert(typeof text === 'string' && text.length && !text.includes('\0'), 'Empty text or embedded NUL')
    assert(!text.includes('\\n') && !text.includes('\r'), 'Use actual LF, not literal escaped newline')
    assert(!/[\u0001-\u0009\u000b-\u001f\u007f]/u.test(text), 'Unsupported control character')
    assert.equal(decoder.decode(Buffer.from(text)), text, 'Invalid Unicode')
    assert([...text].every(c => c.codePointAt(0) < 0xfff0 && !(c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff)), 'Unsupported game character')
  }
  const token = batch
    ? /~(?:[A-Z][0-9A-F]{2}|[0-9A-F]{2}|C%[-+ #0]*\d*(?:\.\d+)?[a-zA-Z])|%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[a-zA-Z%]|\$/g
    : /~[A-Z][0-9A-F]{2}|%(?:\d+\$)?[-+ #0]*\d*(?:\.\d+)?[a-zA-Z%]|\$/g
  const controls = text => text.match(token) ?? []
  assert.deepEqual(controls(translated), controls(original), 'Changed control sequence')
  for (const text of [original, translated]) assert(!text.replace(token, '').includes('~'), 'Unknown control code')
  assert.equal(translated.split('\n').length, original.split('\n').length, 'Changed explicit line count')
}

export function validateRows(rows, {batch = false} = {}) {
  assert(Array.isArray(rows) && rows.length > 0 && rows.length <= (batch?BATCH_MAX_ROWS:128), 'Invalid entry count')
  const keys = new Set()
  for (const row of rows) {
    for (const field of ['member', 'table', 'index', 'offset', 'resourceBytes', 'flag']) {
      assert(Number.isInteger(row[field]) && row[field] >= 0 && row[field] <= 0xffffffff, `Invalid ${field}`)
    }
    assert(!keys.has(nativeKey(row)), 'Duplicate native key'); keys.add(nativeKey(row))
    validateText(row.original, row.translated, {batch})
    assert.equal(hash(Buffer.from(row.original)), row.sourceSha256, 'Stale source hash')
    assert(row.basis?.trim(), 'Missing translation basis')
    assert(row.offset + Buffer.byteLength(row.original) + 1 <= row.resourceBytes, 'Source exceeds resource')
    assert(Buffer.byteLength(row.translated) <= 4096, 'Text exceeds package safety limit')
    assert(batch ? batchIdentity(row) && row.index < 65535 : (row.member === 15 && row.table < 23 && row.index < 65535 && row.flag === 0) ||
      (row.member === 5370 && row.table === 8 && row.index >= 86 && row.index <= 90 && row.flag === (row.index === 90 ? 0 : 2)), 'Unsupported pilot identity')
  }
  return [...rows].sort((a, b) => a.member - b.member || a.table - b.table || a.index - b.index)
}

export function encodeTextPackage(rows, {batch = false} = {}) {
  rows = validateRows(rows, {batch})
  const start = 32 + rows.length * 40, chunks = [], entries = Buffer.alloc(rows.length * 40)
  let offset = start
  for (const [index, row] of rows.entries()) {
    const original = Buffer.from(row.original), translated = Buffer.from(row.translated)
    const values = [row.member, row.table, row.index, row.offset, offset, original.length,
      offset + original.length + 1, translated.length, row.flag, row.resourceBytes]
    values.forEach((n, i) => entries.writeUInt32LE(n, index * 40 + i * 4))
    chunks.push(original, Buffer.from([0]), translated, Buffer.from([0]))
    offset += original.length + translated.length + 2
  }
  assert(offset <= (batch?BATCH_MAX_BYTES:128*1024), 'Text package exceeds build budget')
  const body = Buffer.concat([entries, ...chunks]), header = Buffer.alloc(32)
  header.write(batch?'PZT2':'PZT1')
  ;[batch?2:1, offset, rows.length, 32, start, crc32(body), 0].forEach((n, i) => header.writeUInt32LE(n, 4 + i * 4))
  return Buffer.concat([header, body])
}

export function decodeTextPackage(bytes) {
  assert(bytes.length >= 32 && ['PZT1','PZT2'].includes(bytes.subarray(0, 4).toString()), 'Bad text header')
  const batch = bytes.subarray(0,4).toString()==='PZT2'
  const [version, total, count, entries, strings, crc, reserved] = Array.from({ length: 7 }, (_, i) => bytes.readUInt32LE(4 + i * 4))
  assert(version === (batch?2:1) && total === bytes.length && total <= (batch?BATCH_MAX_BYTES:128*1024) && count > 0 && count <= (batch?BATCH_MAX_ROWS:128) && entries === 32 && strings === 32 + count * 40 && strings < total && reserved === 0, 'Invalid text structure')
  assert.equal(crc32(bytes.subarray(32)), crc, 'Text CRC mismatch')
  let cursor = strings
  const rows = []
  for (let i = 0; i < count; i++) {
    const [member, table, index, offset, a, al, b, bl, flag, resourceBytes] = Array.from({ length: 10 }, (_, n) => bytes.readUInt32LE(32 + i * 40 + n * 4))
    assert(a === cursor && b === a + al + 1 && al > 0 && bl > 0 && b + bl < total && bytes[a + al] === 0 && bytes[b + bl] === 0, 'Invalid text span')
    const original = decoder.decode(bytes.subarray(a, a + al)), translated = decoder.decode(bytes.subarray(b, b + bl))
    rows.push({ member, table, index, offset, flag, resourceBytes, original, translated, sourceSha256: hash(Buffer.from(original)), basis: 'Package roundtrip' })
    cursor = b + bl + 1
  }
  assert.equal(cursor, total, 'Trailing text data')
  validateRows(rows, {batch})
  assert.deepEqual(rows.map(nativeKey), validateRows(rows, {batch}).map(nativeKey), 'Unsorted entries')
  return rows
}

export function fontCharacters(rows) {
  const text = rows.map(row => row.translated.replace(/~[A-Z][0-9A-F]{2}/g, '')).join('')
  return [...new Set([...text].filter(c => !/\s/u.test(c)).map(c => c.codePointAt(0)))].sort((a, b) => a - b)
}
