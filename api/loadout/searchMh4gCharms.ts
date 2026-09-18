import { applyCharmValidation } from './charm'
import { mh4gAutomaticEvidenceWarning } from './mh4gCharmRules'
import { MH4G_WITNESS_COVERAGE_MESSAGE } from './mh4gCharmWitnesses'
import type { SearchControl } from './searchControl'
import type { LoadoutCatalogSnapshot, LogicalLoadout } from './types'

type Candidate = NonNullable<LogicalLoadout['charm']>

/** Bounded independently executed outcomes, never a product of marginal ranges. */
export async function searchMh4gCharms(snapshot: LoadoutCatalogSnapshot, relevant: Set<number>, control: SearchControl): Promise<{ candidates: Candidate[]; warnings: string[] }> {
  const candidates: Candidate[] = []
  if (!snapshot.mh4gCharmRules || !snapshot.mh4gCharmWitnessSource || !snapshot.mh4gCharmWitnesses?.length) {
    return { candidates, warnings: [snapshot.mh4gCharmRulesIssue ?? snapshot.mh4gCharmWitnessIssue ?? mh4gAutomaticEvidenceWarning(snapshot.mh4gCharmRules)] }
  }
  const classes = new Map(snapshot.charmClasses.map(value => [value.classId, value]))
  const names = new Map(snapshot.skills.map(value => [value.skillId, value.nameCn]))
  const fillers = new Map<number, Candidate>()
  let rejected = false
  for (const [classId, slots, aId, aPoints, bId, bPoints] of snapshot.mh4gCharmWitnesses) {
    await control.tick()
    const cls = classes.get(classId)
    if (!cls) { rejected = true; continue }
    const relevantPoints = relevant.has(aId) && aPoints > 0 || relevant.has(bId) && bPoints > 0
    // An actual nonnegative record with an irrelevant A skill may supply slots;
    // never invent an impossible A-empty/B-only or pure-slot appraisal record.
    const filler = !relevantPoints && slots > 0 && aPoints >= 0 && bPoints >= 0 && !fillers.has(slots)
    if (!relevantPoints && !filler) continue
    const value = applyCharmValidation<Candidate>(snapshot, {
      kind: 'charm', gameId: 'mh4g', classId, classNameCn: cls.nameCn, iconPath: cls.iconPath, slots,
      skill1: aId ? { skillId: aId, points: aPoints, nameCn: names.get(aId) ?? String(aId) } : null,
      skill2: bId ? { skillId: bId, points: bPoints, nameCn: names.get(bId) ?? String(bId) } : null,
      decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked',
    })
    if (value.legality !== 'confirmed' || value.encoding !== 'encodable') { rejected = true; continue }
    if (relevantPoints) candidates.push(value)
    else fillers.set(slots, value)
  }
  candidates.push(...fillers.values())
  const score = (value: Candidate) => (value.skill1 && relevant.has(value.skill1.skillId) ? value.skill1.points : 0) + (value.skill2 && relevant.has(value.skill2.skillId) ? value.skill2.points : 0) + value.slots * 2
  candidates.sort((a, b) => score(b) - score(a))
  const warnings = [MH4G_WITNESS_COVERAGE_MESSAGE]
  if (rejected) warnings.push('部分 4G 见证候选未通过当前资料复核，已排除。')
  return { candidates, warnings }
}
