import { replayMh4gAppraisal } from '../../api/loadout/mh4gCharmReplay'
import { validateMh4gExecution } from './mh4gCharmExecution.mjs'
import { sha256, validateMh4gNativeInput } from './mh4gCharmNative.mjs'
import type { Mh4gCharmNativeInput, Mh4gExecutionInput } from '../../api/loadout/mh4gCharmTypes'
import type { RuntimeWitnessData, RuntimeWitnessTuple } from './mh4gCharmWitnessData.mjs'

/** Producer-only verification. Never imported by the application: the complete
 * execution grid and debug provenance remain local research inputs. */
export function projectMh4gWitnesses(nativeText: string, rawExecution: unknown): { native: Mh4gCharmNativeInput; payload: RuntimeWitnessData } {
  const source = validateMh4gNativeInput(JSON.parse(nativeText))
  const execution = validateMh4gExecution(rawExecution) as Mh4gExecutionInput
  if (execution.nativeSha256 !== sha256(nativeText)) throw new Error('Execution used a different native input file')
  const outcomes = new Map<string, RuntimeWitnessTuple>()
  for (const expected of execution.cases) {
    const result = replayMh4gAppraisal(source.groups[expected.groupIndex], expected.initialState)
    const bits = new Uint32Array(new Float32Array([result.fulfillment]).buffer)[0]
    const actual = [result.classId, result.slots, result.skill1Id, result.skill1Points, result.skill2Id, result.skill2Points, ...result.finalState, bits, result.row]
    const wanted = [expected.classId, expected.slots, expected.skill1Id, expected.skill1Points, expected.skill2Id, expected.skill2Points, ...expected.finalState, expected.fulfillmentBits, expected.row]
    if (actual.some((value, i) => value !== wanted[i])) throw new Error(`回放与独立执行结果不符：组 ${expected.groupIndex}`)
    const row: RuntimeWitnessTuple = [result.classId, result.slots, result.skill1Id, result.skill1Points, result.skill2Id, result.skill2Points]
    outcomes.set(row.join(':'), row)
  }
  const pick = <T extends object, K extends keyof T>(value: T, keys: K[]): Pick<T, K> => Object.fromEntries(Object.entries(value).filter(([key]) => keys.includes(key as K))) as Pick<T, K>
  const clean = structuredClone(source)
  const native: Mh4gCharmNativeInput = {
    ...pick(clean, ['format', 'gameId', 'algorithm', 'source', 'evidence', 'groups']),
    source: pick(clean.source, ['codeSha256', 'expandedSha256']),
    evidence: pick(clean.evidence, ['kind', 'scope', 'limitations']),
    groups: clean.groups.map(group => ({
      ...pick(group, ['groupIndex', 'sourceItemId', 'classes', 'secondSkillAttemptPercent', 'pools', 'slotWeights', 'slotSha256']),
      pools: { A: pick(group.pools.A, ['rows', 'sha256']), B: pick(group.pools.B, ['rows', 'sha256']) },
    })),
  }
  return { native, payload: { format: 'mh4g-charm-witnesses-v1', nativeSha256: sha256(JSON.stringify(native)), outcomes: [...outcomes.values()] } }
}
