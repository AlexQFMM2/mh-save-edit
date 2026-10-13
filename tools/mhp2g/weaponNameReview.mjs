import assert from 'node:assert/strict'

/** A new private review overlays names without rewriting frozen native evidence. */
export function applyWeaponNameReview({ document, translations, derived, eligibility, localizationSha256, nativeReviewSha256 }) {
  assert.equal(document.schema, 'mhp2g-weapon-name-review-v1')
  assert.equal(document.localizationSha256, localizationSha256, 'Weapon name review localization fingerprint mismatch')
  assert.equal(document.nativeReviewSha256, nativeReviewSha256, 'Weapon name review native fingerprint mismatch')
  assert(Array.isArray(document.entries), 'Weapon name review requires entries')
  const native = new Map(derived.weapons.map(w => [w.record_key, w]))
  const pending = new Set(eligibility.reachable.filter(key => {
    const unit = translations.units[translations.bindings[key]?.name]
    assert(unit, `Missing weapon name binding: ${key}`)
    return unit.status === 'pending'
  }))
  const result = structuredClone(translations), seen = new Set(), seenText = new Set()
  for (const row of document.entries) {
    assert(!seen.has(row.weaponKey), `Duplicate weapon name review: ${row.weaponKey}`)
    seen.add(row.weaponKey)
    assert(pending.has(row.weaponKey), `Weapon name review outside pending normal catalog: ${row.weaponKey}`)
    const w = native.get(row.weaponKey), binding = result.bindings[row.weaponKey]
    assert(w && binding?.kind === 'weapon', `Missing native weapon: ${row.weaponKey}`)
    assert.equal(row.textKey, binding.name, `Weapon name review binding mismatch: ${row.weaponKey}`)
    assert(!seenText.has(row.textKey), `Duplicate weapon name text binding: ${row.textKey}`)
    seenText.add(row.textKey)
    assert.equal(row.nativeRowSha256, w.row_sha256, `Weapon name review row mismatch: ${row.weaponKey}`)
    const unit = result.units[binding.name]
    assert.equal(row.japanese, w.nameJa, `Weapon name review original mismatch: ${row.weaponKey}`)
    assert.equal(row.japanese, unit.japanese, `Weapon name review text mismatch: ${row.weaponKey}`)
    assert(typeof row.chinese === 'string' && row.chinese === row.chinese.trim() && /\p{Script=Han}/u.test(row.chinese) && !/[\u3040-\u30ff]/u.test(row.chinese), `Invalid Chinese weapon name: ${row.weaponKey}`)
    assert(typeof row.basis === 'string' && row.basis.trim(), `Missing weapon name review basis: ${row.weaponKey}`)
    Object.assign(unit, { chinese: row.chinese, status: 'reviewed', reviewBasis: row.basis })
  }
  assert.equal(seen.size, pending.size, 'Incomplete pending weapon name review')
  if (result.counts?.weapon) {
    result.counts.weapon.pending -= seen.size
    result.counts.weapon.reviewed += seen.size
  }
  return result
}
