import {describe,expect,it} from 'vitest'
// @ts-expect-error Preparation-only JavaScript module.
import {matchesWikiSourceIdentity as matches} from '../tools/runtime/skillWikiIdentity.mjs'

describe('explicit Wiki source identity exceptions',()=>{
 it.each(['mh3g','mh4g','mhgu'])('accepts torso special marker without changing stored threshold for %s',game=>{
  const entry={gameId:game,nameJp:'胴系統倍加',threshold:1,specialMarker:'Torso Up',sourceMapping:'torso-up-special',reviewNote:'synthetic'}
  expect(matches(entry,{game,nameJp:'胴系統倍加',threshold:0,point:'0'})).toBe(true)
  expect(matches(entry,{game,nameJp:'胴系統倍加',threshold:null,point:'E'})).toBe(true)
  expect(matches({...entry,specialMarker:null},{game,nameJp:'胴系統倍加',threshold:0})).toBe(false)
  expect(matches(entry,{game,nameJp:'胴系統倍加',threshold:10})).toBe(false)
  expect(entry.threshold).toBe(1)
 })
 it('requires explicit approval of a same-threshold carving alias',()=>{
  const entry={gameId:'mh4g',nameJp:'剥ぎ取り名人',threshold:15,reviewNote:'synthetic'}
  const source={game:'mh4g',nameJp:'剥ぎ取り達人',threshold:15,treeJp:'剥ぎ取り'}
  expect(matches(entry,source)).toBe(false)
  expect(matches({...entry,sourceMapping:'mh4g-carving-alias'},source)).toBe(true)
  expect(matches({...entry,sourceMapping:'mh4g-carving-alias'},{...source,threshold:20})).toBe(false)
 })
 it('never maps different Expert levels as an effect alias',()=>{
  const entry={gameId:'mh4g',nameJp:'見切り+4',threshold:25,reviewNote:'synthetic'}
  const source={game:'mh4g',nameJp:'見切りマスター',threshold:30,treeJp:'達人'}
  expect(matches(entry,source)).toBe(false)
  expect(matches({...entry,sourceMapping:'mh4g-expert-catalog-note',descriptionCn:'会心率+30'},source)).toBe(false)
  expect(matches({...entry,sourceMapping:'mh4g-expert-catalog-note',descriptionCn:'【资料差异说明】合成测试：原条目不是来源等级。'},source)).toBe(true)
 })
 it('rejects unknown override kinds and wrong games',()=>{
  const entry={gameId:'mh3g',nameJp:'試験',threshold:10,reviewNote:'synthetic'}
  expect(matches({...entry,sourceMapping:'anything'},{game:'mh3g',nameJp:'試験',threshold:10})).toBe(false)
  expect(matches(entry,{game:'mh4g',nameJp:'試験',threshold:10})).toBe(false)
 })
 it('accepts only the explicit 3G high-wind alias',()=>{
  const entry={gameId:'mh3g',nameJp:'風圧【大】無効',threshold:15,sourceMapping:'mh3g-wind-alias',reviewNote:'synthetic'}
  expect(matches(entry,{game:'mh3g',nameJp:'風圧完全無効',threshold:15,treeJp:'風圧'})).toBe(true)
  expect(matches(entry,{game:'mh3g',nameJp:'風圧無効',threshold:10,treeJp:'風圧'})).toBe(false)
 })
})
