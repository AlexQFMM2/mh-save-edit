import { readFileSync } from 'node:fs'
import type { MonsterDetail } from '../../api/catalog/types'
import type { P3MonsterSource } from '../../api/catalog/p3MonsterTypes'
import { p3ItemFixture } from './p3ItemCatalog'

// Synthetic values only; these fixtures are not extracted game data.
export const monsterSource: P3MonsterSource = { kind: 'reference', label: '合成资料', key: 'synthetic:monster', sha256: 'a'.repeat(64) }
export function syntheticMonster(id = 40): MonsterDetail {
  const part = (n: number, condition: string, shot: number | null) => ({ id: n, partId: n, partOrder: n, partNameCn: '测试部位', partNameEn: '', conditionCn: condition, conditionEn: '', cut: 27, impact: 31, shot, fire: 0, water: 4, thunder: 9, ice: 2, dragon: 8, stun: 0,
    p3: { source: monsterSource, partJp: 'テスト', conditionJp: condition, conditionScope: 'part' as const, note: shot == null ? '合成冲突：保留未知' : null } })
  const coverage = { status: 'partial' as const, note: '合成覆盖；未知值保留。' }
  return { gameId: 'mhp3', monsterId: id, nameCn: id === 8 ? '泥层测试' : id === 40 ? '状态测试' : '同名测试', nameJp: `テスト${id}`, nameEn: '', iconSmallPath: null, iconLargePath: null, isPlaceholder: false, recordScope: id === 37 ? 'extended' : 'normal', sizeClass: 'large',
    weakness: id === 8 ? [part(1, '该部位覆泥', 4), part(2, '该部位无泥', 9)] : [part(1, '通常时', 7), part(2, '超带电状态', null)],
    ailments: [{ id: 1, statusId: 1, nameCn: '毒', nameEn: '', toleranceInitial: null, toleranceIncrease: null, toleranceMax: null, duration: 12, damage: 3, applicable: null, p3: { source: monsterSource, rawJp: 'synthetic', damageUnit: 'per-interval', damageIntervalSeconds: 2, note: '合成单位' } }],
    traps: [{ id: 1, trapId: 1, nameCn: '麻痹陷阱', nameEn: '', isEffective: null, duration: null, durationEnraged: null, durationFatigued: null, p3: { source: monsterSource, effect: 'conditional', conditionJp: 'テスト', conditionCn: '超带电状态无效', repetitions: [{ fromUse: 1, onward: false, seconds: 7, fatiguedSeconds: 9, enragedSeconds: null }, { fromUse: 2, onward: true, seconds: 3, fatiguedSeconds: 5, enragedSeconds: null }] } }],
    drops: [], quests: [], p3: { nameSource: '项目合成测试', descriptionCn: '合成说明', descriptionJp: 'テスト説明', descriptionSource: '合成原文', descriptionTextIndex: null,
      coverage: { weakness: coverage, ailments: coverage, traps: coverage, drops: coverage, appearances: coverage }, notes: ['合成未知项'], appearances: [{ sourceKey: `mhp3:appearance:${id}:test:1`, nameJp: 'テスト出現', nameCn: '测试出没', fields: [{ label: '难度', value: '村★2' }], source: monsterSource }], sourceVersions: [], referenceNotes: [], noRewardRoutes: [] } }
}
export function p3MonsterFixture(file = ':memory:') {
  const db = p3ItemFixture(file)
  db.exec(readFileSync('tools/mhp3/monster_schema.sql', 'utf8'))
  db.prepare('INSERT INTO meta VALUES(?,?)').run('monster_schema', 'mhp3-monsters-v1')
  for (const [index, id] of [8, 36, 37, 40].entries()) {
    const m = syntheticMonster(id)
    const { drops: _drops, quests: _quests, ...stored } = m
    db.prepare('INSERT INTO p3_monsters VALUES(?,?,?,?)').run(id, m.recordScope, id === 37 ? null : index, JSON.stringify({ ...stored, aliases: ['合成怪物别名'], bookIndex: id === 37 ? null : index }))
    for (const rank of [1, 3]) {
      const detail = { rankNameCn: rank === 3 ? '村★2特例' : '普通下位', rankNameEn: '', methodNameCn: '背部采集', methodNameEn: '', p3: { source: monsterSource, kind: 'gather', methodJp: 'テスト採集', rankJp: 'テスト', conditionJp: '测试条件', attemptCount: 2, attemptCountJp: '2', rawWeight: 17, rawWeightSource: '合成原始权重', quantityNote: '未知' } }
      db.prepare('INSERT INTO p3_monster_drops VALUES(?,?,?,?,?,?,?,?,?)').run(id*10+rank, id, 10, `test:${id}:${rank}`, rank, 5, rank === 3 ? null : 2, rank === 3 ? null : 25, JSON.stringify(detail))
    }
  }
  return db
}
