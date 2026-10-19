// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LoadoutInstanceState, LoadoutRelicLookup } from '../api/loadout/types'
import { RelicWeaponAdvancedFields } from '../ui/components/RelicWeaponAdvancedFields/RelicWeaponAdvancedFields'
import { relicLookupOptions } from '../ui/components/RelicLookupSelect/relicLookupOptions'

afterEach(cleanup)

// Synthetic equipment records and lookup rows; no game/save binaries are used.
function instance(saveType: number, code = 14): LoadoutInstanceState {
  const record = new Uint8Array(28).fill(0xa5)
  record[0] = saveType; record[4] = code; record[5] = 7
  return { source: 'catalogTemplate', recordHex: [...record].map(byte => byte.toString(16).padStart(2, '0')).join(''), legality: 'unknown', encoding: 'encodable', issues: [] }
}

function lookup(saveType: number, variant: string, code: number, name: string): LoadoutRelicLookup {
  return { kind: 'equipment_lookup', key: `synthetic:${saveType}:${variant}:${code}`, payload: { domain: 'status_value', save_type: saveType, variant, code, name_cn: name, name_en: name }, source: 'synthetic' }
}

const weapons = [
  { name: '大剑', saveType: 7, typeId: 1, variant: 'high', maximum: 970, code: 0x32 },
  { name: '片手剑', saveType: 8, typeId: 3, variant: 'low', maximum: 1000, code: 0x60 },
  { name: '大锤', saveType: 9, typeId: 5, variant: 'medium', maximum: 800, code: 0x43 },
  { name: '长枪', saveType: 10, typeId: 7, variant: 'medium', maximum: 800, code: 0x43 },
  { name: '太刀', saveType: 13, typeId: 2, variant: 'medium', maximum: 800, code: 0x43 },
  { name: '斩击斧', saveType: 14, typeId: 9, variant: 'medium', maximum: 800, code: 0x43 },
  { name: '铳枪', saveType: 15, typeId: 8, variant: 'medium', maximum: 800, code: 0x43 },
  { name: '弓', saveType: 16, typeId: 14, variant: 'low', maximum: 1000, code: 0x60 },
  { name: '双刀', saveType: 17, typeId: 4, variant: 'low', maximum: 1000, code: 0x60 },
  { name: '狩猎笛', saveType: 18, typeId: 6, variant: 'high', maximum: 970, code: 0x32 },
  { name: '操虫棍', saveType: 19, typeId: 11, variant: 'low', maximum: 1000, code: 0x60 },
  { name: '盾斧', saveType: 20, typeId: 10, variant: 'medium', maximum: 800, code: 0x43 },
]

describe('MH4G relic status maximum choices', () => {
  it.each(weapons)('writes the $name maximum as a tier byte and preserves every other byte', weapon => {
    const before = instance(weapon.saveType)
    const onChange = vi.fn()
    const oldCode = weapon.variant === 'low' ? 0x5f : weapon.code
    const lookups = [lookup(weapon.saveType, weapon.variant, oldCode, String(weapon.maximum))]
    render(<RelicWeaponAdvancedFields instance={before} saveType={weapon.saveType} weaponTypeId={weapon.typeId} lookups={lookups} decorations={[]} onChange={onChange} />)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '属性 / 异常值' }))
    expect(screen.getAllByRole('option', { name: /扩展最大值/ })).toHaveLength(1)
    fireEvent.change(screen.getByRole('combobox', { name: '属性 / 异常值关键词' }), { target: { value: 'maximum' } })
    fireEvent.click(screen.getByRole('option', { name: `${weapon.maximum}（扩展最大值）` }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0] as LoadoutInstanceState
    expect(next.recordHex).toBe(before.recordHex.slice(0, 8) + weapon.code.toString(16).padStart(2, '0') + before.recordHex.slice(10))
    expect(next.encoding).toBe('encodable')
  })

  it('shows the legacy 1000 choice as actual 1170 without silently rewriting the record', () => {
    const before = instance(19, 0x5f)
    const onChange = vi.fn()
    render(<RelicWeaponAdvancedFields instance={before} saveType={19} weaponTypeId={11} lookups={[lookup(19, 'low', 0x5f, '1000')]} decorations={[]} onChange={onChange} />)
    expect(screen.getByRole('button', { name: '属性 / 异常值' }).textContent).toBe('1170（当前超限值）')
    expect(screen.getByRole('status').textContent).toContain('当前实际值为 1170，已超限')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '属性 / 异常值' }))
    fireEvent.click(screen.getByRole('option', { name: '1000（扩展最大值）' }))
    const next = onChange.mock.calls[0][0] as LoadoutInstanceState
    expect(next.recordHex.slice(8, 10)).toBe('60')
    expect(before.recordHex.slice(8, 10)).toBe('5f')
  })

  it('keeps the extended maximum distinct from a full game acceptance guarantee', () => {
    render(<RelicWeaponAdvancedFields instance={instance(19, 0x60)} saveType={19} weaponTypeId={11} lookups={[]} decorations={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '属性 / 异常值' }).textContent).toBe('1000（扩展最大值）')
    expect(screen.getByRole('status').textContent).toContain('任务与保存仍需实测')
  })

  it('preserves unrecognized status bytes and keeps element and bowgun choices separate', () => {
    expect(relicLookupOptions([], 'status_value', 19, 'low', 0xfe)[0]).toMatchObject({ value: '254', label: expect.stringContaining('保持原样') })
    expect(relicLookupOptions([], 'attribute_value', 19, 'low', 0x60)).toEqual([{ value: '96', label: expect.stringContaining('未识别') }])
    for (const saveType of [11, 12]) expect(relicLookupOptions([], 'status_value', saveType, 'medium', 0)).toHaveLength(1)
  })

  it('offers the reviewed maximum instead of unverified overflow choices while preserving a current overflow byte', () => {
    const lookups = [lookup(19, 'low', 14, '200'), lookup(19, 'low', 0x14, '(99999)'), lookup(19, 'low', 0x5f, '1000')]
    const choices = relicLookupOptions(lookups, 'status_value', 19, 'low', 14)
    expect(choices.map(option => option.label)).toEqual(['200', '1000（扩展最大值）'])
    expect(relicLookupOptions(lookups, 'status_value', 19, 'low', 0x14)[0]).toMatchObject({ value: '20', label: expect.stringContaining('保持原样') })
  })
})
