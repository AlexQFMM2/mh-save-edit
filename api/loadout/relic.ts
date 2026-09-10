import type { LoadoutInstanceState, LoadoutIssue } from './types'

export const RELIC_RECORD_BYTES = 28
export const RELIC_RECORD_HEX_LENGTH = RELIC_RECORD_BYTES * 2

export function validateRelicRecordHex(recordHex: string): LoadoutIssue[] {
  if (!/^[0-9a-fA-F]*$/.test(recordHex)) return [{ code: 'relic.record.characters', path: 'instance.recordHex', severity: 'error', message: '原始记录只能包含十六进制字符' }]
  if (recordHex.length !== RELIC_RECORD_HEX_LENGTH) return [{ code: 'relic.record.length', path: 'instance.recordHex', severity: 'error', message: `原始记录必须恰好为 ${RELIC_RECORD_BYTES} 字节（${RELIC_RECORD_HEX_LENGTH} 字符）` }]
  return []
}

export function patchRelicByte(instance: LoadoutInstanceState, offset: number, value: number, mask = 0xff): LoadoutInstanceState {
  const recordIssues = validateRelicRecordHex(instance.recordHex)
  const retainedIssues = instance.issues.filter((issue) => !issue.code.startsWith('relic.patch.') && !issue.code.startsWith('relic.record.'))
  if (recordIssues.length || !Number.isInteger(offset) || offset < 0 || offset >= RELIC_RECORD_BYTES || !Number.isInteger(value) || value < 0 || value > 255) return { ...instance, encoding: 'blocked', issues: [...retainedIssues, ...recordIssues, { code: 'relic.patch.invalid', path: `instance.recordHex[${offset}]`, severity: 'error', message: '字段补丁超出可编码范围' }] }
  const bytes = Uint8Array.from(instance.recordHex.match(/../g)!.map(byte => Number.parseInt(byte, 16)))
  const before = bytes[offset]
  const after = (before & (~mask & 0xff)) | (value & mask)
  bytes[offset] = after
  const recordHex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const patches = [...(instance.patches ?? []).filter(patch => patch.offset !== offset), { offset, before, after }]
  return { ...instance, recordHex, patches, encoding: 'encodable', issues: retainedIssues }
}

export function patchRelicUint16(instance: LoadoutInstanceState, offset: number, value: number, mask = 0xffff): LoadoutInstanceState {
  const recordIssues = validateRelicRecordHex(instance.recordHex)
  const retainedIssues = instance.issues.filter((issue) => !issue.code.startsWith('relic.patch.') && !issue.code.startsWith('relic.record.'))
  if (recordIssues.length || !Number.isInteger(offset) || offset < 0 || offset + 1 >= RELIC_RECORD_BYTES || !Number.isInteger(value) || value < 0 || value > 0xffff) {
    return { ...instance, encoding: 'blocked', issues: [...retainedIssues, ...recordIssues, { code: 'relic.patch.invalid-u16', path: `instance.recordHex[${offset}]`, severity: 'error', message: '16 位字段补丁超出可编码范围' }] }
  }
  const bytes = Uint8Array.from(instance.recordHex.match(/../g)!.map(byte => Number.parseInt(byte, 16)))
  const beforeValue = bytes[offset] | (bytes[offset + 1] << 8)
  const afterValue = (beforeValue & (~mask & 0xffff)) | (value & mask)
  const first = patchRelicByte(instance, offset, afterValue & 0xff)
  return patchRelicByte(first, offset + 1, (afterValue >>> 8) & 0xff)
}

export function replaceRelicRecord(instance: LoadoutInstanceState, recordHex: string): LoadoutInstanceState {
  const issues = validateRelicRecordHex(recordHex)
  return { ...instance, recordHex: recordHex.toLowerCase(), encoding: issues.length ? 'blocked' : 'encodable', issues: [...instance.issues.filter(issue => !issue.code.startsWith('relic.record.') && !issue.code.startsWith('relic.patch.')), ...issues] }
}
