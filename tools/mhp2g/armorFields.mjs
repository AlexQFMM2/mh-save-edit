import assert from 'node:assert/strict'

/** Verified BOOT getters: byte 12 + two defense per capped reinforcement level. */
export function armorFields(bytes) {
  assert.equal(bytes.length, 40, 'Armor record must have 40 bytes')
  const gender = { 1: 'male', 2: 'female', 3: 'both' }[bytes[4] & 3]
  const combat = { 1: 'blademaster', 2: 'gunner', 3: 'both' }[(bytes[4] >> 2) & 3]
  assert(gender && combat, 'Unknown armor applicability flags')
  const thresholds = [...bytes.subarray(20, 27)]
  const cap = values => bytes[12] + 2 * Math.min(63, Math.max(0, Math.max(...values) - 1))
  return { gender, combat, rarity: bytes[5] + 1, priceRaw: bytes.readUInt32LE(8), baseDefense: bytes[12], maxDefense: cap(thresholds), maxBeforeFinalUnlock: cap(thresholds.slice(0, 6)), fireRes: bytes.readInt8(13), waterRes: bytes.readInt8(14), thunderRes: bytes.readInt8(15), dragonRes: bytes.readInt8(16), iceRes: bytes.readInt8(17), slots: bytes[18], thresholds }
}
