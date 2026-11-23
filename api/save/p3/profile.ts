import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { pspProfileSchema, verifyPspTables } from '../p2g/profile'

const p3ProfileSchema = pspProfileSchema.extend({
  gameId: z.literal('mhp3'),
  armorCaps: z.record(z.string().regex(/^mhp3:armor:[0-4]:[1-9]\d*$/), z.number().int().min(0).max(63)),
})

export type P3SaveProfile = z.output<typeof p3ProfileSchema>

export function readP3SaveProfile(dataDir: string): P3SaveProfile {
  let input: unknown
  try { input = JSON.parse(readFileSync(join(dataDir, 'mhp3-save-profile.json'), 'utf8')) }
  catch { throw new Error('缺少或无法读取 P3 存档格式资源，请安装配套本地资料') }
  const profile = p3ProfileSchema.safeParse(input)
  if (!profile.success) throw new Error('P3 存档格式资源无效')
  verifyPspTables(profile.data, 'P3')
  return profile.data
}
