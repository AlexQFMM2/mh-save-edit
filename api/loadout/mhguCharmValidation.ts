import { checkCharmSlots } from './charmSlotRules'
import type { CharmValidationResult, LoadoutCalculationSnapshot, LoadoutCharm, LoadoutIssue } from './types'

/** GU uses independent position pools plus a shared slot rule, not a pair whitelist.
 * Diagnose fields first: one bad point value is not evidence against the other
 * skill or a reason to run joint fulfillment with invalid inputs. */
export function validateMhguCharm(snapshot: LoadoutCalculationSnapshot, charm: LoadoutCharm, initialIssues: LoadoutIssue[]): CharmValidationResult {
  const issues = [...initialIssues]
  const ranges: CharmValidationResult['ranges'] = []
  let fieldsKnown = true
  let exactSingleA = false
  for (const [position, skill, path] of [['A', charm.skill1, 'charm.skill1'], ['B', charm.skill2, 'charm.skill2']] as const) {
    if (!skill) continue
    if (!Number.isInteger(skill.skillId) || skill.skillId < 0 || skill.skillId > 65535 || !Number.isInteger(skill.points) || skill.points < -32768 || skill.points > 32767) {
      issues.push({ code: 'charm.skill.encoding', path, severity: 'error', message: `${position} 技能超出 16 位编码范围` })
      fieldsKnown = false
      continue
    }
    const matches = snapshot.charmRanges.filter(row => row.classId === charm.classId && row.position === position && row.skillId === skill.skillId)
    for (const row of matches) ranges.push({ position, min: row.minPoints, max: row.maxPoints, source: row.source })
    if (!matches.length || matches.every(row => row.status === 'unknown')) {
      issues.push({ code: 'charm.skill.range.unknown', path: `${path}.skillId`, severity: 'info', message: `${position} 技能未找到当前品级/位置的已确认范围，保留原值`, source: matches[0]?.source })
      fieldsKnown = false
      continue
    }
    const inRange = matches.some(row => row.status !== 'unknown' && skill.points >= row.minPoints && skill.points <= row.maxPoints)
    if (position === 'A' && skill.points <= 0) {
      issues.push({ code: 'charm.skill.non-natural', path: `${path}.points`, severity: 'warning', message: 'A 技能点必须为正数', source: matches[0].source })
      fieldsKnown = false
    } else if (!inRange) {
      const uncertain = matches.some(row => row.status === 'unknown')
      issues.push({ code: uncertain ? 'charm.skill.range.unknown' : 'charm.skill.non-natural', path: `${path}.points`, severity: uncertain ? 'info' : 'warning', message: uncertain ? `${position} 技能的点数范围尚未完整确认，保留原值` : `${position} 技能点超出当前品级/位置的范围`, source: matches[0].source })
      fieldsKnown = false
    }
    if (position === 'A' && !charm.skill2) exactSingleA = matches.some(row => row.status === 'exact' && row.slotCount === charm.slots && skill.points >= row.minPoints && skill.points <= row.maxPoints)
  }
  if (!charm.skill1 && charm.skill2) {
    issues.push({ code: 'charm.skill.first-required', path: 'charm.skill1', severity: 'warning', message: 'GU 有 B 技能时必须保留 A 技能' })
    fieldsKnown = false
  }
  if (charm.skill1 && charm.skill2 && charm.skill1.skillId === charm.skill2.skillId) {
    issues.push({ code: 'charm.skill.duplicate', path: 'charm.skill2', severity: 'warning', message: 'A/B 技能使用了同一技能系' })
    fieldsKnown = false
  }
  if (fieldsKnown && !issues.some(issue => issue.severity === 'error')) {
    const slots = checkCharmSlots(snapshot, charm)
    if (slots.status === 'invalid') issues.push({ code: 'charm.slots.non-natural', path: 'charm.slots', severity: 'warning', message: '当前技能点组合不允许此孔数', source: slots.source })
    else if (slots.status === 'unknown' && !exactSingleA) issues.push({ code: 'charm.slots.unknown', path: 'charm.slots', severity: 'info', message: '当前技能点组合的孔位证据未确认；不是缺少额外技能配对表，保留原值', source: slots.source })
  }
  const encoding = issues.some(issue => issue.severity === 'error') ? 'blocked' : 'encodable'
  const legality = encoding === 'blocked' || issues.some(issue => issue.severity === 'warning') ? 'invalid' : issues.some(issue => issue.severity === 'info') ? 'unknown' : 'confirmed'
  return { encoding, legality, issues, ranges }
}
