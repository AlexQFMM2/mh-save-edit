import type { LoadoutCharm, LoadoutIssue, LoadoutSkillPoint } from './types'

/** Native P3 charm identification (overlay104:0x09dbb23c), shipped as compact
 * rule tables. The fully enumerated combination table is a private test oracle,
 * not a runtime asset. */
export type P3CharmSource = {
  sourceKey: string
  itemId: number
  labelJp: string
  skill1Pool: string
  skill2Pool: string | null
  secondSkillThreshold: number
  slotTableKey: string
  evidence: string
}

export type P3CharmSlotRow = { rank: number; slot: number; cumulative: number; width: number }
export type P3CharmGradeRule = { sourceKey: string; grade: number; minF: number; maxF: number; nameCn: string; nameJp: string }
export type P3CharmPoolRow = { skillId: number; min: number; max: number }
export type P3CharmPool = { poolKey: string; position: 'A' | 'B'; label: string; rows: P3CharmPoolRow[] }

export type P3CharmRules = {
  sources: P3CharmSource[]
  slotTables: Record<string, P3CharmSlotRow[]>
  grades: P3CharmGradeRule[]
  pools: Record<string, P3CharmPool>
  rankScale: number
  rankMax: number
}

export const P3_CHARM_RANK_SCALE = 0.1
export const P3_CHARM_RANK_MAX = 20
export const P3_CHARM_ENCODING = { gradeMin: 0, gradeMax: 6, slotsMax: 3, skillMin: 0, skillMax: 127, pointsMin: -30, pointsMax: 33 } as const
const ISSUE_SOURCE = 'mhp3:charm-generation'

export function p3CharmSlotRow(rules: P3CharmRules, sourceKey: string, rank: number): P3CharmSlotRow[] {
  return (rules.slotTables[sourceKey] ?? []).filter(row => row.rank === rank)
}

/** trunc(point1/(max1*0.1) + point2/(max2*0.1)); negative contributions do not count. */
export function p3CharmRank(points1: number, max1: number, points2: number, max2: number): number {
  let total = 0
  if (max1 > 0 && points1 > 0) total += points1 / (max1 * P3_CHARM_RANK_SCALE)
  if (max2 > 0 && points2 > 0) total += points2 / (max2 * P3_CHARM_RANK_SCALE)
  return Math.min(P3_CHARM_RANK_MAX, Math.max(0, Math.trunc(total)))
}

export function p3CharmSourceForGrade(rules: P3CharmRules, grade: number): P3CharmSource | undefined {
  const rule = rules.grades.find(value => value.grade === grade)
  return rule ? rules.sources.find(value => value.sourceKey === rule.sourceKey) : undefined
}

export type P3CharmCheck = {
  legality: 'confirmed' | 'invalid' | 'unknown'
  encoding: 'encodable' | 'blocked'
  issues: LoadoutIssue[]
  sourceKey?: string
  rank?: number
  /** f = rank + 2*slots */
  gradeValue?: number
}

function poolRow(rules: P3CharmRules, poolKey: string | null, skillId: number): P3CharmPoolRow | undefined {
  return poolKey ? rules.pools[poolKey]?.rows.find(row => row.skillId === skillId) : undefined
}

/** Exact membership check for a manually entered P3 charm; mirrors the 3G
 * confirmed/invalid contract instead of reporting "unknown". */
export function checkP3Charm(rules: P3CharmRules, charm: LoadoutCharm): P3CharmCheck {
  const issues: LoadoutIssue[] = []
  const add = (code: string, path: string, severity: LoadoutIssue['severity'], message: string) => issues.push({ code, path, severity, message, source: ISSUE_SOURCE })
  const { gradeMin, gradeMax, slotsMax, skillMin, skillMax, pointsMin, pointsMax } = P3_CHARM_ENCODING
  if (!Number.isInteger(charm.classId) || charm.classId < gradeMin || charm.classId > gradeMax) add('charm.class.encoding', 'charm.classId', 'error', '护石品级必须是 0～6')
  if (!Number.isInteger(charm.slots) || charm.slots < 0 || charm.slots > slotsMax) add('charm.slots.encoding', 'charm.slots', 'error', '护石孔位必须是 0～3')
  for (const [position, skill] of [['A', charm.skill1], ['B', charm.skill2]] as const) {
    if (!skill) continue
    if (!Number.isInteger(skill.skillId) || skill.skillId < skillMin || skill.skillId > skillMax) add('charm.skill.encoding', `charm.skill${position === 'A' ? 1 : 2}.skillId`, 'error', `${position} 技能编号超出 7 位编码范围`)
    if (!Number.isInteger(skill.points) || skill.points < pointsMin || skill.points > pointsMax) add('charm.skill.encoding', `charm.skill${position === 'A' ? 1 : 2}.points`, 'error', `${position} 技能点超出编码范围`)
  }
  if (issues.some(issue => issue.severity === 'error')) return { legality: 'invalid', encoding: 'blocked', issues }
  const source = p3CharmSourceForGrade(rules, charm.classId)
  if (!source) {
    add('charm.source.unknown', 'charm.classId', 'info', '该品级没有对应的鉴定来源资料')
    return { legality: 'unknown', encoding: 'encodable', issues }
  }
  const gradeRule = rules.grades.find(value => value.grade === charm.classId)!
  if (!charm.skill1) add('charm.skill1.missing', 'charm.skill1', 'warning', '鉴定得到的护石一定有第一技能')
  else {
    const row = poolRow(rules, source.skill1Pool, charm.skill1.skillId)
    if (!row) add('charm.skill.non-natural', 'charm.skill1.skillId', 'warning', `第一技能不在${source.labelJp}的鉴定池中`)
    else if (!(charm.skill1.points >= Math.max(1, row.min) && charm.skill1.points <= row.max)) add('charm.skill.non-natural', 'charm.skill1.points', 'warning', `第一技能点 ${charm.skill1.points} 超出该技能 ${Math.max(1, row.min)}～${row.max} 的范围`)
  }
  if (charm.skill2) {
    if (!source.skill2Pool) add('charm.skill2.impossible', 'charm.skill2', 'warning', `${source.labelJp}不会鉴定出第二技能`)
    else {
      const row = poolRow(rules, source.skill2Pool, charm.skill2.skillId)
      if (!row) add('charm.skill.non-natural', 'charm.skill2.skillId', 'warning', `第二技能不在${source.labelJp}的鉴定池中`)
      else if (!(charm.skill2.points >= row.min && charm.skill2.points <= row.max)) add('charm.skill.non-natural', 'charm.skill2.points', 'warning', `第二技能点 ${charm.skill2.points} 超出该技能 ${row.min}～${row.max} 的范围`)
      if (charm.skill1 && charm.skill2.skillId === charm.skill1.skillId) add('charm.skill.duplicate', 'charm.skill2.skillId', 'warning', '鉴定时同技能系的第二技能会被清除')
    }
  }
  const max1 = charm.skill1 ? poolRow(rules, source.skill1Pool, charm.skill1.skillId)?.max ?? 0 : 0
  const max2 = charm.skill2 ? poolRow(rules, source.skill2Pool, charm.skill2.skillId)?.max ?? 0 : 0
  const rank = p3CharmRank(charm.skill1?.points ?? 0, max1, charm.skill2?.points ?? 0, max2)
  const rows = p3CharmSlotRow(rules, source.slotTableKey, rank)
  const slotRow = rows.find(row => row.slot === charm.slots)
  if (!rows.length) add('charm.slots.unknown', 'charm.slots', 'warning', '该品级缺少孔位规则')
  else if (!slotRow || slotRow.width <= 0) add('charm.slots.non-natural', 'charm.slots', 'warning', `rank ${rank} 下不会出现 ${charm.slots} 孔`)
  const gradeValue = rank + 2 * charm.slots
  if (!(gradeValue >= gradeRule.minF && gradeValue <= gradeRule.maxF)) add('charm.grade.mismatch', 'charm.classId', 'warning', `rank ${rank} + 2×${charm.slots} = ${gradeValue} 与品级 ${charm.classId}（${gradeRule.minF}～${gradeRule.maxF}）不一致`)
  const legality = issues.some(issue => issue.severity === 'error' || issue.severity === 'warning') ? 'invalid' : 'confirmed'
  return { legality, encoding: 'encodable', issues, sourceKey: source.sourceKey, rank, gradeValue }
}

/** Enumerate every natural charm that can contribute to one of the relevant
 * skills. Bounded by the caller; the oracle proves the same set as the native
 * materialised table. */
export function enumerateP3CharmCandidates(rules: P3CharmRules, relevant: Set<number>, limit = 20000): LoadoutCharm[] {
  const names = new Map<number, string>()
  for (const pool of Object.values(rules.pools)) for (const row of pool.rows) if (!names.has(row.skillId)) names.set(row.skillId, String(row.skillId))
  const result: LoadoutCharm[] = []
  const seen = new Set<string>()
  const point = (skillId: number, points: number): LoadoutSkillPoint => ({ skillId, points, nameCn: names.get(skillId) ?? String(skillId) })
  for (const source of rules.sources) {
    const gradeRules = rules.grades.filter(rule => rule.sourceKey === source.sourceKey)
    const pool1 = rules.pools[source.skill1Pool]?.rows ?? []
    const pool2 = source.skill2Pool ? rules.pools[source.skill2Pool]?.rows ?? [] : []
    const push = (skill1: LoadoutSkillPoint, skill2: LoadoutSkillPoint | null) => {
      if (result.length >= limit) return
      const max1 = poolRow(rules, source.skill1Pool, skill1.skillId)?.max ?? 0
      const max2 = skill2 ? poolRow(rules, source.skill2Pool, skill2.skillId)?.max ?? 0 : 0
      const rank = p3CharmRank(skill1.points, max1, skill2?.points ?? 0, max2)
      const rows = p3CharmSlotRow(rules, source.slotTableKey, rank)
      for (const row of rows) {
        if (row.width <= 0) continue
        const f = rank + 2 * row.slot
        const grade = gradeRules.find(rule => f >= rule.minF && f <= rule.maxF)?.grade
        if (grade == null) continue
        const key = [grade, row.slot, skill1.skillId, skill1.points, skill2?.skillId ?? 0, skill2?.points ?? 0].join(':')
        if (seen.has(key)) continue
        seen.add(key)
        result.push({ kind: 'charm', gameId: 'mhp3', classId: grade, classNameCn: gradeRules.find(rule => rule.grade === grade)!.nameCn, slots: row.slot,
          skill1, skill2, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [] })
        if (result.length >= limit) return
      }
    }
    for (const row1 of pool1) {
      for (let p1 = Math.max(1, row1.min); p1 <= row1.max; p1 += 1) {
        const skill1 = point(row1.skillId, p1)
        if (!pool2.length) { if (relevant.has(row1.skillId)) push(skill1, null); continue }
        if (relevant.has(row1.skillId)) push(skill1, null)
        for (const row2 of pool2) {
          if (row2.skillId === row1.skillId) continue
          if (!relevant.has(row1.skillId) && !relevant.has(row2.skillId)) continue
          for (let p2 = row2.min; p2 <= row2.max; p2 += 1) push(skill1, point(row2.skillId, p2))
        }
      }
    }
  }
  return result
}
