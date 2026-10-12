import type { QuestDetail } from '../../api/catalog/types'
export const p2gQuest: QuestDetail = {
  gameId:'mhp2g',questKey:'mhp2g:q1',dexId:null,nativeId:'1',availability:'common',nameCn:'测试任务甲',nameEn:'',nameJp:'テスト任務',
  goalCn:'测试目标',goalEn:'',subGoalCn:'',subGoalEn:'',levelId:1,levelNameCn:'村★1',levelNameEn:'',systemKey:'village',systemNameCn:'村',rank:'low',star:1,
  questTypeId:1,questTypeNameCn:'讨伐',questTypeNameEn:'',locationId:1,locationNameCn:'测试地图',locationNameEn:'',timeMinutes:10,fee:1,reward:2,reward2:null,hrp:3,hrp2:null,keyStatus:'normal',
  monsters:[{gameId:'mhp2g',monsterId:1,nameCn:'测试兽',nameEn:'',iconPath:null,slot:0,sourceKind:'native'}],modifiers:[],specialRewards:[],relations:[],
  rewards:[{id:1,groupKey:'0',region:'',item:{gameId:'mhp2g',itemId:2,nameCn:'测试奖励',nameEn:''},quantity:null,probability:null,guaranteed:true}],
  p2g:{source:'native',descriptionCn:'测试说明',descriptionJp:'テスト説明',failureCn:'测试失败条件',failureJp:'',clientCn:'测试委托人',clientJp:'',monsterTextCn:'测试兽',monsterTextJp:'',
    condition:{kind:'any',children:[{kind:'condition',text:'继承旧档时已完成',questKey:'mhp2g:q2'},{kind:'condition',text:'介绍事件结束（不要求完成）',questKey:'mhp2g:q3'}]},
    conditionQuests:[{gameId:'mhp2g',questKey:'mhp2g:q2',nameCn:'测试前置',nameEn:''},{gameId:'mhp2g',questKey:'mhp2g:q3',nameCn:'介绍任务',nameEn:''}],conditionMonsters:[],
    rewardGroups:[{key:'0',label:'基本报酬',draws:{kind:'fixed',count:4},firstDraw:{unconditionalGuarantee:true}}],supplies:[{item:{gameId:'mhp2g',itemId:1,nameCn:'测试支给',nameEn:''},quantity:2}],
    largeGroups:[[{monsterId:1,quantity:1,actorVariant:0}],[{monsterId:1,quantity:1,actorVariant:1}]],smallGroups:[],sequential:true,
    transitions:[{nextGroupIndex:1,condition:{kind:'carried-item-count-at-least',itemId:1,count:2}}],transitionItems:[{gameId:'mhp2g',itemId:1,nameCn:'测试支给',nameEn:''}],
    wait:{questId:1,waitTicks:18000,tickRate:30,introFlagBeforeTimer:1},keyPrerequisite:true,appearances:[],translationSources:{name:{status:'reviewed',basis:'synthetic'}}},
}
