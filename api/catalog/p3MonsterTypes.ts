/** P3 observations carry source keys, never invented task/save identities. */
export type P3MonsterSource = { kind: 'native' | 'reference'; label: string; key: string; sha256: string; url?: string }
export type P3MonsterScope = 'normal' | 'extended' | 'all'
export type P3MonsterCoverage = { status: 'collected' | 'partial' | 'not-collected' | 'checked-empty'; note: string }
export type P3MonsterAppearance = {
  sourceKey: string
  nameCn: string | null
  nameJp: string
  fields: { label: string; value: string }[]
  source: P3MonsterSource
}
export type P3MonsterWeakness = { source: P3MonsterSource; partJp: string; conditionJp: string; conditionScope: 'part' | 'reference'; note: string | null }
export type P3MonsterAilment = {
  source: P3MonsterSource
  rawJp: string
  decayAmount?: number | null
  decayIntervalSeconds?: number | null
  damageIntervalSeconds?: number | null
  damageUnit: 'unknown' | 'unspecified' | 'per-interval' | 'total'
  note: string
}
export type P3MonsterTrap = {
  source: P3MonsterSource
  effect: 'effective' | 'ineffective' | 'conditional' | 'unknown'
  conditionCn?: string | null
  conditionJp: string
  repetitions: { fromUse: number; onward: boolean; seconds: number; fatiguedSeconds: number | null; enragedSeconds: number | null }[]
}
export type P3MonsterDrop = {
  source: P3MonsterSource
  kind: 'capture' | 'break' | 'carve' | 'shiny' | 'gather'
  methodJp: string
  rankJp: string
  conditionJp: string
  attemptCount: number | null
  attemptCountJp: string | null
  rawWeight: number | null
  rawWeightSource: string | null
  quantityNote: string | null
}
export type P3MonsterData = {
  nameSource: string
  descriptionCn: string | null
  descriptionJp: string | null
  descriptionSource: string | null
  descriptionTextIndex: number | null
  coverage: Record<'weakness' | 'ailments' | 'traps' | 'drops' | 'appearances', P3MonsterCoverage>
  notes: string[]
  appearances: P3MonsterAppearance[]
  sourceVersions: { label: string; url: string; sha256: string }[]
  referenceNotes: { section: string; textJp: string }[]
  noRewardRoutes: { methodJp: string; rankId: number; note: string; source: P3MonsterSource }[]
  combatReference?: { stateJp: string; attackMultiplierJp: string; defenseMultiplierJp: string; noteJp: string; source: P3MonsterSource }[]
}
