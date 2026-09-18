import type { CharmValidationResult, LoadoutCalculationSnapshot, LoadoutCharm, LoadoutIssue } from './types'
import { checkCharmSlots } from './charmSlotRules'
import { isExactCharmCombination } from './charmCombinations'
import { validateMh4gCharm } from './mh4gCharmValidation'
import { validateMhguCharm } from './mhguCharmValidation'

export function validateCharm(snapshot: LoadoutCalculationSnapshot, charm: LoadoutCharm): CharmValidationResult {
  const issues: LoadoutIssue[] = []
  if (!Number.isInteger(charm.classId) || charm.classId < 0 || charm.classId > 65535) issues.push({ code: 'charm.class.encoding', path: 'charm.classId', severity: 'error', message: '护石品级 ID 无法编码' })
  if (!Number.isInteger(charm.slots) || charm.slots < 0 || charm.slots > 3) issues.push({ code: 'charm.slots.encoding', path: 'charm.slots', severity: 'error', message: '护石孔位必须为 0～3' })
  const charmClass = snapshot.charmClasses.find(value => value.classId === charm.classId)
  if (!charmClass) issues.push({ code: 'charm.class.unknown', path: 'charm.classId', severity: 'info', message: '护石品级未出现在当前资料中，保留为未知可编码值' })
  else if (charm.slots > charmClass.maxSlots) issues.push({ code: 'charm.slots.non-natural', path: 'charm.slots', severity: 'warning', message: `孔位超过${charmClass.nameCn}已确认上限 ${charmClass.maxSlots}`, source: 'catalog_skill_talisman_ranges' })
  if (snapshot.gameId === 'mh4g') return validateMh4gCharm(snapshot, charm, issues)
  if (snapshot.gameId === 'mhgu') return validateMhguCharm(snapshot, charm, issues)
  const ranges: CharmValidationResult['ranges'] = []
  const slotCheck = checkCharmSlots(snapshot, charm)
  const exactCombination = isExactCharmCombination(snapshot, charm)
  if (exactCombination === false) issues.push({ code: 'charm.pair.non-natural', path: 'charm', severity: 'warning', message: '护石不在当前资料的精确双技能/孔位组合中', source: 'charm_combinations' })
  for (const [position, skill] of [['A', charm.skill1], ['B', charm.skill2]] as const) {
    if (!skill) continue
    if (!Number.isInteger(skill.skillId) || skill.skillId < 0 || skill.skillId > 65535 || !Number.isInteger(skill.points) || skill.points < -32768 || skill.points > 32767) {
      issues.push({ code: 'charm.skill.encoding', path: `charm.skill${position === 'A' ? 1 : 2}`, severity: 'error', message: `${position} 技能超出 16 位编码范围` }); continue
    }
    if (exactCombination === true) continue
    const matches = snapshot.charmRanges.filter(value => value.classId === charm.classId && value.position === position && value.skillId === skill.skillId && (value.slotCount == null || value.slotCount === charm.slots))
    for (const value of matches) ranges.push({ position, min: value.minPoints, max: value.maxPoints, source: value.source })
    const exact = matches.filter(value => value.slotCount != null && value.status === 'exact')
    const hasRule = matches.some(value => value.status !== 'unknown' && skill.points >= value.minPoints && skill.points <= value.maxPoints)
    if (exact.some(value => skill.points >= value.minPoints && skill.points <= value.maxPoints)) continue
    if (hasRule && slotCheck.status === 'confirmed') continue
    const unknown = !matches.length || matches.every(value => value.status === 'unknown') || matches.some(value => value.slotCount == null || value.status !== 'exact') && hasRule && slotCheck.status !== 'invalid'
    issues.push({ code: unknown ? 'charm.slots.unknown' : 'charm.skill.non-natural', path: `charm.skill${position === 'A' ? 1 : 2}.points`, severity: unknown ? 'info' : 'warning', message: unknown ? `${position} 技能/孔位组合的自然生成规则尚未确认，保留原值` : `${position} 技能点或孔位不在已确认自然范围内`, source: slotCheck.source ?? matches[0]?.source })
  }
  if (charm.skill1 && charm.skill2 && charm.skill1.skillId === charm.skill2.skillId) issues.push({ code: 'charm.skill.duplicate', path: 'charm.skill2', severity: 'warning', message: 'A/B 技能使用了同一技能系' })
  if (!charm.skill1 && !charm.skill2 && slotCheck.status === 'unknown' && exactCombination == null) issues.push({ code: 'charm.empty.unknown', path: 'charm', severity: 'info', message: '纯孔护石的生成规则尚未确认', source: slotCheck.source })
  if (slotCheck.status === 'invalid') issues.push({ code: 'charm.slots.non-natural', path: 'charm.slots', severity: 'warning', message: '护石双技能与孔位不符合已确认规则', source: slotCheck.source })
  // Marginal A/B ranges alone cannot certify an arbitrary pair.
  if (charm.skill1 && charm.skill2 && slotCheck.status === 'unknown' && exactCombination == null) issues.push({ code: 'charm.pair.unknown', path: 'charm', severity: 'info', message: '双技能联合生成规则尚未确认', source: slotCheck.source })
  const encoding = issues.some(value => value.severity === 'error') ? 'blocked' : 'encodable'
  const legality = encoding === 'blocked' || issues.some(value => value.severity === 'warning') ? 'invalid' : issues.some(value => value.severity === 'info') ? 'unknown' : 'confirmed'
  return { legality, encoding, issues, ranges }
}

export function applyCharmValidation<T extends LoadoutCharm>(snapshot: LoadoutCalculationSnapshot, charm: T): T {
  const validation = validateCharm(snapshot, charm)
  return { ...charm, legality: validation.legality, encoding: validation.encoding, issues: validation.issues }
}
