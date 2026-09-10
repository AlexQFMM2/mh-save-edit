import { describe, expect, it } from 'vitest'
import { runAutoLoadout } from '../api/loadout/autoSearch'
import { logicalLoadoutSchema } from '../api/loadout/schemas'
import {
  ARMOR_LOADOUT_SLOTS,
  createEmptyLogicalLoadout,
  type LoadoutArmor,
  type LoadoutCatalogSnapshot,
  type LoadoutWeapon,
} from '../api/loadout/types'

const weapon: LoadoutWeapon = {
  kind: 'weapon', gameId: 'mhgu', candidateKey: 'weapon:test', sourceKind: 'catalog',
  weaponKey: 'test', templateKey: null, saveType: 7, saveId: 1, nameCn: '测试大剑',
  nameEn: 'Test Great Sword', typeId: 1, typeNameCn: '大剑', rarity: 1, slots: 0,
  attack: 100, affinity: 0, defense: 0, iconPath: null, decorations: [], lock: 'unlocked',
}

function armor(part: LoadoutArmor['part']): LoadoutArmor {
  return {
    kind: 'armor', gameId: 'mhgu', candidateKey: `armor:${part}`, sourceKind: 'catalog',
    dexId: 1, templateKey: null, saveType: 1, saveId: 1, nameCn: part, nameEn: part,
    part, combat: 'both', gender: 'both', rarity: 1, slots: 0, baseDefense: 10,
    maxDefense: 20, fireRes: 0, waterRes: 0, thunderRes: 0, iceRes: 0, dragonRes: 0,
    iconPath: null, skills: [], decorations: [], lock: 'unlocked',
  }
}

describe('loadout charm persistence', () => {
  it('does not persist validation ranges in generated natural charms', async () => {
    const loadout = createEmptyLogicalLoadout('mhgu', 'test')
    loadout.weapon = weapon
    const snapshot: LoadoutCatalogSnapshot = {
      gameId: 'mhgu', dataVersion: 'test', weapons: [weapon],
      armors: ARMOR_LOADOUT_SLOTS.map(armor), decorations: [],
      skills: [{
        skillId: 10, nameCn: '攻击', nameEn: 'Attack', nameJp: '攻撃',
        activations: [{ activationKey: 'attack:10', skillId: 10, threshold: 5, direction: 'positive', nameCn: '攻击提升' }],
      }],
      charmClasses: [{ classId: 1, nameCn: '测试护石', nameEn: 'Test charm', maxSlots: 3 }],
      charmRanges: [{
        rangeKey: 'range:a', classId: 1, skillId: 10, position: 'A', minPoints: 1,
        maxPoints: 5, slotCount: 0, maxSlots: 3, status: 'exact', source: 'test',
      }],
      relicLookups: [],
    }
    const results = await runAutoLoadout(snapshot, {
      requestId: 'test', gameId: 'mhgu', dataVersion: 'test', baseLoadout: loadout,
      targets: [{ activationKey: 'attack:10', skillId: 10, threshold: 5, nameCn: '攻击提升' }],
      resultLimit: 5, timeoutMs: 5000,
    }, { checkpoint: async () => {}, progress: () => {} })

    expect(results[0]?.loadout.charm?.skill1?.points).toBe(5)
    expect(results[0]?.loadout.charm).not.toHaveProperty('ranges')
    expect(logicalLoadoutSchema.safeParse(results[0]?.loadout).success).toBe(true)
  })
})
