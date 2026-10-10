import { wikiMetadata } from './sources.mjs'
const payloads = (db, table, kind) => db.prepare(`SELECT payload_json FROM ${table} WHERE kind=? ORDER BY ${table === 'wiki_business_observations' ? 'observation_key' : 'key'}`).all(kind).map(r => JSON.parse(r.payload_json))
const join = (...values) => values.filter(v => v != null && v !== '').join(' · ')

export function extractRelations(db, { itemNames, equipmentNames = new Map() } = {}) {
  const relations = [], excluded = []
  const add = (key, itemId, kind, name, options = {}) => {
    if (itemId == null) { excluded.push({ key, reason: 'native-item-identity-unresolved' }); return }
    relations.push({ key, itemId, kind, name, quantity: null, probability: null, usage: null, relatedItemIds: [], metadata: {}, pending: null, ...options })
  }
  const items = itemNames ?? new Map(db.prepare('SELECT item_id,name FROM native_item_catalog').all().map(r => [r.item_id, r.name]))
  for (const r of payloads(db, 'wiki_business_observations', 'recipe')) {
    const key = `recipe:${r.source_page}:${r.table_index}:${r.row_index}`
    const metadata = wikiMetadata(key, { details: join(`产量 ${r.amount_raw}`, r.notes_ja), probabilitySource: 'Wiki 调合成功率', amountMin: String(r.amount_min_wiki), amountMax: String(r.amount_max_wiki) })
    add(key, r.native_result_id, 'combination', join(items.get(r.native_material_a_id), items.get(r.native_material_b_id)), { quantity: r.amount_min_wiki === r.amount_max_wiki ? r.amount_min_wiki : null, probability: r.success_pct_wiki, relatedItemIds: [r.native_material_a_id, r.native_material_b_id], metadata })
    for (const [index, id] of [r.native_material_a_id, r.native_material_b_id].entries()) add(`${key}:ingredient:${index}`, id, 'combination', `可调合：${items.get(r.native_result_id)}`, { relatedItemIds: [r.native_result_id], metadata })
  }
  const gathering = new Map(db.prepare('SELECT key,payload_json FROM wiki_r7_gathering ORDER BY key').all().map(r => [r.key, JSON.parse(r.payload_json)]))
  const gatheringLink = (key, line, id, raw, note = '') => add(key, id, 'location', line.map_name_ja, { metadata: wikiMetadata(key, { details: join(line.area_heading_ja, line.position_raw, line.gathering_type_raw, line.rank_or_mode_raw, raw, note), acquisitionStatus: 'wiki-only' }) })
  for (const [key, r] of gathering) {
    if (r.native_item_id != null) gatheringLink(`gathering:${key}`, r, r.native_item_id, r.text)
  }
  // Apply only accepted links at their exact source segment. Never spread an alias by name.
  const segments = db.prepare(`SELECT l.*,s.raw_segment FROM wiki_r8_segment_links l JOIN wiki_r8_segments s USING(line_key,segment_index) ORDER BY l.line_key,l.segment_index,l.document,l.target_kind,l.target_key`).all()
  const acceptedSegments = new Set()
  for (const r of segments) {
    const key = `gathering:${r.line_key}:segment:${r.segment_index}`, line = gathering.get(r.line_key)
    if (r.relation_status !== 'reviewed-identity' || r.native_item_id == null) { excluded.push({ key, reason: r.relation_status }); continue }
    if (line.native_item_id != null || acceptedSegments.has(key)) continue
    acceptedSegments.add(key); gatheringLink(key, line, r.native_item_id, r.raw_segment, '限定源行身份裁决；获取条件未验证')
  }
  for (const r of db.prepare(`SELECT l.*,d.native_item_id,s.raw_segment FROM wiki_r9_links l JOIN wiki_r9_decisions d USING(source_name) JOIN wiki_r8_segments s USING(line_key,segment_index) ORDER BY l.line_key,l.segment_index`).all()) {
    const key = `gathering:${r.line_key}:segment:${r.segment_index}`, line = gathering.get(r.line_key)
    if (line.native_item_id != null || acceptedSegments.has(key)) continue
    acceptedSegments.add(key); gatheringLink(key, line, r.native_item_id, r.raw_segment, '限定源行身份裁决；获取条件未验证')
  }
  for (const [key, r] of gathering) if (r.native_item_id == null && ![...acceptedSegments].some(k => k.startsWith(`gathering:${key}:segment:`))) excluded.push({ key, reason: 'unmapped-or-context-not-acquisition' })

  const globalConditions = payloads(db, 'wiki_r6_records', 'global-condition')
  for (const r of payloads(db, 'wiki_r6_records', 'shop-condition')) {
    const conditions = r.unlock_conditions.map(c => c.raw_text)
    const globals = globalConditions.filter(c => c.scope === r.shop_scope).map(c => c.quote)
    const details = join(r.price_z_as_listed == null ? '价格未知' : `${r.price_z_as_listed} z`, r.pattern_number == null ? '' : `供应模式 ${r.pattern_number}`, r.discount_label, ...conditions, ...globals, r.unmarked_status ? '未标注解锁条件，不代表初始可购买' : '', r.unmatched_colors.length ? '部分条件未知' : '')
    add(`shop:${r.key}`, r.native_item_id, 'shop', r.shop_scope, { metadata: wikiMetadata(r.key, { details }) })
  }

  const quests = new Map(payloads(db, 'wiki_business_observations', 'quest').map(r => [r.key, { name: r.fields.name.text, context: join(r.rank_heading, r.fields.map?.text) }]))
  for (const r of payloads(db, 'wiki_r6_records', 'business-row')) if (r.kind === 'quest-summary') quests.set(r.key, { name: r.name_raw, context: r.page_title })
  const rewardCorrections = new Map(db.prepare('SELECT * FROM wiki_r8_reward_links ORDER BY reward_line_key').all().map(r => [r.reward_line_key, r]))
  for (const r of payloads(db, 'wiki_r6_records', 'reward-line')) {
    const corrected = rewardCorrections.get(r.key), id = corrected?.native_item_id ?? r.native_item_id, quest = quests.get(r.quest_key)
    if (!quest) { excluded.push({ key: r.key, reason: 'quest-observation-unresolved' }); continue }
    add(`quest:${r.key}`, id, 'quest', quest.name, { quantity: r.explicit_quantity_wiki, metadata: wikiMetadata(r.key, { details: join(quest.context, r.raw_text, corrected ? '源行名称已审阅修正' : '') }), pending: { kind: 'quest', name: quest.name } })
  }

  // Native reward links have explicit monster FK endpoints. Part codes remain uninterpreted.
  for (const r of db.prepare(`SELECT m.link_id,m.monster_id,m.kind,m.part_code,m.rank_slot,m.pool_key,n.name,i.ordinal,i.item_id,i.chance,i.amount FROM monster_rewards m JOIN monster_names n ON n.native_monster_id=m.monster_id JOIN reward_items i USING(pool_key) ORDER BY m.link_id,i.ordinal`).all()) {
    const kinds = { body_carve: '剥取', tail_carve: '断尾剥取', capture: '捕获', shiny: '掉落', break: '部位破坏' }
    add(`monster:${r.link_id}:${r.ordinal}`, r.item_id, 'monster', r.name, { quantity: r.amount, probability: r.chance, metadata: { evidence: '原生奖励表', sourceKey: `monster_rewards:${r.link_id}/${r.pool_key}:${r.ordinal}`, probabilitySource: '原生奖励表概率', details: join(kinds[r.kind] ?? r.kind, `位阶记录 ${r.rank_slot}`, r.part_code == null ? '' : `部位代码 ${r.part_code}（名称未知）`) }, pending: { kind: 'monster', name: r.name } })
  }
  for (const r of db.prepare(`SELECT c.recipe_key,c.target_equipment_key,c.target_item_id,r.name,r.native_table,m.position,m.item_id,m.quantity FROM creation_recipes c JOIN creation_materials m USING(recipe_key) LEFT JOIN records r ON r.record_key=c.target_equipment_key ORDER BY c.recipe_key,m.position`).all()) {
    const kind = r.native_table?.startsWith('weapon') ? 'weapon' : r.native_table?.startsWith('armor') ? 'armor' : r.target_item_id != null ? 'decoration' : null
    const name = equipmentNames.get(r.target_equipment_key) ?? r.name ?? items.get(r.target_item_id)
    if (!kind || !name) { excluded.push({ key: r.recipe_key, reason: 'creation-target-unresolved' }); continue }
    add(`creation:${r.recipe_key}:${r.position}`, r.item_id, kind, name, { quantity: r.quantity, usage: kind, metadata: { evidence: '原生制作素材表', sourceKey: r.recipe_key, details: '制作素材；解锁条件未知' }, pending: { kind, name } })
  }
  for (const r of db.prepare(`SELECT u.upgrade_key,u.equipment_key,r.name,r.native_table,m.position,m.item_id,m.quantity FROM upgrade_records u JOIN upgrade_materials m USING(upgrade_key) JOIN records r ON r.record_key=u.equipment_key ORDER BY u.upgrade_key,m.position`).all()) {
    const kind = r.native_table.startsWith('weapon') ? 'weapon' : 'armor'
    const name = equipmentNames.get(r.equipment_key) ?? r.name
    add(`upgrade:${r.upgrade_key}:${r.position}`, r.item_id, kind, name, { quantity: r.quantity, usage: kind, metadata: { evidence: '原生装备素材记录', sourceKey: r.upgrade_key, details: '本条装备附带素材；强化方向及费用未确认' }, pending: { kind, name } })
  }
  for (const relation of relations) {
    if (!items.has(relation.itemId) || relation.relatedItemIds.some(id => !items.has(id))) throw new Error(`Dangling item endpoint: ${relation.key}`)
  }
  relations.sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  if (new Set(relations.map(r => r.key)).size !== relations.length) throw new Error('Duplicate relation key')
  return { relations, excluded }
}
