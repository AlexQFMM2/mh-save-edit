import type { LoadoutCharm, LoadoutIssue } from './types'
import type { Mh4gAppraisalGroup, Mh4gCharmNativeInput } from './mh4gCharmTypes'

export type Mh4gAppraisalCheck = {
  status: 'satisfied' | 'invalid' | 'unknown'
  issues: LoadoutIssue[]
  source?: string
  fulfillment?: number
  row?: number
  derivedClassId?: number | null
  allowedSlots?: number[]
}

/** Mirrors the reviewed VFP order; do NOT replace with rational/double arithmetic. */
export function mh4gFulfillment(contributions: { points: number; maxPoints: number }[]): { value: number; row: number } {
  const f32 = Math.fround
  let value = f32(0)
  for (const { points, maxPoints } of contributions) {
    if (!Number.isInteger(points) || !Number.isInteger(maxPoints) || maxPoints <= 0) throw new Error('Invalid MH4G fulfillment input')
    const contribution = points < 0 ? f32(0) : f32(f32(points) / f32(f32(maxPoints) * f32(0.1)))
    value = f32(value + contribution)
  }
  value = Math.min(20, Math.max(0, value))
  return { value, row: Math.trunc(value) }
}

export function mh4gClassFor(group: Mh4gAppraisalGroup, fulfillment: number, slots: number): number | null {
  const score = Math.fround(Math.fround(fulfillment) + Math.fround(2 * slots))
  return group.classes.find(band => score >= band.minScore && (band.maxScore == null || score < band.maxScore))?.classId ?? null
}

/** Checks constraints of one reviewed path, not all possible acquisition routes. */
export function checkMh4gAppraisal(native: Mh4gCharmNativeInput | undefined, charm: Pick<LoadoutCharm, 'classId' | 'slots' | 'skill1' | 'skill2'>): Mh4gAppraisalCheck {
  if (!native) return { status: 'unknown', issues: [] }
  const group = native.groups.find(value => value.classes.some(band => band.classId === charm.classId))
  const source = `mh4g-native-appraisal:${native.source.expandedSha256}`
  if (!group) return { status: 'unknown', source, issues: [] }
  const issues: LoadoutIssue[] = []
  const warn = (code: string, path: string, message: string) => issues.push({ code, path, severity: 'warning', message, source })
  if (!Number.isInteger(charm.slots) || charm.slots < 0 || charm.slots > 3) warn('charm.slots.encoding', 'charm.slots', '护石孔位必须为 0～3')
  if (!charm.skill1) warn('charm.mh4g.first.required', 'charm.skill1', '已审计的 4G 鉴定路径必须生成非零 A 技能')
  const contributions: { points: number; maxPoints: number }[] = []
  for (const [position, skill, path] of [['A', charm.skill1, 'charm.skill1'], ['B', charm.skill2, 'charm.skill2']] as const) {
    if (!skill) continue
    const range = group.pools[position].rows.find(row => row[0] === skill.skillId)
    if (!range) {
      warn('charm.mh4g.skill.pool', `${path}.skillId`, `${position} 技能不属于此来源的已审计技能池`)
      continue
    }
    if (!Number.isInteger(skill.points) || skill.points < range[1] || skill.points > range[2]) {
      warn('charm.skill.non-natural', `${path}.points`, `${position} 技能点超出范围 ${range[1]}～${range[2]}`)
      continue
    }
    if (skill.points === 0) {
      warn('charm.mh4g.skill.zero', `${path}.points`, `${position} 技能点为 0 时，原生鉴定会清空该技能`)
      continue
    }
    contributions.push({ points: skill.points, maxPoints: range[2] })
  }
  if (charm.skill1 && charm.skill2 && charm.skill1.skillId === charm.skill2.skillId) warn('charm.skill.duplicate', 'charm.skill2', '原生鉴定遇到相同 A/B 技能时会清除 B 技能，不会保留双份')
  // Do not blame slots/grade or the other skill when a skill itself is invalid.
  if (issues.length) return { status: 'invalid', issues, source }
  const fulfillment = mh4gFulfillment(contributions)
  const weights = group.slotWeights[fulfillment.row]
  if (!weights || weights.length !== 4) return { status: 'unknown', issues: [], source }
  const allowedSlots = weights.flatMap((weight, slots) => weight > 0 && mh4gClassFor(group, fulfillment.value, slots) === charm.classId ? [slots] : [])
  const derivedClassId = mh4gClassFor(group, fulfillment.value, charm.slots)
  if (weights[charm.slots] <= 0) warn('charm.mh4g.slots.weight', 'charm.slots', '此技能充足度下，所选孔数的原生鉴定权重为 0')
  if (derivedClassId !== charm.classId) warn('charm.mh4g.class.score', 'charm.classId', `按技能充足度和孔数，已审计路径会生成品级 ID ${derivedClassId ?? '未知'}，而非当前品级`)
  return { status: issues.length ? 'invalid' : 'satisfied', issues, source, fulfillment: fulfillment.value, row: fulfillment.row, derivedClassId, allowedSlots }
}

/** Both hand validation and automatic generation must keep this evidence gate. */
export function mh4gAutomaticEvidenceWarning(native: Mh4gCharmNativeInput | undefined): string {
  return native
    ? '4G 护石原生静态约束已接入，但生成可达性和运行时浮点状态仍待复核；未自动生成未证实护石，可显式固定已有护石。'
    : '4G 护石原生联合规则资料缺失；未自动生成未证实护石，可显式固定已有护石。'
}
