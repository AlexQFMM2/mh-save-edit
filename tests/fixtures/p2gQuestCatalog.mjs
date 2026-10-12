// Synthetic fixture only. No game-derived text, assets or IDs.
import fs from 'node:fs'
import path from 'node:path'
import { createMonsterFixture } from './p2gMonsterCatalog.mjs'
import { buildMonsterCatalog } from '../../tools/build_mhp2g_monster_catalog.mjs'
import { sha256 } from '../../tools/mhp2g/sources.mjs'
export function createQuestFixture(dir) {
  const fixture=createMonsterFixture(dir);buildMonsterCatalog(fixture)
  const base=path.join(fixture.output,'mhp2g.sqlite')
  const quest={questKey:'mhp2g:q1',nativeId:'1',nameCn:'甲测试任务',nameJp:'テスト任務甲',goalCn:'完成测试目标',goalJp:'テスト目標',
    systemKey:'village',systemNameCn:'村',rank:'low',star:1,levelId:100,levelNameCn:'村★1',questTypeId:1,questTypeNameCn:'讨伐',
    locationId:1,locationNameCn:'测试区域',locationNameJp:'テスト地域',timeMinutes:10,fee:1,reward:2,hrp:3,keyStatus:'key',monsterIds:[1],
    rewards:[{groupKey:'0',itemId:2,quantity:1,probability:100,guaranteed:true}],
    p2g:{source:'native',descriptionCn:'合成测试委托',descriptionJp:'テスト依頼',failureCn:'超时',failureJp:'時間切れ',clientCn:'测试委托人',clientJp:'テスト依頼主',
      monsterTextCn:'测试兽',monsterTextJp:'テスト獣',condition:{kind:'condition',text:'初始开放'},
      rewardGroups:[{key:'0',label:'基本报酬',draws:{kind:'fixed',count:1},firstDraw:{itemId:2,quantity:1,unconditionalGuarantee:true}}],
      supplies:[{itemId:1,quantity:2}],largeGroups:[[{monsterId:1,quantity:1,actorVariant:0}]],smallGroups:[],transitions:[],
      wait:null,sequential:false,keyPrerequisite:false,translationSources:{name:{status:'reviewed',basis:'synthetic'}}}}
  const second=structuredClone(quest);Object.assign(second,{questKey:'mhp2g:q2',nativeId:'2',nameCn:'乙测试任务',nameJp:'テスト任務乙',keyStatus:'urgent'})
  second.p2g.condition={kind:'any',children:[{kind:'condition',text:'旧档已完成',questKey:'mhp2g:q1'},{kind:'all',text:'同时完成',children:[{kind:'condition',text:'介绍事件结束（不要求完成）',questKey:'mhp2g:q1'}]}]}
  second.p2g.sequential=true;second.p2g.largeGroups.push([{monsterId:1,quantity:1,actorVariant:1}]);second.p2g.transitions=[{nextGroupIndex:1,condition:{kind:'carried-item-count-at-least',itemId:1,count:2}}]
  const wiki=structuredClone(quest);Object.assign(wiki,{questKey:'wiki:9:0:2',nativeId:null,nameCn:'配信测试',nameJp:'テスト配信',systemKey:'event',systemNameCn:'活动',keyStatus:'normal'})
  wiki.rewards=[{groupKey:'wiki',itemId:1,quantity:null,probability:null,guaranteed:null}]
  Object.assign(wiki.p2g,{source:'wiki',descriptionCn:null,descriptionJp:null,failureCn:null,failureJp:null,clientCn:null,clientJp:null,
    rewardGroups:[{key:'wiki',label:'Wiki 报酬',draws:null,firstDraw:null}],supplies:null,largeGroups:null,smallGroups:null})
  const snapshot={schema:'mhp2g-quest-evidence-v1',inputs:{base:sha256(base)},unresolved:[],quests:[quest,second,wiki],aliases:{'wiki:9:0:1':'mhp2g:q1'},
    monsterReferences:[{monsterId:1,ordinal:0,sourceKey:'wiki:9:0:1',questKey:'mhp2g:q1',nameJp:'テスト任務甲',fields:[{label:'体力',value:'123'}],basis:'synthetic'}],itemReferences:[]}
  const evidence=path.join(dir,'quest-evidence.json'),save=()=>fs.writeFileSync(evidence,JSON.stringify(snapshot));save()
  return {base,evidence,output:path.join(dir,'quests'),snapshot,save}
}
