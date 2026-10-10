import { afterEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
// @ts-expect-error Shared ESM evidence collector.
import { collectItemJapaneseEvidence, applyItemJapaneseEvidence } from '../tools/mhp2g/itemJapaneseEvidence.mjs'

const native = { item_id: 1, name_cn: 'テスト甲', name_jp: '', description: '合成资料甲', max_stack: 5, buy_price: 80, sell_price: 8, is_placeholder: 0 }
const wiki = { key: 'synthetic:1', name_ja: 'テスト甲', fields: [
  { header: '最大所持数', text: '5' }, { header: '売値', text: '8z' }, { header: '買値', text: '80z' },
] }
const opened: Database.Database[] = []
afterEach(() => opened.splice(0).forEach(db => db.close()))
function database() {
  const db = new Database(':memory:'); opened.push(db)
  db.exec('CREATE TABLE catalog_items(item_id INTEGER PRIMARY KEY,name_cn TEXT,name_jp TEXT,description TEXT,max_stack INTEGER,buy_price INTEGER,sell_price INTEGER,is_placeholder INTEGER,icon_path TEXT)')
  db.prepare('INSERT INTO catalog_items VALUES(@item_id,@name_cn,@name_jp,@description,@max_stack,@buy_price,@sell_price,@is_placeholder,?)').run({ ...native }, 'keep.png')
  return db
}

describe('P2G Japanese evidence', () => {
  it('corroborates exact names with native stack and listed prices, excluding ambiguous endpoints', () => {
    expect(collectItemJapaneseEvidence([native], [wiki]).entries).toHaveLength(1)
    for (const change of [{ max_stack: 9 }, { buy_price: 90 }, { sell_price: 9 }, { name_cn: 'テスト乙' }, { is_placeholder: 1 }]) {
      expect(collectItemJapaneseEvidence([{ ...native, ...change }], [wiki]).entries).toEqual([])
    }
    expect(collectItemJapaneseEvidence([native], [wiki, { ...wiki, key: 'synthetic:2' }]).entries).toEqual([])
    expect(collectItemJapaneseEvidence([native, { ...native, item_id: 2 }], [wiki]).entries).toEqual([])
    expect(collectItemJapaneseEvidence([native], [{ ...wiki, fields: wiki.fields.map(f => f.header === '売値' ? { ...f, text: '8pt' } : f) }]).entries).toEqual([])
    expect(collectItemJapaneseEvidence([native], [{ ...wiki, fields: wiki.fields.filter(f => f.header !== '買値') }]).entries).toHaveLength(1)
  })
  it('requires explicit review and corroboration for different source spellings', () => {
    const row = { ...native, name_cn: '示例異体甲' }
    const review = { itemId: 1, wikiKey: wiki.key, originalName: row.name_cn, japanese: wiki.name_ja, descriptionContains: '合成资料', reason: 'Synthetic reviewed glyph difference' }
    expect(collectItemJapaneseEvidence([row], [wiki]).entries).toEqual([])
    expect(collectItemJapaneseEvidence([row], [wiki], [review]).entries[0]).toMatchObject({ japanese: wiki.name_ja, basis: review.reason })
    for (const change of [{ descriptionContains: '不存在' }, { japanese: 'テスト乙' }, { originalName: 'wrong' }, { reason: '' }]) {
      expect(() => collectItemJapaneseEvidence([row], [wiki], [{ ...review, ...change }])).toThrow(/mismatch/)
    }
    expect(() => collectItemJapaneseEvidence([{ ...row, sell_price: 9 }], [wiki], [review])).toThrow(/mismatch/)
    expect(() => collectItemJapaneseEvidence([row], [wiki], [review, review])).toThrow(/Duplicate/)
  })
  it('repairs only Japanese, preserves other fields and is idempotent', () => {
    const db = database(), before = db.prepare('SELECT * FROM catalog_items').get() as Record<string, unknown>
    const evidence = collectItemJapaneseEvidence([native], [wiki])
    expect(applyItemJapaneseEvidence(db, evidence)).toBe(1)
    expect(db.prepare('SELECT * FROM catalog_items').get()).toEqual({ ...before, name_jp: wiki.name_ja })
    expect(applyItemJapaneseEvidence(db, evidence)).toBe(0)
    db.prepare('UPDATE catalog_items SET name_jp=?').run('誤記甲')
    expect(applyItemJapaneseEvidence(db, collectItemJapaneseEvidence([{ ...native, name_jp: '誤記甲' }], [wiki]))).toBe(1)
  })
  it('uses a reviewed monster and native reward rank when Wiki stack is blank, without filling the blank', () => {
    const row = { ...native, name_cn: '测试怪的旧译素材' }
    const source = { ...wiki, fields: [
      ...wiki.fields.filter(f => f.header !== '最大所持数'),
      { header: '最大所持数', text: '' }, { header: '入手元モンスター', text: 'テスト怪亜種' }, { header: '入手可能', text: '上位' },
    ] }
    const monster = { nativeId: 80, nativeName: '测试怪', wikiName: 'テスト怪亜種' }
    const review = { itemId: 1, wikiKey: wiki.key, originalName: row.name_cn, japanese: wiki.name_ja, descriptionContains: '合成资料', reason: 'Reviewed synthetic monster material', monster }
    const reward = { link_id: 500, monster_id: 80, name: '测试怪', rank_slot: 'high', item_id: 1, chance: 12 }
    expect(collectItemJapaneseEvidence([row], [source]).entries).toEqual([])
    const result = collectItemJapaneseEvidence([row], [source], [review], [reward])
    expect(result.entries[0]).toMatchObject({ wikiFacts: { stack: null }, monsterEvidence: { wikiRank: '上位', nativeReward: reward } })
    for (const change of [{ monster_id: 81 }, { rank_slot: 'g' }, { item_id: 2 }, { chance: 0 }]) {
      expect(() => collectItemJapaneseEvidence([row], [source], [review], [{ ...reward, ...change }])).toThrow(/monster reward mismatch/)
    }
    expect(() => collectItemJapaneseEvidence([row], [source], [{ ...review, monster: { ...monster, wikiName: 'テスト怪' } }], [reward])).toThrow(/monster reward mismatch/)
    expect(() => collectItemJapaneseEvidence([{ ...row, sell_price: 9 }], [source], [review], [reward])).toThrow(/Japanese evidence mismatch/)
    const conflict = { ...source, fields: source.fields.map(f => f.header === '最大所持数' ? { ...f, text: '9' } : f) }
    expect(() => collectItemJapaneseEvidence([row], [conflict], [review], [reward])).toThrow(/Japanese evidence mismatch/)
  })
  it('rolls back the entire supplement on duplicate or stale evidence', () => {
    const db = database(), evidence = collectItemJapaneseEvidence([native], [wiki]), entry = evidence.entries[0]
    expect(() => applyItemJapaneseEvidence(db, { ...evidence, entries: [entry, entry] })).toThrow(/does not match/)
    expect(db.prepare('SELECT name_jp FROM catalog_items').get()).toEqual({ name_jp: '' })
    db.prepare('UPDATE catalog_items SET name_jp=?').run('unexpected')
    expect(() => applyItemJapaneseEvidence(db, evidence)).toThrow(/Unexpected/)
    db.prepare('UPDATE catalog_items SET name_jp=?,sell_price=?').run('', 9)
    expect(() => applyItemJapaneseEvidence(db, evidence)).toThrow(/does not match/)
    expect(db.prepare('SELECT name_jp FROM catalog_items').get()).toEqual({ name_jp: '' })
  })
})
