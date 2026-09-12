import { describe, expect, it } from 'vitest'
import { saveBoxWriteTargetSchema, saveCatalogEquipmentSchema, saveCatalogItemSchema, saveCommandSchema, saveLoadoutPreviewSchema, saveOpenSchema, saveSectionSchema } from '../api/save/schemas'

const sessionId = '9f36c995-c15a-49f7-ac4d-8f89bf508e57'

describe('save IPC schemas', () => {
  it('accepts bounded save identities and strict catalog-write previews', () => {
    expect(saveBoxWriteTargetSchema.parse({ sessionId, revision: 2, domain: 'items' })).toEqual({ sessionId, revision: 2, domain: 'items' })
    expect(saveCatalogItemSchema.parse({ sessionId, revision: 2, gameId: 'mhgu', saveId: 1, count: 127 }).count).toBe(127)
    expect(saveCatalogEquipmentSchema.parse({ sessionId, revision: 2, gameId: 'mh4g', domain: 'hunter-equipment', saveType: 7, saveId: 1, level: 3 }).level).toBe(3)
  })

  it('rejects invalid games, revisions, pages, paths and extra fields', () => {
    expect(() => saveOpenSchema.parse({ contentGameId: 'mhxx', formatId: 'mhxx-3ds-citra' })).toThrow()
    expect(() => saveSectionSchema.parse({ sessionId, revision: 0, section: 'item-box', page: 0 })).toThrow()
    expect(() => saveBoxWriteTargetSchema.parse({ sessionId, revision: 1, domain: 'items', path: '/tmp/save' })).toThrow()
    expect(() => saveCatalogItemSchema.parse({ sessionId, revision: 1, gameId: 'mhgu', saveId: 1, count: 1, sourcePath: '../system' })).toThrow()
    expect(() => saveCatalogEquipmentSchema.parse({ sessionId, revision: 1, gameId: 'mhgu', domain: 'palico-equipment', saveType: -1, saveId: 1 })).toThrow()
  })

  it('rejects structurally invalid commands before they reach an adapter', () => {
    expect(() => saveCommandSchema.parse({ kind: 'set-item', sessionId, revision: 1, slot: -1, itemId: 1, count: 1 })).toThrow()
    expect(() => saveCommandSchema.parse({ kind: 'set-equipment-record', sessionId, revision: 1, domain: 'hunter-equipment', slot: 1, recordHex: '../system' })).toThrow()
    expect(() => saveCommandSchema.parse({ kind: 'set-palico', sessionId, revision: 1, index: 0, changes: { level: 99 } })).toThrow()
  })

  it('keeps loadout write previews strict and free of filesystem fields', () => {
    const loadout = { schemaVersion: 1, dataVersion: 'test', gameId: 'mhgu', name: 'test', gender: 'male', weapon: null, armor: {}, charm: null }
    expect(saveLoadoutPreviewSchema.parse({ sessionId, revision: 1, loadout })).toMatchObject({ loadout })
    expect(() => saveLoadoutPreviewSchema.parse({ sessionId, revision: 1, loadout, sourcePath: '/tmp/save' })).toThrow()
  })
})
