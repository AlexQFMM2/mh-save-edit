import { sha256 } from '../../tools/runtime/mh4gCharmNative.mjs'
import { MH4G_WINDOWS_SHA256 } from '../../tools/runtime/mh4gCharmExecution.mjs'
import { replayMh4gAppraisal } from '../../api/loadout/mh4gCharmReplay'

// Model-derived artificial envelope for integrity/admission tests only.
// Never call this independent execution evidence or install it in real assets.
export function syntheticExecution(input) {
  const cases = input.groups.flatMap(group => Array.from({ length: 1024 }, (_, seed) => {
    const { sourceItemId, fulfillment, ...result } = replayMh4gAppraisal(group, [seed, (seed * 977 + 13) & 65535])
    return { ...result, fulfillmentBits: new Uint32Array(new Float32Array([fulfillment]).buffer)[0] }
  }))
  return { format: 'mh4g-charm-execution-v1', engine: 'unicorn-2.1.4-arm1176', fpscr: 0x03000000, nativeSha256: sha256(JSON.stringify(input)), windowsSha256: MH4G_WINDOWS_SHA256, limitations: ['chosen-initial-states-not-game-samples', 'other-acquisition-paths', 'runtime-fpscr-state'], cases }
}
