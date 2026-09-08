// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HunterArtDetail, QuestDetail } from '../api/catalog/types'
import { HunterArtDetailPanel } from '../ui/components/HunterArtDetailPanel/HunterArtDetailPanel'
import { HunterArtList } from '../ui/components/HunterArtList/HunterArtList'
import { QuestDetailPanel } from '../ui/components/QuestDetailPanel/QuestDetailPanel'

afterEach(cleanup)

const quest: QuestDetail = {
  gameId: 'mhgu', questKey: 'dex:783', dexId: 783, nativeId: null, availability: 'common',
  nameCn: '地狱兄弟·红鬼的委托3', nameEn: 'A Fiery Temper', nameJp: '', goalCn: '狩猎目标怪物', goalEn: '', subGoalCn: '破坏部位', subGoalEn: '',
  levelId: 1, levelNameCn: '集会所 G2★', levelNameEn: 'Hub G2', systemKey: 'hub', systemNameCn: '集会所', rank: 'g', star: 2,
  questTypeId: 1, questTypeNameCn: '狩猎', questTypeNameEn: 'Hunt', locationId: 1, locationNameCn: '火山', locationNameEn: 'Volcano',
  timeMinutes: 50, fee: 1000, reward: 12000, reward2: 1500, hrp: 500, hrp2: 50, keyStatus: 'normal',
  monsters: [{ gameId: 'mhgu', monsterId: 83, nameCn: '恐暴龙', nameEn: 'Deviljho', iconPath: null, slot: 0, sourceKind: 'native' }], modifiers: [],
  rewards: [{ id: 1, groupKey: 'A', region: '—', item: { gameId: 'mhgu', saveId: 10, nameCn: '测试素材', nameEn: 'Test Material' }, quantity: 1, probability: 25 }],
  specialRewards: [{ id: 2, kind: 'hunter-art', nameCn: '碎月斩Ⅱ', nameEn: 'Moonbreaker II', nameJp: 'ムーンブレイクⅡ', hunterArt: { hunterArtId: 21, nameCn: '碎月斩Ⅱ', nameEn: 'Moonbreaker II' }, evidenceStatus: 'verified' }],
  relations: [],
}

const art: HunterArtDetail = {
  gameId: 'mhgu', hunterArtId: 150, nameCn: '测试狩技', nameEn: 'Test Art', nameJp: 'テスト', weaponTypeId: 4, weaponTypeNameCn: '双剑', weaponTypeNameEn: 'Dual Blades', level: 2, contentVariant: 'common',
  isPlaceholder: false, unlockKind: 'monster', match: null, shortDescriptionCn: '', longDescriptionCn: '测试说明', shortDescriptionEn: '', longDescriptionEn: '', shortDescriptionJp: '', longDescriptionJp: '',
  unlocks: [{ id: 1, kind: 'monster', condition: { kind: 'huntMonster', monsterId: 83, nameCn: '恐暴龙', nameEn: 'Deviljho', quantity: 1 }, sourceText: 'Hunt a Deviljho.', evidenceStatus: 'wiki_only', sourceTitle: 'MHGU: Hunter Arts', sourceRevision: 917516 }],
  quests: [],
}

describe('quest and Hunter Art catalog UI', () => {
  it('keeps task details visible while updating and supports arrow-key tab navigation', () => {
    const onTabChange = vi.fn()
    render(<QuestDetailPanel quest={quest} loading tab="info" onTabChange={onTabChange} onSelectMonster={() => undefined} />)
    expect(screen.getByRole('heading', { name: quest.nameCn })).toBeTruthy()
    expect(screen.getByText('正在更新…')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('tab', { name: '任务信息' }), { key: 'ArrowRight' })
    expect(onTabChange).toHaveBeenCalledWith('rewards')
  })

  it('exposes reward items and Hunter Arts as relation drawer triggers', () => {
    const onItem = vi.fn()
    const onArt = vi.fn()
    const { rerender } = render(<QuestDetailPanel quest={quest} loading={false} tab="rewards" onSelectMonster={() => undefined} onSelectItem={onItem} onSelectHunterArt={onArt} />)
    fireEvent.click(screen.getByRole('button', { name: '测试素材' }))
    expect(onItem).toHaveBeenCalledWith(10)
    fireEvent.click(screen.getByRole('button', { name: /碎月斩Ⅱ/ }))
    expect(onArt).toHaveBeenCalledWith(21)
    rerender(<QuestDetailPanel quest={quest} loading={false} tab="unlocks" onSelectMonster={() => undefined} onSelectHunterArt={onArt} />)
    expect(screen.getByText('解锁狩技')).toBeTruthy()
  })

  it('supports roving arrow-key selection in the Hunter Art list', () => {
    const onSelect = vi.fn()
    const rows = [art, { ...art, hunterArtId: 151, nameCn: '另一个狩技' }]
    render(<HunterArtList items={rows} selectedId={150} loading={false} onSelect={onSelect} />)
    fireEvent.keyDown(screen.getByRole('option', { name: /测试狩技/ }), { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith(151)
  })

  it('renders structured unlock conditions and exposes monster relations', () => {
    const onMonster = vi.fn()
    render(<HunterArtDetailPanel art={art} loading={false} onSelectQuest={() => undefined} onSelectMonster={onMonster} />)
    expect(screen.getByText('Wiki 资料')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /狩猎恐暴龙/ }))
    expect(onMonster).toHaveBeenCalledWith(83)
  })
})
