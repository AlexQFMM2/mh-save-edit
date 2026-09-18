export type Mh4gSkillRange = [skillId: number, minPoints: number, maxPoints: number]
/** Exact producer-verified outcome; development execution states never ship. */
export type Mh4gCharmWitness = [classId: number, slots: number, aId: number, aPoints: number, bId: number, bPoints: number]
export type Mh4gExecutionCase = {
  groupIndex: number; initialState: [number, number]; finalState: [number, number]
  classId: number; slots: number; skill1Id: number; skill1Points: number; skill2Id: number; skill2Points: number
  fulfillmentBits: number; row: number
}
export type Mh4gExecutionInput = {
  format: 'mh4g-charm-execution-v1'; engine: 'unicorn-2.1.4-arm1176'; fpscr: number
  nativeSha256: string; windowsSha256: string; limitations: string[]; cases: Mh4gExecutionCase[]
}
export type Mh4gClassBand = { classId: number; minScore: number; maxScore: number | null }
export type Mh4gAppraisalGroup = {
  groupIndex: number
  sourceItemId: number
  classes: Mh4gClassBand[]
  secondSkillAttemptPercent: number
  pools: Record<'A' | 'B', { rows: Mh4gSkillRange[]; sha256: string; address?: number }>
  slotWeights: number[][]
  slotSha256: string
  slotAddress?: number
}

/** Static appraisal evidence is deliberately not an exhaustive reachability proof. */
export type Mh4gCharmNativeInput = {
  format: 'mh4g-charm-native-v1'
  gameId: 'mh4g'
  algorithm: 'appraisal-f32-v1'
  source: { path?: string; codeSha256: string; expandedSha256: string }
  evidence: {
    kind: 'native-static'
    scope: 'reviewed-appraisal-path'
    limitations: string[]
  }
  groups: Mh4gAppraisalGroup[]
}
