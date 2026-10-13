import { describe,expect,it } from 'vitest'
import { armorCatalogFiltersSchema,armorIdentitySchema,armorSetFiltersSchema,skillIdentitySchema } from '../api/catalog/schemas'

describe('armor catalog IPC schemas',()=>{
  it('accepts bounded armor requests',()=>{expect(armorIdentitySchema.parse({gameId:'mhgu',dexId:5726})).toEqual({gameId:'mhgu',dexId:5726});expect(armorCatalogFiltersSchema.parse({gameId:'mh3g',part:'head',sort:'skillPoints',skillId:1,pageSize:100}).part).toBe('head');expect(armorSetFiltersSchema.parse({gameId:'mh4g',sort:'skillPoints',skillId:1}).sort).toBe('skillPoints')})
  it('rejects invalid identities, paths and page sizes',()=>{expect(()=>armorIdentitySchema.parse({gameId:'mhgu',dexId:0})).toThrow();expect(()=>armorCatalogFiltersSchema.parse({gameId:'mh3g',part:'helmet'})).toThrow();expect(()=>armorSetFiltersSchema.parse({gameId:'mh4g',pageSize:101})).toThrow();expect(()=>armorIdentitySchema.parse({gameId:'../../data',dexId:1})).toThrow()})
  it('validates skill identities without accepting extra fields',()=>{expect(skillIdentitySchema.parse({gameId:'mh3g',skillId:1}).skillId).toBe(1);expect(()=>skillIdentitySchema.parse({gameId:'mh3g',skillId:1,path:'/tmp/data'})).toThrow()})
})
