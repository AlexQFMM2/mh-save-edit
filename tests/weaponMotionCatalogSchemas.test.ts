import { describe, expect, it } from 'vitest'
import { weaponMotionFiltersSchema } from '../api/catalog/schemas'

describe('weapon motion IPC schema',()=>{
  it('accepts bounded MHGU filters',()=>expect(weaponMotionFiltersSchema.parse({gameId:'mhgu',weaponTypeId:14,styleIds:['guild','valor'],category:'hunterArt'}).styleIds).toEqual(['guild','valor']))
  it('rejects other games, unknown styles and injected fields',()=>{expect(()=>weaponMotionFiltersSchema.parse({gameId:'mh4g',weaponTypeId:1})).toThrow();expect(()=>weaponMotionFiltersSchema.parse({gameId:'mhgu',weaponTypeId:1,styleIds:['frontier']})).toThrow();expect(()=>weaponMotionFiltersSchema.parse({gameId:'mhgu',weaponTypeId:1,path:'../../x'})).toThrow()})
})
