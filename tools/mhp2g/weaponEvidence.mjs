import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { sha256 } from './sources.mjs'
import { applyWeaponNameReview } from './weaponNameReview.mjs'
import { createHash } from 'node:crypto'

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'))
function checked(file, fingerprint) {
  assert(fingerprint && sha256(file) === fingerprint.sha256 && fs.statSync(file).size === fingerprint.bytes, `Evidence fingerprint mismatch: ${path.basename(file)}`)
  return file
}

/** Consume the frozen review; never reconnect to a host or rerun extraction. */
export function readWeaponEvidence({ review, pilot, localization, nameReview }) {
  const manifest = read(path.join(review, 'manifest.json'))
  assert.equal(manifest.schema, 'mhp2g-weapon-native-review-manifest-v1')
  const input = suffix => {
    const entries = Object.entries(manifest.inputs).filter(([key]) => key.endsWith(suffix))
    assert.equal(entries.length, 1, `Ambiguous review input: ${suffix}`)
    return entries[0][1]
  }
  checked(pilot, input('/pilot-r9/mhp2g-pilot.sqlite'))
  checked(localization, input('/localization-v4/localization.json'))
  const output = name => read(checked(path.join(review, name), manifest.outputs[name]))
  const derived = output('derived-weapons.json'), eligibility = output('acquisition-reachability.json')
  const specials = output('specials-audit.json'), icons = output('icons/manifest.json')
  assert.equal(derived.schema, 'mhp2g-weapon-native-review-v1')
  assert.equal(icons.schema, 'mhp2g-weapon-icons-v1')
  let translations = read(localization)
  assert.equal(translations.schema, 'mhp2g-catalog-localization-v1')
  const nativeReviewSha256 = sha256(path.join(review, 'manifest.json'))
  const nameReviewSha256 = nameReview ? sha256(nameReview) : null
  if (nameReview) translations = applyWeaponNameReview({ document: read(nameReview), translations, derived, eligibility, localizationSha256: sha256(localization), nativeReviewSha256 })
  const sourceHash = nameReviewSha256 ? createHash('sha256').update(`${nativeReviewSha256}:${nameReviewSha256}`).digest('hex') : nativeReviewSha256
  const db = new Database(pilot, { readonly: true, fileMustExist: true })
  try {
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok')
    assert.deepEqual(db.pragma('foreign_key_check'), [])
    const native = new Map(db.prepare('SELECT record_key,row_sha256 FROM records').all().map(r => [r.record_key, r.row_sha256]))
    for (const w of derived.weapons) assert.equal(w.row_sha256, native.get(w.record_key), `Native row mismatch: ${w.record_key}`)
    const recipes = db.prepare("SELECT recipe_key,target_equipment_key,special_target_id FROM creation_recipes WHERE target_equipment_key LIKE 'weapon_%' OR special_target_id IS NOT NULL ORDER BY recipe_key").all()
      .map(r => ({ ...r, materials: db.prepare('SELECT position,item_id,quantity FROM creation_materials WHERE recipe_key=? ORDER BY position').all(r.recipe_key) }))
    const upgrades = db.prepare("SELECT upgrade_key,equipment_key FROM upgrade_records WHERE equipment_key LIKE 'weapon_%' ORDER BY upgrade_key").all()
      .map(r => ({ ...r, materials: db.prepare('SELECT position,item_id,quantity FROM upgrade_materials WHERE upgrade_key=? ORDER BY position').all(r.upgrade_key) }))
    const dual = db.prepare('SELECT * FROM weapon_dual_attributes ORDER BY equipment_key,position').all()
    const iconFiles = icons.icons.map(icon => {
      assert.match(icon.pngSha256, /^[a-f0-9]{64}$/)
      assert.equal(icon.path, `catalog/icons/${icon.pngSha256}.png`)
      const file = path.join(review, 'icons', `${icon.pngSha256}.png`)
      assert.equal(sha256(file), icon.pngSha256, 'Icon fingerprint mismatch')
      return { file, path: icon.path, sha256: icon.pngSha256 }
    })
    return { derived, eligibility, specials, icons, translations, recipes, upgrades, dual, iconFiles, sourceHash, nativeReviewSha256, nameReviewSha256 }
  } finally { db.close() }
}
