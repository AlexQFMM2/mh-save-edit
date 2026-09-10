import { describe, expect, it } from 'vitest'
import { normalizeLegacyTransientLoadoutFields, reconcileImportedLoadout } from '../api/loadout/file'
import { logicalLoadoutSchema } from '../api/loadout/schemas'
import { createEmptyLogicalLoadout, type LoadoutCatalogSnapshot, type LoadoutWeapon } from '../api/loadout/types'

const weapon: LoadoutWeapon = { kind: 'weapon', gameId: 'mhgu', candidateKey: 'catalog:w', sourceKind: 'catalog', weaponKey: 'w', templateKey: null, saveType: 7, saveId: 1, nameCn: '大剑', nameEn: 'GS', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 1, attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'unlocked' }
const snapshot: LoadoutCatalogSnapshot = { gameId: 'mhgu', dataVersion: 'current', weapons: [weapon], armors: [], decorations: [{ saveId: 5, nameCn: '攻击珠', slots: 1, skills: [{ skillId: 10, nameCn: '攻击', points: 1 }] }], skills: [{ skillId: 10, nameCn: '攻击', nameEn: 'Attack', nameJp: '攻撃', activations: [] }], charmClasses: [], charmRanges: [], relicLookups: [] }

describe('loadout file reconciliation', () => {
  it('rehydrates catalog values from the current snapshot instead of trusting imported stats', () => {
    const imported = createEmptyLogicalLoadout('mhgu', 'old')
    imported.weapon = { ...weapon, attack: 99999, slots: 9, decorations: [{ saveId: 5, nameCn: '伪造珠', slots: 3, skills: [{ skillId: 10, nameCn: '攻击', points: 99 }] }] }
    const result = reconcileImportedLoadout(snapshot, imported)
    expect(result.dataVersion).toBe('current')
    expect(result.weapon?.attack).toBe(100)
    expect(result.weapon?.slots).toBe(1)
    expect(result.weapon?.decorations[0]).toMatchObject({ nameCn: '攻击珠', slots: 1, skills: [{ skillId: 10, points: 1 }] })
  })

  it('rejects nested equipment from another game', () => {
    const imported = createEmptyLogicalLoadout('mhgu', 'old')
    imported.weapon = { ...weapon, gameId: 'mh4g' }
    expect(logicalLoadoutSchema.safeParse(imported).success).toBe(false)
  })

  it('keeps transient charm ranges out of reconciled loadouts', () => {
    const imported = createEmptyLogicalLoadout('mhgu', 'old')
    imported.charm = {
      kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '测试护石', slots: 0,
      skill1: { skillId: 10, nameCn: '攻击', points: 1 }, skill2: null,
      decorations: [], legality: 'confirmed', encoding: 'encodable', issues: [], lock: 'unlocked',
    }
    const result = reconcileImportedLoadout(snapshot, imported)
    expect(result.charm).not.toHaveProperty('ranges')
    expect(logicalLoadoutSchema.safeParse(result).success).toBe(true)
  })

  it('removes only the known legacy charm field before strict validation', () => {
    const imported = createEmptyLogicalLoadout('mhgu', 'old')
    imported.charm = {
      kind: 'charm', gameId: 'mhgu', classId: 1, classNameCn: '测试护石', slots: 0,
      skill1: null, skill2: null, decorations: [], legality: 'confirmed',
      encoding: 'encodable', issues: [], lock: 'unlocked',
    }
    const legacy = { ...imported, charm: { ...imported.charm, ranges: [{ position: 'A', min: 1, max: 5, source: 'old' }] } }
    expect(logicalLoadoutSchema.safeParse(normalizeLegacyTransientLoadoutFields(legacy)).success).toBe(true)
    const stillInvalid = { ...legacy, charm: { ...legacy.charm, unexpected: true } }
    expect(logicalLoadoutSchema.safeParse(normalizeLegacyTransientLoadoutFields(stillInvalid)).success).toBe(false)
  })
})
