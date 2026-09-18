import { applyCharmValidation } from './charm'
import { searchMh4gCharms } from './searchMh4gCharms'
import type { LoadoutCatalogSnapshot, LoadoutCharm, LogicalLoadout } from './types'
import type { SearchControl } from './searchControl'

/** Relevant positive skill points plus slots; never turns NULL into a slot count. */
export async function searchCharms(snapshot: LoadoutCatalogSnapshot, relevant: Set<number>, control: SearchControl) {
  const candidates: NonNullable<LogicalLoadout['charm']>[] = []
  const warnings = new Set<string>()
  const seen = new Set<string>()
  const unknownNotice = snapshot.gameId === 'mhgu' ? '部分护石的技能范围或孔位证据未确认，未自动生成；可显式固定已有护石作为输入。' : '部分护石的联合技能/孔位生成规则未确认，未自动生成；可显式固定已有护石作为输入。'
  if (snapshot.gameId === 'mh4g') return searchMh4gCharms(snapshot, relevant, control)
  const push = (charm: NonNullable<LogicalLoadout['charm']>) => {
    const value = applyCharmValidation(snapshot, charm)
    if (value.legality !== 'confirmed' || value.encoding !== 'encodable') { if (value.legality === 'unknown') warnings.add(unknownNotice); return }
    const key = JSON.stringify([value.classId,value.slots,value.skill1,value.skill2])
    if (!seen.has(key)) { seen.add(key); candidates.push(value) }
  }
  if (snapshot.gameId === 'mh3g' && snapshot.charmCombinations) {
    const classes = new Map(snapshot.charmClasses.map(value => [value.classId, value]))
    const names = new Map(snapshot.skills.map(value => [value.skillId, value.nameCn]))
    for (const [classId, slots, aId, aPoints, bId, bPoints] of snapshot.charmCombinations) {
      await control.tick()
      const cls = classes.get(classId)
      if (!cls || !((relevant.has(aId) && aPoints > 0) || (relevant.has(bId) && bPoints > 0) || aPoints === 0 && bPoints === 0)) continue
      push({ kind: 'charm', gameId: snapshot.gameId, classId, classNameCn: cls.nameCn, iconPath: cls.iconPath, slots, skill1: aPoints ? { skillId: aId, points: aPoints, nameCn: names.get(aId) ?? String(aId) } : null, skill2: bPoints ? { skillId: bId, points: bPoints, nameCn: names.get(bId) ?? String(bId) } : null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked' })
    }
    candidates.sort((a, b) => (b.skill1?.points ?? 0) + (b.skill2?.points ?? 0) + b.slots * 2 - (a.skill1?.points ?? 0) - (a.skill2?.points ?? 0) - a.slots * 2)
    return { candidates, warnings: [...warnings] }
  }
  for (const cls of snapshot.charmClasses) {
    const base: NonNullable<LogicalLoadout['charm']> = { kind: 'charm', gameId: snapshot.gameId, classId: cls.classId, classNameCn: cls.nameCn, iconPath: cls.iconPath, slots: 0, skill1: null, skill2: null, decorations: [], legality: 'unknown', encoding: 'encodable', issues: [], lock: 'unlocked' }
    const byPosition: Record<'A' | 'B', { skill: NonNullable<LoadoutCharm['skill1']>; slots: number | null }[]> = { A: [], B: [] }
    const ranges = snapshot.charmRanges.filter(range => range.classId === cls.classId && relevant.has(range.skillId) && range.maxPoints > 0)
    for (let slots = 0; slots <= Math.min(3, cls.maxSlots); slots++) push({ ...base, slots })
    for (const range of ranges) {
      const explicit = range.status === 'exact' && range.slotCount != null
      const verifiedRules = snapshot.charmSlotRules?.some(rule => rule.classId === cls.classId && rule.evidence === 'verified')
      if (!explicit && !verifiedRules) { warnings.add(unknownNotice); continue }
      for (let points = Math.max(1, range.minPoints); points <= range.maxPoints; points++) {
        await control.tick()
        const skill = { skillId: range.skillId, nameCn: snapshot.skills.find(value => value.skillId === range.skillId)?.nameCn ?? String(range.skillId), points }
        const slotsList = explicit ? [range.slotCount!] : Array.from({ length: Math.min(3, cls.maxSlots) + 1 }, (_, slot) => slot)
        byPosition[range.position].push({ skill, slots: explicit ? range.slotCount : null })
        for (const slots of slotsList) push({ ...base, slots, skill1: range.position === 'A' ? skill : null, skill2: range.position === 'B' ? skill : null })
      }
    }
    for (const a of byPosition.A) for (const b of byPosition.B) {
      await control.tick()
      if (a.skill.skillId === b.skill.skillId) continue
      for (let slots = 0; slots <= Math.min(3, cls.maxSlots); slots++) {
        if (a.slots != null && a.slots !== slots || b.slots != null && b.slots !== slots) continue
        push({ ...base, slots, skill1: a.skill, skill2: b.skill })
      }
    }
  }
  const score = (charm: LoadoutCharm) => (charm.skill1?.points ?? 0) + (charm.skill2?.points ?? 0) + charm.slots * 2
  candidates.sort((a, b) => score(b) - score(a))
  return { candidates, warnings: [...warnings] }
}
