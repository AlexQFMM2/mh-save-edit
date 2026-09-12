import { createHash } from 'node:crypto'
import { calculateLoadout } from './calculator'
import type { ArmorLoadoutSlot, AutoLoadoutProgress, AutoLoadoutRequest, AutoLoadoutResult, LoadoutArmor, LoadoutCatalogSnapshot, LoadoutCharm, LoadoutDecoration, LogicalLoadout } from './types'
import { ARMOR_LOADOUT_SLOTS } from './types'
import { getGameLoadoutRules } from './rules'
import { applyCharmValidation } from './charm'

type SearchContext = { checkpoint: () => Promise<void>; progress: (value: AutoLoadoutProgress) => void }
const clone = <T>(value: T): T => structuredClone(value)
const sumSkill = (skills: { skillId: number; points: number }[], targets: Set<number>) => skills.reduce((sum, value) => sum + (targets.has(value.skillId) ? Math.max(0, value.points) : 0), 0)

function armorScore(armor: LoadoutArmor, targets: Set<number>) { return sumSkill(armor.skills, targets) * 1000 + armor.slots * 50 + armor.maxDefense }
function fingerprint(loadout: LogicalLoadout) { return createHash('sha256').update(JSON.stringify({ weapon: loadout.weapon?.candidateKey, armor: ARMOR_LOADOUT_SLOTS.map(slot => loadout.armor[slot]?.candidateKey), charm: loadout.charm && [loadout.charm.classId, loadout.charm.skill1?.skillId, loadout.charm.skill1?.points, loadout.charm.skill2?.skillId, loadout.charm.skill2?.points], decorations: [loadout.weapon?.decorations, ...ARMOR_LOADOUT_SLOTS.map(slot => loadout.armor[slot]?.decorations), loadout.charm?.decorations].map(values => values?.map(value => value.saveId)) })).digest('hex').slice(0, 20) }

function charmCandidates(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest): (LoadoutCharm & { lock: 'unlocked' })[] {
  const result: (LoadoutCharm & { lock: 'unlocked' })[] = []
  const byPosition = { A: [] as (LoadoutCharm & { lock: 'unlocked' })[], B: [] as (LoadoutCharm & { lock: 'unlocked' })[] }
  for (const target of request.targets) for (const range of snapshot.charmRanges.filter(value => value.skillId === target.skillId && value.maxPoints > 0)) {
    const charmClass = snapshot.charmClasses.find(value => value.classId === range.classId)
    if (!charmClass) continue
    const point = { skillId: target.skillId, nameCn: snapshot.skills.find(value => value.skillId === target.skillId)?.nameCn ?? target.nameCn, points: range.maxPoints }
    const charm: LoadoutCharm & { lock: 'unlocked' } = { kind: 'charm', gameId: snapshot.gameId, classId: charmClass.classId, classNameCn: charmClass.nameCn, iconPath: charmClass.iconPath, slots: range.slotCount ?? 0, skill1: range.position === 'A' ? point : null, skill2: range.position === 'B' ? point : null, decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked' }
    const validated = applyCharmValidation(snapshot, charm)
    if (validated.legality === 'confirmed' && validated.encoding === 'encodable') byPosition[range.position].push(validated)
  }
  result.push(...byPosition.A, ...byPosition.B)
  for (const first of byPosition.A) for (const second of byPosition.B) {
    if (!first.skill1 || !second.skill2 || first.classId !== second.classId || first.skill1.skillId === second.skill2.skillId) continue
    const combined: LoadoutCharm & { lock: 'unlocked' } = { ...clone(first), slots: Math.max(first.slots, second.slots), skill2: clone(second.skill2), lock: 'unlocked' }
    const validated = applyCharmValidation(snapshot, combined)
    if (validated.legality === 'confirmed' && validated.encoding === 'encodable') result.push(validated)
  }
  const seen = new Set<string>()
  const targetIds = new Set(request.targets.map((target) => target.skillId))
  const score = (value: LoadoutCharm) => [value.skill1, value.skill2].reduce((sum, point) => sum + (point && targetIds.has(point.skillId) ? Math.max(0, point.points) : 0), 0) + value.slots / 10
  return result.filter(value => { const key = `${value.classId}:${value.slots}:${value.skill1?.skillId}:${value.skill1?.points}:${value.skill2?.skillId}:${value.skill2?.points}`; if (seen.has(key)) return false; seen.add(key); return true }).sort((a, b) => score(b) - score(a) || a.classId - b.classId).slice(0, 200)
}

function assignDecorations(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, input: LogicalLoadout): LogicalLoadout {
  const loadout = clone(input)
  const targetIds = new Set(request.targets.map(value => value.skillId))
  const candidates = snapshot.decorations.filter(value => value.slots > 0 && value.slots <= 3 && value.skills.some(skill => targetIds.has(skill.skillId) && skill.points > 0)).sort((a, b) => {
    const ap = sumSkill(a.skills, targetIds) / a.slots; const bp = sumSkill(b.skills, targetIds) / b.slots
    return bp - ap || a.slots - b.slots || a.saveId - b.saveId
  })
  const containers: { capacity: number; values: LoadoutDecoration[]; locked: boolean }[] = []
  if (loadout.weapon) { if (loadout.weapon.lock === 'equipment') loadout.weapon.decorations = []; containers.push({ capacity: loadout.weapon.slots, values: loadout.weapon.decorations, locked: loadout.weapon.lock === 'equipmentAndDecorations' }) }
  for (const slot of ARMOR_LOADOUT_SLOTS) { const armor = loadout.armor[slot]; if (!armor) continue; if (armor.lock === 'equipment') armor.decorations = []; containers.push({ capacity: armor.slots, values: armor.decorations, locked: armor.lock === 'equipmentAndDecorations' }) }
  if (loadout.charm) { if (loadout.charm.lock === 'equipment') loadout.charm.decorations = []; containers.push({ capacity: loadout.charm.slots, values: loadout.charm.decorations, locked: loadout.charm.lock === 'equipmentAndDecorations' }) }
  for (let guard = 0; guard < 40; guard += 1) {
    const calculation = calculateLoadout(snapshot, loadout)
    const missing = request.targets.map(target => ({ ...target, current: calculation.skills.find(value => value.skillId === target.skillId)?.total ?? 0 })).filter(value => value.current < value.threshold).sort((a, b) => (b.threshold - b.current) - (a.threshold - a.current))[0]
    if (!missing) break
    const available = containers.filter(container => !container.locked).map(container => ({ container, remaining: container.capacity - container.values.reduce((sum, value) => sum + value.slots, 0) })).filter(value => value.remaining > 0).sort((a, b) => a.remaining - b.remaining)
    const decoration = candidates.filter(value => value.skills.some(skill => skill.skillId === missing.skillId && skill.points > 0)).find(value => available.some(slot => slot.remaining >= value.slots))
    if (!decoration) break
    const container = available.find(value => value.remaining >= decoration.slots)!
    container.container.values.push(clone(decoration))
  }
  return loadout
}

export async function runAutoLoadout(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, context: SearchContext): Promise<AutoLoadoutResult[]> {
  if (!request.baseLoadout.weapon) throw new Error('自动配装需要先选择具体武器')
  const selectedWeapon = request.baseLoadout.weapon
  if (request.dataVersion !== snapshot.dataVersion) throw new Error('配装数据版本已变化，请重新打开自动配装')
  const started = Date.now(); const deadline = started + request.timeoutMs; let checked = 0
  const targetIds = new Set(request.targets.map(value => value.skillId))
  const rules = getGameLoadoutRules(snapshot.gameId)
  const weaponCombat = rules.getWeaponCombatType(selectedWeapon)
  const candidateBySlot = new Map<ArmorLoadoutSlot, LoadoutArmor[]>()
  for (const slot of ARMOR_LOADOUT_SLOTS) {
    const fixed = request.baseLoadout.armor[slot]
    if (fixed && fixed.lock !== 'unlocked') candidateBySlot.set(slot, [clone(fixed)])
    else candidateBySlot.set(slot, snapshot.armors.filter(value => value.sourceKind === 'catalog' && value.saveType != null && value.saveId != null && value.part === slot && (value.gender === 'both' || value.gender === request.baseLoadout.gender) && (value.combat === 'both' || value.combat === weaponCombat)).map(value => ({ ...clone(value), decorations: [], lock: 'unlocked' as const })).sort((a, b) => armorScore(b, targetIds) - armorScore(a, targetIds)).slice(0, 50))
  }
  let beam: LogicalLoadout[] = [{ ...clone(request.baseLoadout), armor: {} }]
  for (const slot of ARMOR_LOADOUT_SLOTS) {
    if (Date.now() >= deadline) break
    const expanded: LogicalLoadout[] = []
    for (const partial of beam) {
      for (const armor of candidateBySlot.get(slot) ?? []) expanded.push({ ...partial, armor: { ...partial.armor, [slot]: clone(armor) } })
      if (Date.now() >= deadline) break
    }
    beam = expanded.sort((a, b) => {
      const score = (value: LogicalLoadout) => ARMOR_LOADOUT_SLOTS.reduce((sum, key) => sum + (value.armor[key] ? armorScore(value.armor[key]!, targetIds) : 0), 0)
      return score(b) - score(a)
    }).slice(0, 800)
    checked += expanded.length
    context.progress({ requestId: request.requestId, stage: `组合${slot}`, checked, results: 0, elapsedMs: Date.now() - started })
    await context.checkpoint()
  }
  if (Date.now() >= deadline) {
    context.progress({ requestId: request.requestId, stage: '达到搜索时间上限', checked, results: 0, elapsedMs: Date.now() - started })
    return []
  }
  const fixedCharm = request.baseLoadout.charm && request.baseLoadout.charm.lock !== 'unlocked'
    ? [clone(request.baseLoadout.charm)]
    : [null, ...charmCandidates(snapshot, request)]
  const results: AutoLoadoutResult[] = []; const seen = new Set<string>()
  for (const base of beam) {
    if (Date.now() >= deadline) break
    for (const charm of fixedCharm) {
      if (Date.now() >= deadline) break
      const candidate = assignDecorations(snapshot, request, { ...clone(base), charm: charm ? clone(charm) : null })
      const calculation = calculateLoadout(snapshot, candidate); checked += 1
      if (calculation.encoding === 'blocked') continue
      if (!request.targets.every(target => (calculation.skills.find(value => value.skillId === target.skillId)?.total ?? 0) >= target.threshold)) continue
      const key = fingerprint(candidate); if (seen.has(key)) continue; seen.add(key)
      results.push({ fingerprint: key, loadout: candidate, calculation })
      results.sort((a, b) => Number(a.calculation.legality !== 'confirmed') - Number(b.calculation.legality !== 'confirmed') || b.calculation.maxDefense - a.calculation.maxDefense || b.calculation.slots.reduce((sum, value) => sum + value.remainingSlots, 0) - a.calculation.slots.reduce((sum, value) => sum + value.remainingSlots, 0) || a.fingerprint.localeCompare(b.fingerprint))
      if (results.length > request.resultLimit) results.length = request.resultLimit
    }
    if (checked % 50 === 0) { context.progress({ requestId: request.requestId, stage: '装饰珠求解', checked, results: results.length, elapsedMs: Date.now() - started }); await context.checkpoint() }
  }
  context.progress({ requestId: request.requestId, stage: '正式复核', checked, results: results.length, elapsedMs: Date.now() - started })
  return results
}
