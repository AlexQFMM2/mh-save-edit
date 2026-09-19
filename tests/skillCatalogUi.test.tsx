// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SkillDetail, SkillSummary } from '../api/catalog/types'
import { SkillDetailPanel } from '../ui/components/SkillDetailPanel/SkillDetailPanel'
import { SkillSearchList } from '../ui/components/SkillSearchList/SkillSearchList'
afterEach(cleanup)
const summary: SkillSummary = { gameId: 'mhgu', skillId: 71, nameCn: '痛击', nameEn: 'Tenderizer', nameJp: '痛撃', activationCount: 1, positiveActivationCount: 1, negativeActivationCount: 0, specialActivationCount: 0, armorCount: 1, decorationCount: 1, talismanCount: 2, isPlaceholder: false }
const detail: SkillDetail = { ...summary, descriptionCn: null, descriptionEn: null, descriptionJp: null, activations: [{ activationKey: 'dex:115', dexActivationId: 115, threshold: 10, direction: 'positive', nameCn: '弱点特效', nameEn: 'Weakness Exploit', nameJp: '弱点特効', descriptionCn: '攻击弱点时会提升会心率。', descriptionEn: '', descriptionJp: '', components: [] }], components: [], armors: [], decorations: [{ gameId: 'mhgu', saveId: 42, nameCn: '痛击珠', nameEn: 'Tenderizer Jewel', iconPath: null, slots: 2, points: 1 }], talismans: [{ rangeKey: '10:A:71:2:6', skillId: 71, skillNameCn: '痛击', talismanId: 10, talismanNameCn: '天之护石', talismanNameEn: 'Creator Talisman', position: 'A', slotCount: null, minPoints: 2, maxPoints: 6, maxSlots: 3, rangeStatus: 'rule', source: 'test' }] }
describe('skill catalog UI', () => {
  it('shows Wiki details and source version without replacing original text', () => {
    const withWiki: SkillDetail = { ...detail, activations: detail.activations.map(a => ({ ...a, wikiDetail: { descriptionCn: '合成数值说明 +7', sourceUrl: 'https://example.com/wiki', sourceVersion: 'MHXX', reviewNote: 'synthetic fixture' } })) }
    render(<SkillDetailPanel skill={withWiki} loading={false} tab="armor" onSelectArmor={() => undefined} onSelectDecoration={() => undefined} />)
    expect(screen.getByText('合成数值说明 +7')).toBeTruthy()
    expect(screen.getByText('攻击弱点时会提升会心率。')).toBeTruthy()
    expect(screen.getByText('https://example.com/wiki')).toBeTruthy()
    expect(screen.getByText('引用 MHXX Wiki，非 GU 程序独立验证。')).toBeTruthy()
  })
  it('keeps activations visible while switching source tabs with the keyboard', () => { const onTabChange = vi.fn(); render(<SkillDetailPanel skill={detail} loading={false} tab="armor" onTabChange={onTabChange} onSelectArmor={() => undefined} onSelectDecoration={() => undefined} />); expect(screen.getByText('弱点特效')).toBeTruthy(); fireEvent.keyDown(screen.getByRole('tab', { name: /相关防具/ }), { key: 'ArrowRight' }); expect(onTabChange).toHaveBeenCalledWith('decoration') })
  it('renders separate talisman position and legal range', () => { render(<SkillDetailPanel skill={detail} loading={false} tab="talisman" onSelectArmor={() => undefined} onSelectDecoration={() => undefined} />); expect(screen.getByText('天之护石')).toBeTruthy(); expect(screen.getByText('+2～+6')).toBeTruthy(); expect(screen.getByText('A')).toBeTruthy() })
  it('switches source content when a tab is clicked', () => { const onTabChange = vi.fn(); render(<SkillDetailPanel skill={detail} loading={false} tab="armor" onTabChange={onTabChange} onSelectArmor={() => undefined} onSelectDecoration={() => undefined} />); fireEvent.click(screen.getByRole('tab', { name: /相关装饰品/ })); expect(onTabChange).toHaveBeenCalledWith('decoration') })
  it('supports roving keyboard selection', () => { const onSelect = vi.fn(); render(<SkillSearchList items={[summary, { ...summary, skillId: 72, nameCn: '连击' }]} selectedId={71} loading={false} page={1} pageSize={100} total={2} hasNext={false} onSelect={onSelect} onPageChange={() => undefined} />); fireEvent.keyDown(screen.getByRole('option', { name: /痛击/ }), { key: 'ArrowDown' }); expect(onSelect).toHaveBeenCalledWith(72) })
})
