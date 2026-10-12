// Synthetic skills, equipment and rules only; no private game data.
import fs from 'node:fs'
import path from 'node:path'
import { createQuestFixture } from './p2gQuestCatalog.mjs'
import { buildQuestCatalog } from '../../tools/build_mhp2g_quest_catalog.mjs'
import { sha256 } from '../../tools/mhp2g/sources.mjs'
export function createSkillFixture(dir) {
  const quest=createQuestFixture(dir);buildQuestCatalog(quest)
  const base=path.join(quest.output,'mhp2g.sqlite')
  const activation={activationKey:'mhp2g:a1',nativeTextOrdinal:1,nameCn:'测试发动',nameJp:'テスト発動',nameSource:'synthetic',threshold:10,direction:'positive',descriptionCn:'合成规则提高数值。',descriptionJp:'合成テスト効果',sourceKey:'test:1',components:[]}
  const skills=[{skillId:1,nameCn:'甲测试系',nameJp:'テスト系甲',nameSource:'synthetic',activations:[activation,{...activation,activationKey:'mhp2g:a2',nativeTextOrdinal:2,nameCn:'测试减弱',nameJp:'テスト減少',threshold:-10,direction:'negative'}],specialRule:null},
    {skillId:2,nameCn:'乙复合系',nameJp:'テスト複合',nameSource:'synthetic',activations:[{...activation,activationKey:'mhp2g:a3',nativeTextOrdinal:3,nameCn:'测试复合发动',nameJp:'テスト複合発動',components:[{activationKey:'mhp2g:a1',skillId:1,nameCn:'测试发动',nameJp:'テスト発動',direction:'positive'}]}],specialRule:null},
    {skillId:3,nameCn:'丙特殊系',nameJp:'テスト特殊',nameSource:'synthetic',activations:[],specialRule:{descriptionCn:'合成特殊规则，不使用阈值。',descriptionJp:'合成特殊ルール'}}]
  const equipment=[{equipmentKey:'item:1',kind:'decoration',sourceKey:'decoration_items:0',nameCn:'测试珠',nameJp:'テスト珠',nameSource:'synthetic',slots:1,part:null,iconPath:null,itemId:1,isPlaceholder:false,skills:[{skillId:1,points:2},{skillId:2,points:-1}],recipes:[{recipeKey:'test:recipe:1',materials:[{itemId:2,quantity:2}]},{recipeKey:'test:recipe:2',materials:[{itemId:1,quantity:1}]}]},
    {equipmentKey:'armor_head:1',kind:'armor',sourceKey:'armor_head:1',nameCn:'测试头盔',nameJp:'テスト兜',nameSource:'synthetic',slots:2,part:'head',iconPath:null,itemId:null,isPlaceholder:false,skills:[{skillId:1,points:-2},{skillId:3,points:1}],recipes:[]}]
  const snapshot={schema:'mhp2g-skill-evidence-v1',inputs:{'base.sqlite':sha256(base)},sourceUrl:'https://example.invalid/p2g-skills',skills,equipment,excludedNativeTextOrdinals:[0,4]}
  const evidence=path.join(dir,'skill-evidence.json'),save=()=>fs.writeFileSync(evidence,JSON.stringify(snapshot));save()
  return {base,evidence,output:path.join(dir,'skills'),snapshot,save}
}
