import crypto from 'node:crypto'
import fs from 'node:fs'
export const R9_SHA256 = '562516b93cd5efc5502dc5fba0961a8605ed6066db463dedc82a7888aa61291b'
export const SCHEMA_VERSION = 'mhp2g-items-v1'
export const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
export function verifySource(file, expected = R9_SHA256) {
  if (sha256(file) !== expected) throw new Error('P2G r9 source fingerprint mismatch')
}
export function wikiMetadata(key, extra = {}) {
  return { evidence: '日文 Wiki 历史镜像；未验证游戏运行条件', sourceKey: key, ...extra }
}
