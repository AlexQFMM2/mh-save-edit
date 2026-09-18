import { createHash } from 'node:crypto'

const revision = 'armor-skill-native-crosswalk-v1'
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const normalize = value => String(value ?? '').trim().normalize('NFKC')
const nameMatches = (row, skill) => Boolean(skill) && normalize(row.name_cn) === normalize(skill.name_cn) && (!normalize(row.name_en) || normalize(row.name_en) === normalize(skill.name_en))

/** Inspect first: a mixed or ambiguous catalog must never be partially translated. */
export function inspectArmorSkillIds(db, gameId) {
  const skills = db.prepare('SELECT skill_id,dex_id,name_cn,name_en FROM catalog_skills WHERE game_id=? ORDER BY skill_id').all(gameId)
  const native = new Map(skills.map(skill => [skill.skill_id, skill]))
  const dex = new Map()
  for (const skill of skills) {
    if (skill.dex_id == null) continue
    if (dex.has(skill.dex_id)) throw new Error(`${gameId}: duplicate Dex skill crosswalk ${skill.dex_id}`)
    dex.set(skill.dex_id, skill)
  }
  const rows = db.prepare('SELECT * FROM catalog_armor_skills WHERE game_id=? ORDER BY armor_dex_id,skill_id').all(gameId)
  if (!skills.length || !rows.length) throw new Error(`${gameId}: missing armor skill catalog`)
  let oldCount = 0; let currentCount = 0
  for (const row of rows) {
    const isCurrent = nameMatches(row, native.get(row.skill_id))
    const isOld = nameMatches(row, dex.get(row.skill_id))
    if (!isCurrent && !isOld) throw new Error(`${gameId}: unrecognized armor skill ${row.armor_dex_id}/${row.skill_id}`)
    if (isCurrent && isOld && native.get(row.skill_id).skill_id !== dex.get(row.skill_id).skill_id) throw new Error(`${gameId}: ambiguous armor skill ${row.armor_dex_id}/${row.skill_id}`)
    if (!isCurrent) oldCount++
    if (!isOld) currentCount++
  }
  if (oldCount && currentCount) throw new Error(`${gameId}: mixed Dex/native armor skill IDs; refusing partial migration`)
  return { rows, native, dex, legacy: oldCount > 0, mismatches: oldCount }
}

/** Used by builders and CI after injection, never by the read-only application. */
export function migrateArmorSkillIds(db, gameId = 'mhgu') {
  return db.transaction(() => {
    const state = inspectArmorSkillIds(db, gameId)
    if (state.legacy && gameId !== 'mhgu') throw new Error(`${gameId}: no approved legacy migration`)
    const resolved = state.rows.map(row => {
      const skill = (state.legacy ? state.dex : state.native).get(row.skill_id)
      return { ...row, skill_id: skill.skill_id, name_cn: skill.name_cn, name_en: skill.name_en }
    }).sort((a, b) => a.armor_dex_id - b.armor_dex_id || a.skill_id - b.skill_id)
    const keys = new Set()
    for (const row of resolved) {
      const key = `${row.armor_dex_id}:${row.skill_id}`
      if (keys.has(key)) throw new Error(`${gameId}: duplicate translated armor skill ${key}`)
      keys.add(key)
    }
    if (state.legacy) {
      // Reinsert atomically rather than UPDATE: adjacent IDs can share a primary key mid-update.
      db.prepare('DELETE FROM catalog_armor_skills WHERE game_id=?').run(gameId)
      const insert = db.prepare('INSERT INTO catalog_armor_skills (game_id,armor_dex_id,skill_id,name_cn,name_en,points,active_skill_name_cn,active_skill_name_en,source) VALUES (@game_id,@armor_dex_id,@skill_id,@name_cn,@name_en,@points,@active_skill_name_cn,@active_skill_name_en,@source)')
      for (const row of resolved) insert.run(row)
    }
    const checked = inspectArmorSkillIds(db, gameId)
    if (checked.legacy) throw new Error(`${gameId}: armor skill migration did not converge`)
    db.exec('CREATE TABLE IF NOT EXISTS catalog_build_metadata (domain TEXT NOT NULL,game_id TEXT NOT NULL,source_sha256 TEXT NOT NULL,builder_sha256 TEXT NOT NULL,PRIMARY KEY(domain,game_id))')
    db.prepare('INSERT OR REPLACE INTO catalog_build_metadata VALUES (?,?,?,?)').run('armor-skill-crosswalk', gameId, digest(resolved.map(row => [row.armor_dex_id,row.skill_id,row.points,row.name_cn,row.name_en])), digest(revision))
    return { gameId, migrated: state.legacy, corrected: state.mismatches, rows: resolved.length }
  })()
}

export function auditCatalogSkillReferences(db, gameId) {
  if (inspectArmorSkillIds(db, gameId).legacy) throw new Error(`${gameId}: stale Dex armor skill IDs; run data:repair:runtime`)
  for (const table of ['catalog_decoration_skills', 'catalog_skill_talisman_ranges']) {
    const missing = db.prepare(`SELECT count(*) count FROM ${table} r LEFT JOIN catalog_skills s ON s.game_id=r.game_id AND s.skill_id=r.skill_id WHERE r.game_id=? AND s.skill_id IS NULL`).get(gameId).count
    if (missing) throw new Error(`${gameId}: ${table} has ${missing} missing skill identities`)
  }
  const mismatch = db.prepare('SELECT count(*) count FROM catalog_decoration_skills r JOIN catalog_skills s ON s.game_id=r.game_id AND s.skill_id=r.skill_id WHERE r.game_id=? AND r.name_cn<>s.name_cn').get(gameId).count
  if (mismatch) throw new Error(`${gameId}: ${mismatch} decoration skill names disagree with canonical identities`)
}
