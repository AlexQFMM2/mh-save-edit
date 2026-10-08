import { createHash } from 'node:crypto'

const gameId = 'mh4g'
const revision = 'mh4g-armor-native-identities-v1'
const domain = 'armor-save-identities'
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const partTypes = { head: 5, chest: 1, arms: 2, waist: 3, legs: 4 }
const stats = ['rarity', 'slots', 'base_defense', 'fire_res', 'water_res', 'thunder_res', 'ice_res', 'dragon_res']
const normalize = value => String(value ?? '').trim().normalize('NFKC')
// Reviewed against exact-name + complete native-stat matches for each flag value.
// Do not use armors.gender/combat/max_defense: those are older Dex-derived joins.
const genders = new Map([[5, 'male'], [6, 'female'], [7, 'both'], [13, 'male'], [14, 'female'], [15, 'both'], [25, 'male'], [26, 'female'], [27, 'both'], [29, 'male'], [30, 'female'], [31, 'both']])
const identityKey = row => `${row.save_type}:${row.save_id}`
const skillKey = rows => JSON.stringify(rows.filter(row => row[1] !== 0).sort((a, b) => a[0] - b[0]))
const group = (rows, key) => {
  const result = new Map()
  for (const row of rows) { const id = key(row); result.set(id, [...(result.get(id) ?? []), row]) }
  return result
}

function verifyNativeRow(row, skills) {
  if (!/^[0-9a-f]{80}$/i.test(row.raw_hex)) throw new Error(`MH4G invalid native armor bytes: ${identityKey(row)}`)
  const raw = Buffer.from(row.raw_hex, 'hex')
  const decoded = [raw[5] + 1, raw[17], raw[7], raw.readInt8(12), raw.readInt8(13), raw.readInt8(14), raw.readInt8(16), raw.readInt8(15)]
  const nativeSkills = []
  for (let offset = 30; offset < 40; offset += 2) if (raw[offset] && raw[offset + 1]) nativeSkills.push([raw[offset], raw.readInt8(offset + 1)])
  if (stats.some((field, index) => row[field] !== decoded[index]) || row.model_flags !== raw[4] || row.special_flags !== raw[6] || (raw[6] & 0x80) || skillKey(nativeSkills) !== skillKey(skills)) {
    throw new Error(`MH4G armor disagrees with native bytes: ${identityKey(row)}`)
  }
}

/** Build an explicit crosswalk from independent native values, never row order or a translated-name fallback. */
export function inspectMh4gArmorIdentities(db) {
  const armors = db.prepare('SELECT * FROM catalog_armors WHERE game_id=? AND is_placeholder=0 ORDER BY dex_id').all(gameId)
  const native = db.prepare('SELECT * FROM armors WHERE is_relic=0 AND save_id>0 ORDER BY save_type,save_id').all()
  const catalogSkills = group(db.prepare('SELECT armor_dex_id,skill_id,points FROM catalog_armor_skills WHERE game_id=? ORDER BY armor_dex_id,skill_id').all(gameId), row => row.armor_dex_id)
  const nativeSkills = group(db.prepare('SELECT save_type,save_id,skill_tree_id,points FROM armor_skill_points ORDER BY save_type,save_id,skill_tree_id').all(), identityKey)
  if (!armors.length || !native.length) throw new Error('MH4G missing armor identity inputs')
  const fingerprint = (row, type, skills) => JSON.stringify([type, ...stats.map(field => row[field]), skillKey(skills)])
  const nativeFingerprint = row => fingerprint(row, row.save_type, (nativeSkills.get(identityKey(row)) ?? []).map(skill => [skill.skill_tree_id, skill.points]))
  for (const row of native) verifyNativeRow(row, (nativeSkills.get(identityKey(row)) ?? []).map(skill => [skill.skill_tree_id, skill.points]))
  const byStats = group(native.filter(row => !/dummy|未使用|无装备|^无$|^---$/iu.test(row.name_cn)), nativeFingerprint)
  const identities = []; const statuses = []; const unresolved = []; const claimed = new Map()
  for (const armor of armors) {
    // Dex contains regional replacements, including identical stats with different gender restrictions.
    if (/^【美】/u.test(armor.name_cn)) { statuses.push([armor.dex_id, 'foreign_variant']); continue }
    const signature = fingerprint(armor, partTypes[armor.part], (catalogSkills.get(armor.dex_id) ?? []).map(skill => [skill.skill_id, skill.points]))
    const candidates = byStats.get(signature) ?? []
    const exact = candidates.filter(row => normalize(row.name_en) && normalize(row.name_en) === normalize(armor.name_en))
    let selected = exact.length === 1 ? exact : candidates.length === 1 ? candidates : []
    let status = exact.length === 1 ? 'confirmed_native_name_stats' : 'confirmed_native_unique_stats'
    if (!selected.length && candidates.length === 2 && armor.gender === 'both'
      && normalize(candidates[0].name_cn) === normalize(candidates[1].name_cn)
      && (candidates[0].model_flags & ~3) === (candidates[1].model_flags & ~3)
      && new Set(candidates.map(row => genders.get(row.model_flags))).size === 2
      && candidates.every(row => ['male', 'female'].includes(genders.get(row.model_flags)))) {
      selected = candidates; status = 'confirmed_native_gender_variants'
    }
    if (!selected.length || (selected.length === 1 && genders.get(selected[0].model_flags) !== armor.gender)) {
      statuses.push([armor.dex_id, 'unresolved_native_identity'])
      unresolved.push({ dexId: armor.dex_id, candidates: candidates.map(identityKey), reason: selected.length ? 'gender-mismatch' : candidates.length ? 'ambiguous' : 'no-native-match' })
      continue
    }
    statuses.push([armor.dex_id, 'confirmed'])
    for (const row of selected) {
      const key = identityKey(row)
      if (claimed.has(key)) throw new Error(`MH4G duplicate native identity ${key}: Dex ${claimed.get(key)} and ${armor.dex_id}`)
      claimed.set(key, armor.dex_id)
      identities.push({ armor_dex_id: armor.dex_id, save_type: row.save_type, save_id: row.save_id, gender: genders.get(row.model_flags), mapping_status: status, source: `${revision}+${row.source}` })
    }
  }
  const sources = db.prepare("SELECT name,sha256 FROM sources WHERE name LIKE 'native/%' OR name LIKE 'csv/%/armor_%' ORDER BY name").all()
  const sourceHash = digest({ sources, native: native.map(row => [row.save_type, row.save_id, row.raw_hex, row.name_cn, row.name_en]), armors: armors.map(row => [row.dex_id, row.name_cn, row.name_en, row.gender, row.combat, ...stats.map(field => row[field])]), skills: [...catalogSkills], identities, statuses })
  return { identities, statuses, unresolved, sourceHash, total: armors.length, mapped: statuses.filter(row => row[1] === 'confirmed').length, foreign: statuses.filter(row => row[1] === 'foreign_variant').length }
}

const storedIdentities = db => db.prepare('SELECT armor_dex_id,save_type,save_id,gender,mapping_status,source FROM catalog_armor_save_identities WHERE game_id=? ORDER BY armor_dex_id,save_type,save_id').all(gameId)
const storedStatuses = db => db.prepare('SELECT dex_id,mapping_status FROM catalog_armors WHERE game_id=? AND is_placeholder=0 ORDER BY dex_id').all(gameId).map(row => [row.dex_id, row.mapping_status])
const metadata = db => db.prepare('SELECT source_sha256,builder_sha256 FROM catalog_build_metadata WHERE game_id=? AND domain=?').get(gameId, domain)
const matches = (db, report) => JSON.stringify(storedIdentities(db)) === JSON.stringify(report.identities) && JSON.stringify(storedStatuses(db)) === JSON.stringify(report.statuses)
const summary = report => ({ total: report.total, mapped: report.mapped, identities: report.identities.length, foreign: report.foreign, unresolved: report.unresolved.length })

/** Builders / private asset preparation only; the application remains read-only. */
export function repairMh4gArmorIdentities(db) {
  return db.transaction(() => {
    const report = inspectMh4gArmorIdentities(db)
    if (report.unresolved.length) throw new Error(`MH4G unresolved armor identities: ${JSON.stringify(report.unresolved)}`)
    const columns = db.prepare('PRAGMA table_info(catalog_armor_save_identities)').all()
    if (!columns.some(column => column.name === 'gender')) db.exec("ALTER TABLE catalog_armor_save_identities ADD COLUMN gender TEXT CHECK(gender IN ('male','female','both'))")
    db.exec('CREATE TABLE IF NOT EXISTS catalog_build_metadata (domain TEXT NOT NULL,game_id TEXT NOT NULL,source_sha256 TEXT NOT NULL,builder_sha256 TEXT NOT NULL,PRIMARY KEY(domain,game_id))')
    const previous = metadata(db)
    const changed = !matches(db, report) || previous?.source_sha256 !== report.sourceHash || previous?.builder_sha256 !== digest(revision)
    if (changed) {
      db.prepare('DELETE FROM catalog_armor_save_identities WHERE game_id=?').run(gameId)
      const insert = db.prepare("INSERT INTO catalog_armor_save_identities (game_id,armor_dex_id,save_type,save_id,mapping_status,source,gender) VALUES ('mh4g',@armor_dex_id,@save_type,@save_id,@mapping_status,@source,@gender)")
      for (const row of report.identities) insert.run(row)
      const update = db.prepare('UPDATE catalog_armors SET mapping_status=? WHERE game_id=? AND dex_id=?')
      for (const [dexId, status] of report.statuses) update.run(status, gameId, dexId)
      db.prepare('INSERT OR REPLACE INTO catalog_build_metadata VALUES (?,?,?,?)').run(domain, gameId, report.sourceHash, digest(revision))
    }
    return { ...summary(report), changed }
  })()
}

export function auditMh4gArmorIdentities(db) {
  const report = inspectMh4gArmorIdentities(db)
  const columns = db.prepare('PRAGMA table_info(catalog_armor_save_identities)').all()
  if (report.unresolved.length || !columns.some(column => column.name === 'gender') || !matches(db, report)
    || metadata(db)?.source_sha256 !== report.sourceHash || metadata(db)?.builder_sha256 !== digest(revision)) {
    throw new Error('MH4G stale or inconsistent armor identities; run data:repair:runtime')
  }
  return summary(report)
}
