import { describe, expect, it } from 'vitest'
// @ts-expect-error Preparation-only JavaScript module.
import { mapRows, normalizeSkillName, wikiRows } from '../tools/map_skill_wiki.mjs'
const activation = {game_id:'mh4g',name_jp:'試験+1',threshold:10}
const row = {game:'mh4g',nameJp:'試験+1',threshold:10,effect:'synthetic'}
describe('strict Wiki skill mapping',()=>{
  it('requires game, exact normalized name and threshold',()=>{
    expect(mapRows([activation],[row])[0].status).toBe('matched')
    for(const changed of [{...row,game:'mhgu'},{...row,threshold:15},{...row,nameJp:'試験+2'}])expect(mapRows([activation],[changed])[0].status).toBe('unmatched')
  })
  it('does not silently select or join duplicate source rows',()=>{
    expect(mapRows([activation],[row,{...row,effect:'another'}])[0].status).toBe('ambiguous')
  })
  it('preserves level and positive versus negative identity',()=>{
    expect(normalizeSkillName('試験＋１')).toBe(normalizeSkillName('試験+1'))
    expect(normalizeSkillName('試験-1')).not.toBe(normalizeSkillName('試験+1'))
  })
  it('preserves nonnumeric special markers instead of inventing a threshold',()=>{
    const rows=wikiRows({records:[{game:'mh3g',tables:[{header:['系统（日）','系统（中）','点数','发动技能（日）','发动技能（中）','效果'],rows:[['系','系','E','特例','特例','説明']]}]}]})
    expect(rows[0].threshold).toBeNull()
    expect(rows[0].point).toBe('E')
  })
  it('rejects incomplete source snapshots',()=>{
    expect(()=>wikiRows({records:[{url:'https://example.invalid',error:'timeout'}]})).toThrow('Incomplete source')
  })
})
