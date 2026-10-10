import { createHash } from 'node:crypto'

// Names are normalized only for lookup: no translation or script conversion.
export const normalizeTerm = value => String(value ?? '').normalize('NFKC').trim().toLowerCase()
export function catalogIdentityRows(db, gameId) {
  const id = gameId === 'mhp2g' ? 'item_id' : 'save_id'
  if (gameId === 'mhp2g' && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='catalog_item_localization'").get()) {
    return db.prepare('SELECT item_id AS id,dex_id,name_cn,name_en,name_jp,is_placeholder,original_name,name_source,name_status FROM catalog_items JOIN catalog_item_localization USING(item_id) ORDER BY item_id').all()
  }
  return db.prepare(`SELECT ${id} AS id,dex_id,name_cn,name_en,name_jp,is_placeholder FROM catalog_items ORDER BY ${id}`).all()
}
export const identityFingerprint = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')
