import { createHash } from 'node:crypto'
import { calculateLoadout } from './calculator'
import { getGameLoadoutRules } from './rules'
import { searchCharms } from './searchCharms'
import { createSearchBounds } from './searchBounds'
import { assignDecorations } from './searchDecorations'
import { SearchBudgetExpired, SearchControl, type SearchContext } from './searchControl'
import { ARMOR_LOADOUT_SLOTS, type AutoLoadoutRequest, type AutoLoadoutResult, type AutoLoadoutSearchReport, type LoadoutArmor, type LoadoutCatalogSnapshot, type LogicalLoadout } from './types'

function fingerprint(loadout: LogicalLoadout) {
  return createHash('sha256').update(JSON.stringify({ weapon: loadout.weapon?.candidateKey, armor: ARMOR_LOADOUT_SLOTS.map(slot => loadout.armor[slot]?.candidateKey), charm: loadout.charm && [loadout.charm.classId, loadout.charm.slots, loadout.charm.skill1, loadout.charm.skill2], decorations: [loadout.weapon, ...ARMOR_LOADOUT_SLOTS.map(slot => loadout.armor[slot]), loadout.charm].map(value => value?.decorations.map(point => point.saveId).sort((a, b) => a - b)) })).digest('hex').slice(0, 20)
}

/** A complete gear combination is checked immediately; no Cartesian product is materialized. */
export async function runAutoLoadout(snapshot: LoadoutCatalogSnapshot, request: AutoLoadoutRequest, context: SearchContext): Promise<AutoLoadoutSearchReport> {
  if (!request.baseLoadout.weapon) throw new Error('自动配装需要先选择具体武器')
  if (request.dataVersion !== snapshot.dataVersion) throw new Error('配装数据版本已变化，请重新打开自动配装')
  const control = new SearchControl(request, context)
  const results: AutoLoadoutResult[] = []
  const seen = new Set<string>()
  const warnings: string[] = []
  let reason: AutoLoadoutResult['incompleteReason']
  const rules = getGameLoadoutRules(snapshot.gameId)
  const relevant = new Set([...request.targets.map(target => target.skillId), rules.torsoSkillId, ...(snapshot.gameId === 'mhgu' ? [204, 205] : [])])
  const weaponCombat = rules.getWeaponCombatType(request.baseLoadout.weapon)
  const score = (armor: LoadoutArmor) => armor.skills.reduce((sum, point) => sum + (relevant.has(point.skillId) ? point.points * 100 : 0), 0) + armor.slots * 20
  const base = structuredClone(request.baseLoadout)
  base.armor = {}
  const bySlot: LoadoutArmor[][] = []
  try {
    for (const part of ARMOR_LOADOUT_SLOTS) {
      const fixed = request.baseLoadout.armor[part]
      if (fixed && fixed.lock !== 'unlocked') bySlot.push([structuredClone(fixed)])
      else {
        const candidates: LoadoutArmor[] = []
        for (const armor of snapshot.armors) {
          await control.tick()
          if (armor.part === part && armor.sourceKind === 'catalog' && armor.saveType != null && armor.saveId != null && (armor.combat === 'both' || armor.combat === weaponCombat) && (armor.gender === 'both' || armor.gender === request.baseLoadout.gender)) candidates.push({ ...armor, decorations: [], lock: 'unlocked' })
        }
        // Do not clamp signed points or prune modifier-bearing candidates by a flat score.
        candidates.sort((a, b) => score(b) - score(a) || b.maxDefense - a.maxDefense || a.candidateKey.localeCompare(b.candidateKey))
        bySlot.push(candidates)
      }
    }
    control.stage = '准备护石候选'
    const fixedCharm = request.baseLoadout.charm && request.baseLoadout.charm.lock !== 'unlocked'
    const generated = fixedCharm ? { candidates: [], warnings: [] } : await searchCharms(snapshot, relevant, control)
    warnings.push(...generated.warnings)
    const charms = fixedCharm ? [structuredClone(request.baseLoadout.charm)] : [...generated.candidates, null]
    const canReach = createSearchBounds(snapshot, request, bySlot, charms)
    const search = async (depth: number): Promise<boolean> => {
      await control.tick()
      if (!canReach(base, depth)) return false
      if (depth < ARMOR_LOADOUT_SLOTS.length) {
        control.stage = `组合防具 ${depth + 1}/5`
        const part = ARMOR_LOADOUT_SLOTS[depth]
        for (const armor of bySlot[depth]) {
          base.armor[part] = armor
          if (await search(depth + 1)) return true
        }
        delete base.armor[part]
        return false
      }
      for (const charm of charms) {
        control.stage = '装饰珠求解'
        await control.tick()
        base.charm = charm
        const candidate = await assignDecorations(snapshot, request, base, relevant, control)
        control.verified++
        if (!candidate) continue
        const calculation = calculateLoadout(snapshot, candidate)
        if (calculation.encoding === 'blocked' || !request.targets.every(target => (calculation.skills.find(value => value.skillId === target.skillId)?.total ?? 0) >= target.threshold)) continue
        const key = fingerprint(candidate)
        if (seen.has(key)) continue
        seen.add(key)
        results.push({ fingerprint: key, loadout: candidate, calculation })
        control.results = results.length
        context.progress(control.progress())
        if (results.length >= request.resultLimit) return true
      }
      return false
    }
    if (await search(0)) reason = 'candidate-bound'
    else if (warnings.length) reason = 'unknown-charm-range'
  } catch (error) {
    if (!(error instanceof SearchBudgetExpired)) throw error
    reason = 'timeout'
  }
  results.sort((a, b) => Number(a.calculation.legality !== 'confirmed') - Number(b.calculation.legality !== 'confirmed') || b.calculation.maxDefense - a.calculation.maxDefense || a.fingerprint.localeCompare(b.fingerprint))
  const searchComplete = reason == null
  for (const result of results) { result.searchComplete = searchComplete; result.incompleteReason = reason }
  const stage = reason === 'timeout' ? '达到时间上限，未搜完' : reason === 'candidate-bound' ? '已找到目标数量，未穷举' : reason === 'unknown-charm-range' ? '当前候选搜索结束，护石规则覆盖不完整' : '已完成当前候选域搜索'
  const progress = { ...control.progress(), stage, searchComplete, incompleteReason: reason, coverageWarnings: warnings }
  context.progress(progress)
  return { results, progress }
}
