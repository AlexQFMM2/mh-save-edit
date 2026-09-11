import { describe, expect, it } from 'vitest'
import { palicoArmorFiltersSchema, palicoEquipmentIdentitySchema, palicoSkillFiltersSchema, palicoSupportMoveFiltersSchema, palicoTypeIdentitySchema, palicoWeaponFiltersSchema } from '../api/catalog/schemas'

describe('Palico catalog schemas',()=>{
  it('accepts MHGU filters and the fixed identity ranges',()=>{
    expect(palicoTypeIdentitySchema.parse({gameId:'mhgu',typeId:7}).typeId).toBe(7)
    expect(palicoSupportMoveFiltersSchema.parse({gameId:'mhgu',query:'回复笛',generationGroup:'A'}).generationGroup).toBe('A')
    expect(palicoSkillFiltersSchema.parse({gameId:'mhgu',generationGroup:'fixed'}).generationGroup).toBe('fixed')
    expect(palicoSkillFiltersSchema.parse({gameId:'mhgu',memoryCost:3,unlockKind:'distribution'}).memoryCost).toBe(3)
    expect(palicoWeaponFiltersSchema.parse({gameId:'mhgu',sort:'meleeAttack',direction:'desc',pageSize:100}).sort).toBe('meleeAttack')
    expect(palicoArmorFiltersSchema.parse({gameId:'mhgu',part:'head',sort:'defense'}).part).toBe('head')
    expect(palicoEquipmentIdentitySchema.parse({gameId:'mhgu',kind:'weapon',equipmentId:508}).kind).toBe('weapon')
  })
  it('rejects other games, bad IDs, unknown filters and path injection',()=>{
    expect(()=>palicoTypeIdentitySchema.parse({gameId:'mh4g',typeId:0})).toThrow()
    expect(()=>palicoTypeIdentitySchema.parse({gameId:'mhgu',typeId:8})).toThrow()
    expect(()=>palicoSupportMoveFiltersSchema.parse({gameId:'mhgu',query:'x'.repeat(121)})).toThrow()
    expect(()=>palicoSkillFiltersSchema.parse({gameId:'mhgu',unlockKind:'other'})).toThrow()
    expect(()=>palicoWeaponFiltersSchema.parse({gameId:'mhgu',path:'../../secret'})).toThrow()
  })
})
