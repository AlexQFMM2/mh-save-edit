import type { ArmorLoadoutSlot, LegalityStatus, LoadoutActivation, LoadoutCalculationSnapshot, LoadoutDecoration, LoadoutIssue, LoadoutResult, LoadoutSkillPoint, LoadoutSkillResult, LogicalLoadout } from './types'
import { ARMOR_LOADOUT_SLOTS } from './types'
import { decorationKey, decorationId, isDecorationForGame } from './identity'
import { getGameLoadoutRules, type LoadoutContribution } from './rules'
import { findMh4gCharmWitness, MH4G_WITNESS_NOTICE_CODE } from './mh4gCharmWitnesses'

type Contribution = LoadoutContribution
const emptyContribution = (): Contribution => ({ weapon: 0, head: 0, chest: 0, arms: 0, waist: 0, legs: 0, charm: 0, decorations: 0, special: 0 })

function add(map: Map<number, Contribution>, point: LoadoutSkillPoint, column: keyof Contribution, multiplier = 1) {
  const value = map.get(point.skillId) ?? emptyContribution()
  value[column] += point.points * multiplier
  map.set(point.skillId, value)
}

function decorationUsage(values: LoadoutDecoration[]): number {
  return values.reduce((sum, value) => sum + Math.max(0, value.slots), 0)
}

function statusFromIssues(issues: LoadoutIssue[]): LegalityStatus {
  if (issues.some(issue => issue.severity === 'warning')) return 'invalid'
  if (issues.some(issue => issue.severity === 'info')) return 'unknown'
  return 'confirmed'
}

function activationFor(points: number, activations: LoadoutActivation[]): { active: LoadoutActivation | null; next: LoadoutActivation | null } {
  const positive = activations.filter(value => value.direction === 'positive').sort((a, b) => a.threshold - b.threshold)
  const negative = activations.filter(value => value.direction === 'negative').sort((a, b) => b.threshold - a.threshold)
  const activePositive = positive.filter(value => points >= value.threshold).at(-1) ?? null
  const activeNegative = negative.filter(value => points <= value.threshold).at(-1) ?? null
  const active = activePositive ?? activeNegative
  const next = activePositive ? positive.find(value => value.threshold > activePositive.threshold) ?? null : positive.find(value => value.threshold > points) ?? null
  return { active, next }
}

export function calculateLoadout(snapshot: LoadoutCalculationSnapshot, loadout: LogicalLoadout): LoadoutResult {
  const rules = getGameLoadoutRules(snapshot.gameId)
  const issues: LoadoutIssue[] = []
  if (loadout.gameId !== snapshot.gameId || snapshot.gameId === 'mhp2g' && loadout.charm) issues.push({ code: 'loadout.identity', path: 'loadout', severity: 'error', message: '配装游戏不一致或 P2G 包含护石' })
  const contributions = new Map<number, Contribution>()
  const slotResults: LoadoutResult['slots'] = []
  const armorStats: LoadoutResult['armorStats'] = []
  let defense = 0; let maxDefense = 0
  const resistances = { fire: 0, water: 0, thunder: 0, ice: 0, dragon: 0 }

  const addDecorations = (path: string, naturalSlots: number, values: LoadoutDecoration[], column: ArmorLoadoutSlot | 'weapon' | 'charm') => {
    const usedSlots = decorationUsage(values)
    const localIssues: LoadoutIssue[] = []
    if (values.length > 3) localIssues.push({ code: 'decorations.record-capacity', path, severity: 'error', message: `装饰珠记录超过 3 颗容量（当前 ${values.length} 颗）`, source: 'loadout-calculator' })
    if (usedSlots > naturalSlots) localIssues.push({ code: 'slots.over-capacity', path, severity: 'warning', message: `装饰珠超出 ${usedSlots - naturalSlots} 孔`, source: 'loadout-calculator' })
    for (const decoration of values) {
      const catalog = snapshot.decorations.find((candidate) => decorationKey(candidate) === decorationKey(decoration) && isDecorationForGame(decoration, snapshot.gameId))
      if (!catalog) localIssues.push({ code: 'decoration.unknown', path, severity: 'info', message: `未知装饰珠 ID ${decorationId(decoration)}；保留记录但不计算未知技能贡献`, source: 'loadout-calculator' })
      for (const point of catalog?.skills ?? []) add(contributions, point, 'decorations')
    }
    return { usedSlots, localIssues }
  }

  if (loadout.weapon) {
    defense += loadout.weapon.defense; maxDefense += loadout.weapon.defense
    const { usedSlots, localIssues } = addDecorations('weapon.decorations', loadout.weapon.slots, loadout.weapon.decorations, 'weapon')
    if (loadout.weapon.instance?.issues.length) localIssues.push(...loadout.weapon.instance.issues)
    issues.push(...localIssues)
    slotResults.push({ slot: 'weapon', lock: loadout.weapon.lock, nameCn: loadout.weapon.nameCn, decorations: loadout.weapon.decorations, naturalSlots: loadout.weapon.slots, usedSlots, remainingSlots: loadout.weapon.slots - usedSlots, legality: loadout.weapon.instance?.legality ?? statusFromIssues(localIssues), encoding: loadout.weapon.instance?.encoding ?? 'encodable', issues: localIssues })
  } else issues.push({ code: 'slot.weapon.empty', path: 'weapon', severity: 'error', message: '请选择具体武器' })

  for (const slot of ARMOR_LOADOUT_SLOTS) {
    const armor = loadout.armor[slot]
    if (!armor) { issues.push({ code: `slot.${slot}.empty`, path: `armor.${slot}`, severity: 'info', message: `尚未选择${slot}` }); continue }
    defense += armor.baseDefense; maxDefense += armor.maxDefense
    resistances.fire += armor.fireRes; resistances.water += armor.waterRes; resistances.thunder += armor.thunderRes; resistances.ice += armor.iceRes; resistances.dragon += armor.dragonRes
    armorStats.push({ part: slot, nameCn: armor.nameCn, combat: armor.combat, slots: armor.slots, baseDefense: armor.baseDefense, maxDefense: armor.maxDefense, fireRes: armor.fireRes, waterRes: armor.waterRes, thunderRes: armor.thunderRes, iceRes: armor.iceRes, dragonRes: armor.dragonRes })
    for (const point of armor.skills) add(contributions, point, slot)
    const { usedSlots, localIssues } = addDecorations(`armor.${slot}.decorations`, armor.slots, armor.decorations, slot)
    if (armor.part !== slot) localIssues.push({ code: 'armor.part-mismatch', path: `armor.${slot}`, severity: 'warning', message: `防具部位 ${armor.part} 与槽位 ${slot} 不一致` })
    if (armor.gender !== 'both' && armor.gender !== loadout.gender) localIssues.push({ code: 'armor.gender-mismatch', path: `armor.${slot}`, severity: 'warning', message: '防具与当前性别不兼容' })
    localIssues.push(...rules.validateArmorCompatibility(loadout.weapon, armor, `armor.${slot}.combat`))
    if (armor.instance?.issues.length) localIssues.push(...armor.instance.issues)
    issues.push(...localIssues)
    slotResults.push({ slot, lock: armor.lock, nameCn: armor.nameCn, decorations: armor.decorations, naturalSlots: armor.slots, usedSlots, remainingSlots: armor.slots - usedSlots, legality: armor.instance?.legality ?? statusFromIssues(localIssues), encoding: armor.instance?.encoding ?? 'encodable', issues: localIssues })
  }

  if (loadout.charm) {
    if (loadout.charm.skill1) add(contributions, loadout.charm.skill1, 'charm')
    if (loadout.charm.skill2) add(contributions, loadout.charm.skill2, 'charm')
    const { usedSlots, localIssues } = addDecorations('charm.decorations', loadout.charm.slots, loadout.charm.decorations, 'charm')
    localIssues.push(...loadout.charm.issues)
    issues.push(...localIssues)
    slotResults.push({ slot: 'charm', lock: loadout.charm.lock, nameCn: loadout.charm.classNameCn, decorations: loadout.charm.decorations, naturalSlots: loadout.charm.slots, usedSlots, remainingSlots: loadout.charm.slots - usedSlots, legality: loadout.charm.legality, encoding: loadout.charm.encoding, issues: localIssues })
  }

  const torsoSkillId = rules.torsoSkillId
  const torsoCopies = ARMOR_LOADOUT_SLOTS.filter(slot => slot !== 'chest').reduce((sum, slot) => sum + Math.max(0, loadout.armor[slot]?.skills.find(value => value.skillId === torsoSkillId)?.points ?? 0), 0)
  if (torsoCopies > 0) {
    for (const [skillId, value] of contributions) {
      if (skillId === torsoSkillId) continue
      const chestDecorShare = loadout.armor.chest?.decorations.flatMap(value => snapshot.decorations.find(candidate => decorationKey(candidate) === decorationKey(value))?.skills ?? []).filter(value => value.skillId === skillId).reduce((sum, value) => sum + value.points, 0) ?? 0
      value.special += (value.chest + chestDecorShare) * torsoCopies
    }
  }

  rules.calculateSpecialModifiers(snapshot, loadout, contributions)

  const skillResults: LoadoutSkillResult[] = []
  const active: LoadoutActivation[] = []
  for (const definition of snapshot.skills) {
    const value = contributions.get(definition.skillId)
    if (!value) continue
    const total = Object.values(value).reduce((sum, points) => sum + points, 0)
    if (total === 0 && !definition.activations.length) continue
    const activation = activationFor(total, definition.activations)
    if (activation.active) active.push(activation.active)
    skillResults.push({ skillId: definition.skillId, nameCn: definition.nameCn, ...value, total, activation: activation.active, specialRule: definition.specialRule, nextActivation: activation.next })
  }
  skillResults.sort((a, b) => Number(Boolean(b.activation)) - Number(Boolean(a.activation)) || b.total - a.total || a.skillId - b.skillId)

  const encoding = issues.some(issue => issue.severity === 'error') || slotResults.some(value => value.encoding === 'blocked') ? 'blocked' : 'encodable'
  const witnessedMh4gCharm = snapshot.gameId === 'mh4g' && loadout.charm && findMh4gCharmWitness(snapshot, loadout.charm)
  const unknownIssues = issues.some(issue => issue.severity === 'info' && !(witnessedMh4gCharm && issue.path === 'charm' && issue.code === MH4G_WITNESS_NOTICE_CODE))
  const legality: LegalityStatus = issues.some(issue => issue.severity === 'warning') || slotResults.some(value => value.legality === 'invalid') ? 'invalid' : unknownIssues || slotResults.some(value => value.legality === 'unknown') ? 'unknown' : 'confirmed'
  return { defense, maxDefense, armorStats, resistances, slots: slotResults, skills: skillResults, activations: active, issues, legality, encoding }
}
