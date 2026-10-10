// Supplement canonical P2G item names from independently checked native/Wiki rows.
// This does not change numeric data or propagate source-scoped gathering aliases.
const nativeFields = ['name_cn', 'description', 'max_stack', 'buy_price', 'sell_price']

export function wikiItemFacts(row) {
  const fields = new Map(row.fields.map(field => [String(field.header).replaceAll('\n', ''), field.text]))
  const number = (value, pattern) => { const match = String(value ?? '').match(pattern); return match ? Number(match[1]) : null }
  return {
    stack: number(fields.get('最大所持数'), /^(\d+)$/),
    sell: number(fields.get('売値'), /^(\d+)z$/),
    buy: number(fields.get('買値'), /^(\d+)z$/),
  }
}
function agrees(native, wiki, hasReviewedMonster = false) {
  const facts = wikiItemFacts(wiki)
  return (facts.stack === null ? hasReviewedMonster : facts.stack === native.max_stack) && facts.sell !== null && facts.sell === native.sell_price && (facts.buy === null || facts.buy === native.buy_price)
}
function reviewedMonsterReward(native, wiki, review, rewards) {
  if (!review.monster) return null
  const fields = new Map(wiki.fields.map(field => [field.header, field.text]))
  const rank = { '下位': 'low', '上位': 'high', 'G級': 'g' }[fields.get('入手可能')]
  const match = rewards.find(reward => reward.item_id === native.item_id && reward.monster_id === review.monster.nativeId && reward.name === review.monster.nativeName && reward.rank_slot === rank && reward.chance > 0)
  if (!rank || !review.monster.wikiName || fields.get('入手元モンスター') !== review.monster.wikiName || !match) throw new Error(`Reviewed monster reward mismatch: ${native.item_id}`)
  return { wikiMonster: review.monster.wikiName, wikiRank: fields.get('入手可能'), nativeReward: match }
}
export function collectItemJapaneseEvidence(rows, wikiRows, reviewed = [], nativeRewards = []) {
  const entries = [], names = new Map(), nativeNames = new Map(), reviewById = new Map(), monsterById = new Map()
  for (const row of wikiRows) names.set(row.name_ja, [...(names.get(row.name_ja) ?? []), row])
  for (const row of rows) nativeNames.set(row.name_cn.trim(), (nativeNames.get(row.name_cn.trim()) ?? 0) + 1)
  for (const review of reviewed) {
    if (reviewById.has(review.itemId)) throw new Error('Duplicate reviewed item')
    const native = rows.find(row => row.item_id === review.itemId)
    const wiki = wikiRows.find(row => row.key === review.wikiKey)
    if (!native || !wiki || !review.reason?.trim() || native.name_cn !== review.originalName || !review.descriptionContains || !native.description.includes(review.descriptionContains) || wiki.name_ja !== review.japanese) throw new Error(`Reviewed Japanese evidence mismatch: ${review.itemId}`)
    const monster = reviewedMonsterReward(native, wiki, review, nativeRewards)
    if (!agrees(native, wiki, !!monster)) throw new Error(`Reviewed Japanese evidence mismatch: ${review.itemId}`)
    if (monster) monsterById.set(review.itemId, monster)
    reviewById.set(review.itemId, review)
  }
  for (const native of rows.filter(row => !row.is_placeholder)) {
    const review = reviewById.get(native.item_id)
    // Exact names are only candidates: require unique native/Wiki endpoints and
    // independent stack + sell-price corroboration; check buy price when listed.
    const candidates = review ? wikiRows.filter(row => row.key === review.wikiKey)
      : nativeNames.get(native.name_cn.trim()) === 1 ? (names.get(native.name_cn.trim()) ?? []).filter(wiki => agrees(native, wiki)) : []
    if (candidates.length !== 1) continue
    const wiki = candidates[0]
    if (native.name_jp === wiki.name_ja) continue
    entries.push({ itemId: native.item_id, previousJapanese: native.name_jp, japanese: wiki.name_ja,
      expected: Object.fromEntries(nativeFields.map(field => [field, native[field]])),
      wikiKey: wiki.key, wikiFacts: wikiItemFacts(wiki),
      basis: review ? review.reason : 'Unique exact native/Wiki name with matching stack and prices',
      ...(monsterById.has(native.item_id) ? { monsterEvidence: monsterById.get(native.item_id) } : {}),
    })
  }
  return { schema: 'mhp2g-item-japanese-v1', entries }
}

export function applyItemJapaneseEvidence(db, evidence) {
  if (evidence.schema !== 'mhp2g-item-japanese-v1' || !Array.isArray(evidence.entries)) throw new Error('Unsupported P2G Japanese evidence')
  const seen = new Set(), update = db.prepare('UPDATE catalog_items SET name_jp=? WHERE item_id=?')
  let changed = 0
  db.transaction(() => {
    for (const entry of evidence.entries) {
      const row = db.prepare('SELECT * FROM catalog_items WHERE item_id=?').get(entry.itemId)
      if (seen.has(entry.itemId) || !row || !entry.japanese?.trim() || !entry.wikiKey || !entry.basis || nativeFields.some(field => row[field] !== entry.expected?.[field])) throw new Error(`P2G Japanese evidence does not match native item: ${entry.itemId}`)
      seen.add(entry.itemId)
      if (row.name_jp === entry.japanese) continue
      if (row.name_jp !== entry.previousJapanese) throw new Error(`Unexpected P2G Japanese name: ${entry.itemId}`)
      update.run(entry.japanese, entry.itemId); changed++
    }
  })()
  return changed
}
