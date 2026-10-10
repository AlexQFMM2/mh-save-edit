export function extractItems(source) {
  const identities = source.prepare("SELECT payload_json FROM wiki_business_observations WHERE kind='item-identity' ORDER BY observation_key").all().map(row => JSON.parse(row.payload_json))
  const japanese = new Map(identities.map(row => [row.native_item_id, row.wiki_name_ja]))
  return source.prepare('SELECT * FROM native_item_catalog ORDER BY item_id').all().map(row => ({
    item_id: row.item_id, save_id: null, dex_id: null, name_cn: row.name, name_en: '', name_jp: japanese.get(row.item_id) ?? '',
    description: row.description.replaceAll('\\n', '\n'), rarity: null, max_stack: row.stack_limit,
    buy_price: row.buy_price, sell_price: row.sell_price, icon_path: null,
    is_placeholder: /^(?:[－ー—\-\s]+|dummy|unused|no\s*data)$/i.test(row.name) ? 1 : 0,
    mapping_status: 'native-item-definition;save-id-unverified', source: row.source_id,
  }))
}
