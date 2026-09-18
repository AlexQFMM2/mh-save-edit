import type { CharmValidationResult, LoadoutCalculationSnapshot, LoadoutCharm, LoadoutIssue } from './types'
import { checkMh4gAppraisal } from './mh4gCharmRules'
import { findMh4gCharmWitness, MH4G_WITNESS_NOTICE_CODE, MH4G_WITNESS_SCOPE_MESSAGE } from './mh4gCharmWitnesses'

/** Separate field diagnostics from joint appraisal constraints and evidence. */
export function validateMh4gCharm(snapshot: LoadoutCalculationSnapshot, charm: LoadoutCharm, initialIssues: LoadoutIssue[]): CharmValidationResult {
  const issues = [...initialIssues]
  const ranges: CharmValidationResult['ranges'] = []
  for (const [position, skill, path] of [['A', charm.skill1, 'charm.skill1'], ['B', charm.skill2, 'charm.skill2']] as const) {
    if (!skill) continue
    if (!Number.isInteger(skill.skillId) || skill.skillId < 0 || skill.skillId > 65535 || !Number.isInteger(skill.points) || skill.points < -32768 || skill.points > 32767) {
      issues.push({ code: 'charm.skill.encoding', path, severity: 'error', message: `${position} 技能超出 16 位编码范围` })
      continue
    }
    const matches = snapshot.charmRanges.filter(row => row.classId === charm.classId && row.position === position && row.skillId === skill.skillId)
    for (const row of matches) ranges.push({ position, min: row.minPoints, max: row.maxPoints, source: row.source })
    if (snapshot.mh4gCharmRules) continue // Native checker owns the same field's diagnostic.
    if (!matches.length) issues.push({ code: 'charm.skill.range.unknown', path: `${path}.skillId`, severity: 'info', message: `${position} 技能未找到当前品级/位置的对应范围` })
    else if (!matches.some(row => row.status !== 'unknown' && skill.points >= row.minPoints && skill.points <= row.maxPoints)) {
      const unknown = matches.every(row => row.status === 'unknown')
      issues.push({ code: unknown ? 'charm.skill.range.unknown' : 'charm.skill.non-natural', path: `${path}.points`, severity: unknown ? 'info' : 'warning', message: unknown ? `${position} 技能的点数范围尚未确认` : `${position} 技能点超出当前范围`, source: matches[0].source })
    }
  }
  if (!issues.some(issue => issue.severity === 'error')) {
    const appraisal = checkMh4gAppraisal(snapshot.mh4gCharmRules, charm)
    issues.push(...appraisal.issues)
    if (appraisal.status === 'satisfied') {
      const witness = findMh4gCharmWitness(snapshot, charm)
      if (witness) {
        issues.push({ code: MH4G_WITNESS_NOTICE_CODE, path: 'charm', severity: 'info', source: `${snapshot.mh4gCharmWitnessSource}:outcome=${witness.join(',')}`, message: MH4G_WITNESS_SCOPE_MESSAGE })
      } else {
        issues.push({ code: 'charm.mh4g.constraints-only', path: 'charm', severity: 'info', source: appraisal.source, message: `符合已审计的 4G 静态鉴定约束，但当前有界见证未覆盖此组合，保留为未确认；不据此认定非法。${snapshot.mh4gCharmWitnessIssue ?? ''}` })
      }
    } else if (appraisal.status === 'unknown') {
      issues.push({ code: 'charm.mh4g.evidence.unknown', path: 'charm', severity: 'info', message: snapshot.mh4gCharmRulesIssue ?? '缺少此护石对应的 4G 原生联合规则证据，保留原值。' })
    }
  }
  if (!snapshot.mh4gCharmRules && charm.skill1 && charm.skill2 && charm.skill1.skillId === charm.skill2.skillId) issues.push({ code: 'charm.skill.duplicate', path: 'charm.skill2', severity: 'warning', message: 'A/B 技能使用了同一技能系' })
  const encoding = issues.some(issue => issue.severity === 'error') ? 'blocked' : 'encodable'
  const legality = encoding === 'blocked' || issues.some(issue => issue.severity === 'warning') ? 'invalid' : issues.some(issue => issue.severity === 'info' && issue.code !== MH4G_WITNESS_NOTICE_CODE) ? 'unknown' : 'confirmed'
  return { encoding, legality, issues, ranges }
}
