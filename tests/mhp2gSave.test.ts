import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cmac } from '../api/save/p2g/codec'
import { Mhp2gSaveAdapter, P2G_LAYOUT as L } from '../api/save/adapters/mhp2g'
import { readP2gProfile } from '../api/save/p2g/profile'
import { syntheticP2gProfile, syntheticP2gSave } from './fixtures/p2gSave'

describe('P2G save format', () => {
  test('AES CMAC agrees with RFC 4493 including empty and partial blocks', () => {
    const key = Buffer.from('2b7e151628aed2a6abf7158809cf4f3c', 'hex')
    expect(cmac(Buffer.alloc(0), key).toString('hex')).toBe('bb1d6929e95937287fa37d129b756746')
    const msg = Buffer.from('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411', 'hex')
    expect(cmac(msg, key).toString('hex')).toBe('dfa66747de9ae63030ca32611497c827')
  })
  test('roundtrip and paired integrity; legs type zero is occupied', () => {
    const f = syntheticP2gSave(), a = new Mhp2gSaveAdapter(f.bin, f.sfo, syntheticP2gProfile)
    a.selectCharacter(0)
    expect(a.payload).toEqual(f.payload); expect(a.serializePair()).toEqual({ bin: f.bin, sfo: f.sfo })
    expect(a.equipment(0)).toMatchObject({ empty: false, kind: 'armor', saveType: 0, equipped: true, level: 3 })
    const corrupt = Buffer.from(f.bin); corrupt[1234] ^= 1
    expect(() => new Mhp2gSaveAdapter(corrupt, f.sfo, syntheticP2gProfile)).toThrow(/校验/)
    const corruptSfo = Buffer.from(f.sfo); corruptSfo[corruptSfo.length - 1] ^= 1
    expect(() => new Mhp2gSaveAdapter(f.bin, corruptSfo, syntheticP2gProfile)).toThrow(/SFO 校验/)
  })
  test('equipped updates, duplicate copies, swapping refs, delete guard and preset cleanup', () => {
    const f = syntheticP2gSave(), a = new Mhp2gSaveAdapter(f.bin, f.sfo, syntheticP2gProfile); a.selectCharacter(0)
    const original = Buffer.from(a.equipment(0).recordHex, 'hex')
    a.setEquipment(1, original)
    const changed = Buffer.from(original); changed[4] = 5; a.setEquipment(1, changed)
    expect(a.payload.subarray(L.start + L.gear + 12, L.start + L.gear + 24)).toEqual(original)
    a.setEquipment(0, changed)
    expect(a.payload.subarray(L.start + L.gear + 12, L.start + L.gear + 24)).toEqual(changed)
    const before = Buffer.from(a.payload)
    expect(() => a.setEquipment(0, Buffer.alloc(12))).toThrow(/穿戴/); expect(a.payload).toEqual(before)
    a.payload.writeUInt16LE(0, L.start + L.presets + 2)
    a.swapEquipment(0, 4); expect(a.payload.readUInt16LE(L.start + L.refs + 2)).toBe(4); expect(a.payload.readUInt16LE(L.start + L.presets + 2)).toBe(4)
    const weapon = Buffer.from([1, 5, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]); a.setEquipment(7, weapon)
    a.payload.writeUInt16LE(7, L.start + L.presets); a.payload.fill(0xa5, L.start + L.presets + 12, L.start + L.presets + 32)
    a.setEquipment(7, Buffer.alloc(12))
    expect(a.payload.subarray(L.start + L.presets, L.start + L.presets + 12)).toEqual(Buffer.alloc(12, 255))
    expect(a.payload.subarray(L.start + L.presets + 12, L.start + L.presets + 32)).toEqual(Buffer.alloc(20, 0xa5))
    expect(a.validate()).toEqual([])
    const pair = a.serializePair(), reopened = new Mhp2gSaveAdapter(pair.bin, pair.sfo, syntheticP2gProfile)
    expect(reopened.payload).toEqual(a.payload)
  })
  test.skipIf(!process.env.P2G_SAVE_RESEARCH)('private PPSSPP sample reproduces BIN and SFO exactly and reopens a controlled mutation', () => {
    const root = process.env.P2G_SAVE_RESEARCH!, dir = join(root, 'save-preflight-v1'), source = join(dir, 'extracted/ULJM05500')
    const profile = readP2gProfile(process.env.P2G_SAVE_PROFILE_DIR ?? '.runtime-assets')
    const bin = readFileSync(join(source, 'MHP2NDG.BIN')), sfo = readFileSync(join(source, 'PARAM.SFO'))
    const a = new Mhp2gSaveAdapter(bin, sfo, profile)
    expect(a.payload).toEqual(readFileSync(join(dir, 'verification/payload.bin')))
    expect(a.serializePair()).toEqual({ bin, sfo }); expect(a.validate()).toEqual([])
    expect(a.characters().map(c => c.hunterRank)).toEqual([1, 9, 9]); a.selectCharacter(1)
    const before = Buffer.from(a.payload), field = a.personalFields().find(f => f.key === 'zenny')!
    a.setPersonalField('zenny', Number(field.value) === 9999999 ? 9999998 : Number(field.value) + 1)
    const result = a.serializePair(), reopened = new Mhp2gSaveAdapter(result.bin, result.sfo, profile)
    expect(reopened.payload).toEqual(a.payload)
    const differences = [...a.payload.keys()].filter(i => a.payload[i] !== before[i])
    expect(differences.length).toBeGreaterThan(0)
    expect(differences.every(i => i >= L.start + L.stride + L.zenny && i < L.start + L.stride + L.zenny + 4)).toBe(true)
  })
})
