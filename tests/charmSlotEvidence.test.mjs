import { describe, expect, it } from 'vitest'
import { compareNativeSlotAvailability } from '../tools/runtime/charmSlotEvidence.mjs'

function fixture() {
  const data = Buffer.alloc(92); data.writeUInt32LE(21, 4)
  for (let i = 0; i <= 20; i++) data.set([25, 25, 25, 25], 8 + i * 4)
  const reference = Array.from({ length: 20 }, (_, i) => ({ fulfillment: i + 1, slot1_threshold: 25, slot2_threshold: 50, slot3_threshold: 75 }))
  return { data, reference }
}
describe('private native charm slot cross-check', () => {
  it('verifies every synthetic slot probability interval', () => {
    const { data, reference } = fixture()
    expect(compareNativeSlotAvailability(data, reference)).toEqual([])
  })
  it('reports probability changes without mistaking them for slot availability changes', () => {
    const { data, reference } = fixture(); data.set([26, 24, 25, 25], 12)
    expect(compareNativeSlotAvailability(data, reference)).toEqual([{ fulfillment: 1, slot: 1, native: 26, reference: 25 }])
  })
  it('fails closed on a changed possible slot or incomplete input', () => {
    const { data, reference } = fixture(); data.set([25, 0, 50, 25], 12)
    expect(() => compareNativeSlotAvailability(data, reference)).toThrow(/availability/)
    expect(() => compareNativeSlotAvailability(data, reference.slice(1))).toThrow(/Incomplete/)
    expect(() => compareNativeSlotAvailability(data.subarray(0, 88), reference)).toThrow(/size/)
  })
})
