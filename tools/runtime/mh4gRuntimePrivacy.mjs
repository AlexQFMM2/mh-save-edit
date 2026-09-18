import { readStoredMh4gNative } from './mh4gCharmNative.mjs'
import { readStoredMh4gWitnessData } from './mh4gCharmWitnessData.mjs'

export function assertNoMh4gReportBytes(bytes) {
  for (const marker of ['"initialState"', '"finalState"', '"fulfillmentBits"', '"slotAddress"', 'mh4g-charm-execution-v1']) {
    if (bytes.includes(Buffer.from(marker))) throw new Error(`MH4G development report bytes remain: ${marker}; do not distribute this database`)
  }
}

export function assertPreparedMh4gRuntime(db, expectedHash) {
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_mh4g_charm_execution'").get()) throw new Error('MH4G runtime still contains a development execution report; prepare compact witnesses before packaging')
  if (db.prepare("SELECT 1 FROM catalog_build_metadata WHERE domain='mh4g-charm-execution' AND game_id='mh4g'").get()) throw new Error('MH4G retired execution metadata remains')
  const native = readStoredMh4gNative(db)
  if (!native) throw new Error('MH4G runtime rules missing')
  const exact = (value, allowed) => {
    if (!value || Object.keys(value).length !== allowed.length || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('MH4G runtime rules contain missing or non-runtime fields')
  }
  exact(native, ['format', 'gameId', 'algorithm', 'source', 'evidence', 'groups'])
  exact(native.source, ['codeSha256', 'expandedSha256'])
  exact(native.evidence, ['kind', 'scope', 'limitations'])
  for (const group of native.groups) {
    exact(group, ['groupIndex', 'sourceItemId', 'classes', 'secondSkillAttemptPercent', 'pools', 'slotWeights', 'slotSha256'])
    exact(group.pools, ['A', 'B'])
    for (const pool of Object.values(group.pools)) exact(pool, ['rows', 'sha256'])
    for (const cls of group.classes) exact(cls, ['classId', 'minScore', 'maxScore'])
  }
  const witnesses = readStoredMh4gWitnessData(db, native, expectedHash)
  if (!witnesses) throw new Error('MH4G compact runtime witnesses missing')
  return { outcomes: witnesses.outcomes.length, developmentReport: false }
}
