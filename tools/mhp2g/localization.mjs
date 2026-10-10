import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { sha256 } from './sources.mjs'

// Identity lookup deliberately preserves kana, punctuation and circled numbers.
export const japaneseNameKey = value => value.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
export const textKey = (table, index) => `${table}:${index}`
export const displayText = unit => unit.chinese ?? unit.japanese
export const translationSource = unit => unit.status === 'official' ? unit.nameMatch === 'decoration-without-slots' ? 'GU 官方用词（省略孔位后缀）' : 'GU 官方简中' : unit.status === 'reviewed' ? unit.kind === 'description' ? '项目译文（待验收）' : '项目译名（待验收）' : '日版原文（中文待审校）'

/** Translation choices own text only. Bindings keep each native record's identity. */
export function createLocalization({ tables, bindings, official, reviews = [] }) {
  const raw = new Map(), terms = new Map(), decorationNames = new Map(), invalidDecorationNames = new Set(), units = {}, reviewed = new Map()
  for (const table of tables) for (const row of table.rows) {
    const key = textKey(table.tableId, row.index)
    assert(!raw.has(key), `Duplicate native text ${key}`)
    raw.set(key, row.text)
  }
  for (const term of official) {
    assert.equal(term.chineseSource, 'gu_official', `Unverified official term ${term.id}`)
    if (!term.ja?.trim() || !term.zhHans?.trim()) continue
    const key = `${term.kind}:${japaneseNameKey(term.ja)}`
    terms.set(key, [...(terms.get(key) ?? []), term])
    // This is a name-only correspondence, never a cross-game item identity.
    // Both languages must explicitly agree on the same 1/2/3-slot suffix.
    const ja = japaneseNameKey(term.ja).match(/^(.*珠)【([123])】$/)
    const zh = japaneseNameKey(term.zhHans).match(/^(.*珠)【([123])】$/)
    if (term.kind === 'item' && ja && zh && ja[2] === zh[2]) {
      const candidate = { ...term, zhHans: zh[1] }
      decorationNames.set(ja[1], [...(decorationNames.get(ja[1]) ?? []), candidate])
    } else if (term.kind === 'item' && ja) {
      invalidDecorationNames.add(ja[1])
    }
  }
  for (const review of reviews) {
    assert(!reviewed.has(review.key), `Duplicate translation review ${review.key}`)
    assert(typeof review.chinese === 'string' && review.chinese.trim() && typeof review.basis === 'string' && review.basis.trim(), 'Translation requires Chinese and review basis')
    assert.equal(raw.get(review.key), review.japanese, `Stale translation review ${review.key}`)
    // Control codes and explicit in-game line breaks must survive a future patch.
    const controls = text => (text.match(/~[A-Z][0-9A-F]{2}/g) ?? []).sort()
    assert.deepEqual(controls(review.chinese), controls(review.japanese), `Changed control codes ${review.key}`)
    reviewed.set(review.key, review)
  }
  const add = (key, kind, naming) => {
    assert(raw.has(key), `Missing native text ${key}`)
    if (units[key]) { assert.equal(units[key].kind, kind, `Conflicting text usage ${key}`); return }
    const japanese = raw.get(key)
    let candidates = terms.get(`${kind}:${japaneseNameKey(japanese)}`) ?? [], nameMatch
    if (!candidates.length && kind === 'item' && naming === 'native-decoration' && !invalidDecorationNames.has(japaneseNameKey(japanese))) {
      candidates = decorationNames.get(japaneseNameKey(japanese)) ?? []
      if (candidates.length) nameMatch = 'decoration-without-slots'
    }
    const choices = new Set(candidates.map(row => row.zhHans)), review = reviewed.get(key)
    if (choices.size === 1 && review) assert.equal(review.chinese, candidates[0].zhHans, `Review contradicts official name ${key}`)
    const chinese = choices.size === 1 ? candidates[0].zhHans : review?.chinese ?? null
    units[key] = { kind, japanese, chinese, status: choices.size === 1 ? 'official' : review ? 'reviewed' : 'pending', officialTermIds: choices.size === 1 ? candidates.map(row => row.id).sort() : [], ...(choices.size === 1 && nameMatch ? { nameMatch } : {}), ...(review ? { reviewBasis: review.basis } : {}) }
  }
  for (const [key, binding] of Object.entries(bindings)) {
    assert(binding.kind && binding.name, `Invalid binding ${key}`)
    add(binding.name, binding.kind, binding.naming)
    if (binding.description) add(binding.description, 'description')
  }
  for (const key of reviewed.keys()) assert(units[key], `Unused translation review ${key}`)
  const counts = {}
  for (const binding of Object.values(bindings)) {
    const count = counts[binding.kind] ??= { total: 0, official: 0, reviewed: 0, pending: 0 }
    count.total++; count[units[binding.name].status]++
  }
  return { schema: 'mhp2g-catalog-localization-v1', units, bindings, counts }
}

export function readLocalization(file, sourceSha256) {
  const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(file), 'manifest.json'), 'utf8'))
  assert.equal(manifest.outputs[path.basename(file)], sha256(file), 'Localization fingerprint mismatch')
  assert.equal(manifest.sourceSha256, sourceSha256, 'Localization native catalog mismatch')
  const result = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(result.schema, 'mhp2g-catalog-localization-v1')
  for (const binding of Object.values(result.bindings)) {
    for (const key of [binding.name, binding.description].filter(Boolean)) {
      const unit = result.units[key]
      assert(unit && typeof unit.japanese === 'string', `Missing localization unit ${key}`)
      assert(['official', 'reviewed', 'pending'].includes(unit.status), `Invalid translation state ${key}`)
      assert(unit.status === 'pending' ? unit.chinese === null : typeof unit.chinese === 'string' && unit.chinese.trim(), `Invalid translation ${key}`)
    }
  }
  return result
}

export function localizeItems(items, localization) {
  const metadata = []
  for (const item of items) {
    const binding = localization.bindings[`item:${item.item_id}`]
    assert(binding?.kind === 'item' && binding.description, `Missing item localization ${item.item_id}`)
    const name = localization.units[binding.name], description = localization.units[binding.description]
    metadata.push({ item_id: item.item_id, original_name: item.name_cn, name_source: translationSource(name), name_status: name.status, description_jp: description.japanese, description_source: translationSource(description), description_status: description.status })
    item.name_cn = displayText(name); item.name_jp = name.japanese
    item.description = displayText(description).replaceAll('\\n', '\n')
  }
  return metadata
}
