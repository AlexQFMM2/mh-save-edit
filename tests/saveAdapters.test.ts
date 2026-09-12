import { describe, expect, it } from 'vitest'
import { Mh3uSaveAdapter } from '../api/save/adapters/mh3u'
import { encryptMh4g, Mh4gSaveAdapter } from '../api/save/adapters/mh4g'
import { MhguSaveAdapter } from '../api/save/adapters/mhgu'

describe('save adapters', () => {
  it('round-trips an MH3G document and patches only selected fields', () => {
    const source = Buffer.alloc(0x8a00); source.write('Hunter', 7, 'utf8')
    const adapter = new Mh3uSaveAdapter(source, 'mh3g-3ds-citra'); expect(adapter.serialize()).toEqual(source)
    adapter.setItem(12, 345, 17); expect(adapter.item(12)).toMatchObject({ itemId: 345, count: 17 })
    const output = adapter.serialize(); expect(output.subarray(0x018c + 12 * 4, 0x018c + 13 * 4)).not.toEqual(source.subarray(0x018c + 12 * 4, 0x018c + 13 * 4))
  })

  it('marks same-sized MH3G data with impossible empty-slot structure as unsafe', () => {
    const source = Buffer.alloc(0x8a00)
    source.writeUInt16LE(7, 0x018c + 2)
    const adapter = new Mh3uSaveAdapter(source, 'mh3g-3ds-citra')
    expect(adapter.validate()).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'mh3u.item.empty-count', severity: 'error' })]))
  })

  it('decrypts and byte-identically re-encrypts a synthetic MH4G document', () => {
    const plain = Buffer.alloc(81408); plain.writeUInt16LE(0x10, 0); plain.writeUInt16LE(0x1731, 2); plain.write('A\0l\0e\0x\0', 8, 'binary')
    const encrypted = encryptMh4g(plain); const adapter = new Mh4gSaveAdapter(encrypted)
    expect(adapter.serialize()).toEqual(encrypted)
    adapter.setItem(3, 221, 44); expect(adapter.item(3)).toMatchObject({ itemId: 221, count: 44 })
    expect(new Mh4gSaveAdapter(adapter.serialize()).item(3)).toMatchObject({ itemId: 221, count: 44 })
  })

  it('handles GU character selection and never changes palico level or EXP', () => {
    const source = Buffer.alloc(5_159_064); source.writeUInt32LE(0xc6, 0); source[4] = 1; source.writeUInt32LE(0x1c, 8)
    const bases = [0x18cc78, 0x2ac53c, 0x3cbe00]; bases.forEach((base, slot) => source.writeUInt32LE(base, 0x10 + slot * 4))
    source.write('Hunter', bases[0] + 0x23b7d, 'utf8'); const palico = bases[0] + 0x23bb6; source.write('Mochi', palico, 'utf8'); source.writeUInt32LE(123456, palico + 0x20); source[palico + 0x24] = 98
    source[palico + 0x55] = 3; source.fill(57, palico + 0x38 + 3, palico + 0x38 + 16)
    source[palico + 0x57] = 2; source.fill(96, palico + 0x48 + 2, palico + 0x48 + 12)
    const adapter = new MhguSaveAdapter(source, 'mhgu-switch-yuzu', 'system'); adapter.selectCharacter(0); const before = adapter.palico(0)
    adapter.setPalico(0, { name: 'Mochi II', forte: 7 }); adapter.setItem(20, 832, 99)
    const reopened = new MhguSaveAdapter(adapter.serialize(), 'mhgu-switch-yuzu', 'system'); reopened.selectCharacter(0); const after = reopened.palico(0)
    expect(after.name).toBe('Mochi II'); expect(after.forte).toBe(7); expect(after.level).toBe(before.level); expect(after.experience).toBe(before.experience); expect(reopened.item(20)).toMatchObject({ itemId: 832, count: 99 })
    expect(after.learnedActions.slice(3)).toEqual(Array(13).fill(57)); expect(after.learnedSkills.slice(2)).toEqual(Array(10).fill(96))
    expect(() => reopened.setPalico(0, { level: 1 })).toThrow(/只读/)
  })

  it('rejects structurally unsafe Palico ability edits while allowing unrelated fields to preserve legacy data', () => {
    const source = Buffer.alloc(5_159_064)
    source.writeUInt32LE(0xc6, 0); source[4] = 1; source.writeUInt32LE(0x1c, 8)
    ;[0x18cc78, 0x2ac53c, 0x3cbe00].forEach((value, slot) => source.writeUInt32LE(value, 0x10 + slot * 4))
    const base = 0x18cc78
    const palico = base + 0x23bb6
    source.write('Mochi', palico, 'utf8')
    source[palico + 0x55] = 3
    source.set([1, 2, 3], palico + 0x38)
    source.fill(57, palico + 0x38 + 3, palico + 0x38 + 16)
    source.set([1, 2, 0, 0, 0, 0, 0, 0], palico + 0x28)
    source[palico + 0x57] = 2
    source.set([4, 5], palico + 0x48)
    source.fill(96, palico + 0x48 + 2, palico + 0x48 + 12)
    const adapter = new MhguSaveAdapter(source, 'mhgu-switch-yuzu', 'system')
    adapter.selectCharacter(0)
    expect(() => adapter.setPalico(0, { equippedActions: [1, 0, 2, 0, 0, 0, 0, 0] })).toThrow(/连续排列/)
    expect(() => adapter.setPalico(0, { equippedActions: [56, 0, 0, 0, 0, 0, 0, 0] })).toThrow(/已学行动池/)
    expect(() => adapter.setPalico(0, { learnedSkills: [4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })).toThrow(/尾部哨兵/)
    expect(() => adapter.setPalico(0, { name: 'Mochi 2' })).not.toThrow()
  })

  it('synchronizes a uniquely matched GU equipped cache without touching ambiguous matches', () => {
    const source = Buffer.alloc(5_159_064)
    source.writeUInt32LE(0xc6, 0); source[4] = 1; source.writeUInt32LE(0x1c, 8)
    const base = 0x18cc78
    ;[base, 0x2ac53c, 0x3cbe00].forEach((value, slot) => source.writeUInt32LE(value, 0x10 + slot * 4))
    source.write('Hunter', base + 0x23b7d, 'utf8')
    const adapter = new MhguSaveAdapter(source, 'mhgu-switch-yuzu', 'system')
    adapter.selectCharacter(0)
    const original = Buffer.alloc(36)
    original.writeUInt16LE(7, 0)
    original.writeUInt16LE(10, 2)
    adapter.setEquipment(5, original)
    original.subarray(0, 12).copy(adapter.payload, base + 0x0110)
    const replacement = Buffer.from(original)
    replacement.writeUInt16LE(11, 2)
    adapter.setEquipment(5, replacement)
    expect(adapter.payload.subarray(base + 0x0110, base + 0x0110 + 12)).toEqual(replacement.subarray(0, 12))

    const ambiguous = Buffer.from(replacement)
    adapter.setEquipment(6, ambiguous)
    ambiguous.subarray(0, 12).copy(adapter.payload, base + 0x0110 + 44)
    const next = Buffer.from(ambiguous)
    next.writeUInt16LE(12, 2)
    adapter.setEquipment(5, next)
    expect(adapter.payload.subarray(base + 0x0110, base + 0x0110 + 12)).toEqual(ambiguous.subarray(0, 12))
    expect(adapter.payload.subarray(base + 0x0110 + 44, base + 0x0110 + 56)).toEqual(ambiguous.subarray(0, 12))
  })
})
