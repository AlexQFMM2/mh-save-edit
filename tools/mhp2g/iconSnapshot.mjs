import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { sha256 } from './sources.mjs'

/** Validate every mapping against native row hashes, not names or row order. */
export function readItemIcons(source, items, manifestFile) {
  const snapshot = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  assert.equal(snapshot.schema, 'mhp2g-item-icons-v1')
  assert.equal(snapshot.gameId, 'mhp2g')
  const native = new Map(source.prepare('SELECT item_id,icon_id,color_id,row_sha256 FROM native_item_catalog').all().map(row => [row.item_id, row]))
  const visible = new Set(items.filter(row => !row.is_placeholder).map(row => row.item_id))
  const byKey = new Map(), byItemId = new Map(), files = new Map(), used = new Set()
  for (const icon of snapshot.icons) {
    const key = `${icon.iconId}:${icon.colorId}`
    assert(Number.isInteger(icon.iconId) && Number.isInteger(icon.colorId) && !byKey.has(key), 'Duplicate or invalid icon key')
    assert.match(icon.pngSha256, /^[a-f0-9]{64}$/)
    assert.equal(icon.path, `catalog/icons/${icon.pngSha256}.png`, 'Noncanonical icon path')
    const file = path.join(path.dirname(manifestFile), 'icons', `${icon.pngSha256}.png`)
    assert.equal(sha256(file), icon.pngSha256, 'Icon PNG fingerprint mismatch')
    const png = fs.readFileSync(file)
    assert(png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Invalid PNG signature')
    assert.equal(png.readUInt32BE(16), 24, 'Invalid icon width')
    assert.equal(png.readUInt32BE(20), 24, 'Invalid icon height')
    byKey.set(key, icon)
    files.set(`${icon.pngSha256}.png`, png)
  }
  for (const mapping of snapshot.items) {
    assert(visible.has(mapping.itemId) && !byItemId.has(mapping.itemId), 'Unexpected or duplicate item mapping')
    const row = native.get(mapping.itemId)
    assert(row, 'Missing native item')
    assert.equal(mapping.rowSha256, row.row_sha256, 'Native item row fingerprint mismatch')
    assert.equal(mapping.iconKey, `${row.icon_id}:${row.color_id}`, 'Native icon/color mismatch')
    const icon = byKey.get(mapping.iconKey)
    assert(icon, 'Missing icon combination')
    used.add(mapping.iconKey)
    byItemId.set(mapping.itemId, icon.path)
  }
  assert.equal(byItemId.size, visible.size, 'Incomplete item icon coverage')
  assert.equal(used.size, byKey.size, 'Unreferenced icon combination')
  return { byItemId, files, sha256: sha256(manifestFile) }
}
