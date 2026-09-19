// Offline preparation only. Detailed Wiki descriptions do not replace Dex fields.
export function ensureSkillWikiSchema(db) {
  // Logical identity is checked on import AND read. No cascading deletion: the
  // Dex builder recreates activations. Stale details become invisible instead.
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_skill_effect_details (
    game_id TEXT NOT NULL, activation_key TEXT NOT NULL,
    skill_id INTEGER NOT NULL, dex_activation_id INTEGER NOT NULL,
    threshold INTEGER NOT NULL, name_jp TEXT NOT NULL,
    description_cn TEXT NOT NULL, source_url TEXT NOT NULL,
    source_version TEXT NOT NULL, source_sha256 TEXT NOT NULL,
    source_text TEXT NOT NULL, review_note TEXT NOT NULL,
    PRIMARY KEY(game_id,activation_key)
  )`)
}
export function importSkillWikiDetails(db, game, document) {
  if(document.format !== 'skill-wiki-reviewed-v1' || !Array.isArray(document.entries)) throw new Error('Invalid reviewed Wiki format')
  if(!['mh3g','mh4g','mhgu'].includes(game))throw new Error('Unsupported game')
  const seen=new Set(); const selected=[]
  for(const entry of document.entries) {
    if(entry.gameId !== game) continue
    if(seen.has(entry.activationKey))throw new Error(`Duplicate Wiki identity: ${entry.activationKey}`)
    seen.add(entry.activationKey)
    if(entry.status !== 'reviewed') continue // conflicts are retained in the preparation document, never displayed as confirmed details.
    const actual=db.prepare('SELECT * FROM catalog_skill_activations WHERE game_id=? AND activation_key=?').get(game,entry.activationKey)
    if(!actual || actual.skill_id!==entry.skillId || actual.dex_activation_id!==entry.dexActivationId || actual.threshold!==entry.threshold || actual.name_jp!==entry.nameJp)throw new Error(`Wiki activation identity mismatch: ${entry.activationKey}`)
    if(!entry.descriptionCn?.trim() || !entry.sourceText?.trim() || !entry.reviewNote?.trim())throw new Error('Missing reviewed text or review note')
    if(!/^https?:\/\//.test(entry.sourceUrl) || !/^[a-f0-9]{64}$/.test(entry.sourceSha256))throw new Error('Missing Wiki provenance')
    const allowed={mh3g:['MH3G'],mh4g:['MH4G'],mhgu:['MHGU','MHXX']}
    if(!allowed[game].includes(entry.sourceVersion))throw new Error('Wiki source version mismatch')
    selected.push(entry)
  }
  db.transaction(()=>{
    ensureSkillWikiSchema(db)
    db.prepare('DELETE FROM catalog_skill_effect_details WHERE game_id=?').run(game)
    const insert=db.prepare('INSERT INTO catalog_skill_effect_details VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    for(const e of selected)insert.run(game,e.activationKey,e.skillId,e.dexActivationId,e.threshold,e.nameJp,e.descriptionCn.trim(),e.sourceUrl,e.sourceVersion,e.sourceSha256,e.sourceText,e.reviewNote)
  })()
  return {game, reviewed:selected.length, excluded:seen.size-selected.length}
}
