// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WeaponDetail } from '../api/catalog/types'
import { ItemRelationSection } from '../ui/components/ItemRelationSection/ItemRelationSection'
import { WeaponDetailPanel } from '../ui/components/WeaponDetailPanel/WeaponDetailPanel'
import { WeaponSharpnessComparison } from '../ui/components/WeaponSharpnessComparison/WeaponSharpnessComparison'
import { WeaponViewToggle } from '../ui/components/WeaponViewToggle/WeaponViewToggle'

afterEach(cleanup)

const sharpness = { red: 10, orange: 10, yellow: 10, green: 10, blue: 10, white: 10, purple: 10, baseCutoff: 50, handicraft1Cutoff: 60, handicraft2Cutoff: 70, rawValue: '10101010101010' }
const weapon: WeaponDetail = { gameId: 'mhgu', weaponKey: '7:1:0', typeId: 1, typeNameCn: '大剑', typeNameEn: 'Great Sword', kind: 'standardMelee', saveType: 7, saveId: 1, saveLevel: 0, displayLevel: 1, dexId: 1, nameCn: '测试大剑', nameEn: 'Test Blade', nameJp: 'テスト', rarity: 1, displayAttack: 100, trueRawAttack: 100, affinity: 0, defense: 0, slots: 1, productionPrice: 100, upgradePrice: null, isDirectlyProducible: true, isFinalForm: false, iconPath: null, isPlaceholder: false, mappingStatus: 'mapped', attributes: [], sharpness, specialSummary: [], materials: [], parents: [], children: [] }

describe('weapon catalog UI primitives', () => {
  it('renders all three MHGU sharpness stages at once', () => {
    render(<WeaponSharpnessComparison gameId="mhgu" profile={sharpness} selectedStage="handicraft1" />)
    expect(screen.getByText('基础')).toBeTruthy()
    expect(screen.getByText('匠+1')).toBeTruthy()
    expect(screen.getByText('匠+2')).toBeTruthy()
  })

  it('uses native pressed buttons for the view switch', () => {
    const onChange = vi.fn()
    render(<WeaponViewToggle value="list" onChange={onChange} />)
    expect(screen.getByRole('button', { name: '列表' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '派生' }))
    expect(onChange).toHaveBeenCalledWith('tree')
  })

  it('keeps the current detail visible while a replacement is loading', () => {
    render(<WeaponDetailPanel gameId="mhgu" weapon={weapon} loading error={undefined} sharpnessStage="base" />)
    expect(screen.getByRole('heading', { name: '测试大剑 Lv.1' })).toBeTruthy()
    expect(screen.getByText('正在更新…')).toBeTruthy()
  })

  it('turns a named weapon usage into a selectable relation', () => {
    const onSelectWeapon = vi.fn()
    render(<ItemRelationSection title="武器用途" onSelectItem={() => undefined} onSelectWeapon={onSelectWeapon} relations={[{ id: 1, sourceKind: 'weapon', usageKind: 'weapon', targetId: 1, targetName: '测试大剑', quantity: 2, probability: null, rank: null, metadata: { Type: 'P' }, relatedItems: [], relatedWeapon: { gameId: 'mhgu', weaponKey: '7:1:0', typeId: 1, nameCn: '测试大剑', nameEn: 'Test Blade' } }]} />)
    fireEvent.click(screen.getByRole('button', { name: /武器用途/ }))
    fireEvent.click(screen.getByRole('button', { name: /测试大剑/ }))
    expect(onSelectWeapon).toHaveBeenCalledWith(expect.objectContaining({ weaponKey: '7:1:0' }))
  })
})
