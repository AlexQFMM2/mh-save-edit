import { createHash } from 'node:crypto'

export const hashCharmSlotRows = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')
export function readCharmSlotEvidenceRows(db) {
  return db.prepare('SELECT t.id class_id,t.max_slots,t.rarity,r.fulfillment,r.slot1_threshold,r.slot2_threshold,r.slot3_threshold FROM cn__talismans t JOIN cn__talisman_slot_thresholds r ON r.rarity_marker=t.rarity WHERE t.id>0 ORDER BY t.id,r.fulfillment').all()
}

/** The four weights are independently compared against pinned cumulative thresholds.
 * Only slot availability is certified; percent-probability differences remain reported. */
export function compareNativeSlotAvailability(buffer, reference) {
  if (buffer.length !== 92 || buffer.readUInt32LE(4) !== 21) throw new Error('Unexpected amulet slot table size/count')
  if (reference.length !== 20 || reference.some((row, index) => row.fulfillment !== index + 1)) throw new Error('Incomplete slot threshold reference')
  const differences = []
  for (const row of reference) {
    const weights = [...buffer.subarray(8 + row.fulfillment * 4, 12 + row.fulfillment * 4)]
    if (weights.reduce((sum, value) => sum + value, 0) !== 100) throw new Error(`Invalid probability total at fulfillment ${row.fulfillment}`)
    const referenceThresholds = [row.slot1_threshold, row.slot2_threshold, row.slot3_threshold]
    if (referenceThresholds.some((value, index) => !Number.isInteger(value) || value < 0 || value > 100 || index > 0 && value < referenceThresholds[index - 1])) throw new Error('Invalid cumulative reference thresholds')
    if ((weights[0] > 0) !== (referenceThresholds[0] > 0)) throw new Error(`Native/reference slot availability disagrees at ${row.fulfillment}/0`)
    for (let slot = 1; slot <= 3; slot++) {
      const cumulative = weights.slice(0, slot).reduce((sum, value) => sum + value, 0)
      // Compare exact slot availability, not just the maximum possible slot.
      const next = slot === 3 ? 100 : referenceThresholds[slot]
      if ((weights[slot] > 0) !== (next > referenceThresholds[slot - 1])) throw new Error(`Native/reference slot availability disagrees at ${row.fulfillment}/${slot}`)
      if (cumulative !== referenceThresholds[slot - 1]) differences.push({ fulfillment: row.fulfillment, slot, native: cumulative, reference: referenceThresholds[slot - 1] })
    }
  }
  return differences
}
