import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

// Values are supplied by the versioned runtime asset, never by the save file.
const hex = (bytes: number) => z.string().regex(new RegExp(`^[0-9a-f]{${bytes * 2}}$`)).transform(value => Buffer.from(value, 'hex'))
export const p2gProfileSchema = z.object({
  version: z.literal(1), encode: hex(256), decode: hex(256), salt: hex(20),
  multipliers: z.tuple([z.number().int().min(1).max(65535), z.number().int().min(1).max(65535)]),
  moduli: z.tuple([z.number().int().min(1).max(65536), z.number().int().min(1).max(65536)]),
  gameKey: hex(16), hashKey: hex(16), macKey: hex(16), sfoKey: hex(16),
  cipherMask1: hex(16), cipherMask2: hex(16), headerKey: hex(16), streamKey: hex(16),
  rankGates: z.array(z.object({ bit: z.number().int().min(0).max(511), rank: z.number().int().min(2).max(9) })).length(8),
}).strict()
export type P2gProfile = z.output<typeof p2gProfileSchema>
export function readP2gProfile(dataDir: string): P2gProfile {
  let input: unknown
  try { input = JSON.parse(readFileSync(join(dataDir, 'mhp2g-save-profile.json'), 'utf8')) }
  catch { throw new Error('缺少 P2G 存档格式资源，请完整解压新版应用或安装配套运行资源') }
  const profile = p2gProfileSchema.parse(input)
  if (new Set(profile.encode).size !== 256 || profile.encode.some((v, i) => profile.decode[v] !== i)) throw new Error('P2G 存档替换表不匹配')
  return profile
}
