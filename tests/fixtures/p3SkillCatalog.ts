import { readFileSync } from 'node:fs'
import type { P3SkillArmorDetail, P3SkillCharmSource } from '../../api/catalog/p3SkillTypes'
import { p3ItemFixture } from './p3ItemCatalog'

// Entirely synthetic records; native IDs here are test identities, not extracted data.
export function p3SkillFixture(file = ':memory:') {
  const db = p3ItemFixture(file)
  db.exec(readFileSync('tools/mhp3/skill_schema.sql', 'utf8'))
  db.prepare('INSERT INTO meta VALUES(?,?)').run('skill_schema', 'mhp3-skills-v1')
  for (const row of db.prepare('SELECT item_id,decoration_json FROM catalog_items WHERE decoration_json IS NOT NULL').all() as {item_id:number;decoration_json:string}[]) {
    const d = JSON.parse(row.decoration_json)
    for (const s of d.skills) if (s.id === 1) s.id = 3
    db.prepare('UPDATE catalog_items SET decoration_json=? WHERE item_id=?').run(JSON.stringify(d), row.item_id)
  }
  for (const [id, name, en, threshold] of [[1, '复制测试', 'Copy Test', 0], [2, '负向技能', 'Negative', -10], [3, '测试技能', 'Test', 10]] as const) {
    const skill = { skillId:id, nameCn:name, nameJp:`テスト${id}`, nameEn:en, aliases:[`测试别称${id}`], descriptionCn:`系统测试说明${id}`, descriptionJp:'テスト説明', descriptionEn:null,
      specialRule: id===1 ? {descriptionCn:'测试复制含胴部装饰品',descriptionJp:'テスト特殊'} : null,
      activations: threshold ? [{activationKey:`test:${id}`,dexActivationId:null,threshold,direction:threshold>0?'positive':'negative',nameCn:`测试发动${id}`,nameJp:'テスト発動',nameEn:`Test effect ${id}`,descriptionCn:`独立测试说明${id}`,descriptionJp:'テスト説明',descriptionEn:'',components:[],componentsStatus:'unreviewed'}] : [] }
    db.prepare('INSERT INTO p3_skills VALUES(?,?)').run(id,JSON.stringify(skill))
  }
  for (const nativeId of [1,2]) {
    const armor:P3SkillArmorDetail={gameId:'mhp3',armorKey:`mhp3:armor:4:${nativeId}`,nativeType:4,nativeId,nameCn:nativeId===1?'合成防具':'',nameJp:'テスト防具',nameEn:'',part:'head',rarity:1,slots:nativeId,iconPath:'/assets/test.png',acquisitionStatus:'not-audited',referenceCoverage:nativeId===1?'matching-independent-record-values':'native-only-acquisition-unverified',skills:nativeId===1?[{skillId:2,points:-2,kind:'signed-points',nameCn:'负向技能',nameJp:'テスト2',nameEn:'Negative'},{skillId:3,points:3,kind:'signed-points',nameCn:'测试技能',nameJp:'テスト3',nameEn:'Test'}]:[{skillId:1,points:1,kind:'torso-copy-marker',nameCn:'复制测试',nameJp:'テスト1',nameEn:'Copy Test'},{skillId:2,points:1,kind:'signed-points',nameCn:'负向技能',nameJp:'テスト2',nameEn:'Negative'}]}
    db.prepare('INSERT INTO p3_skill_armors VALUES(?,?)').run(armor.armorKey,JSON.stringify(armor))
    for(const s of armor.skills)db.prepare('INSERT INTO p3_armor_skill_points VALUES(?,?,?,?)').run(armor.armorKey,s.skillId,s.points,s.kind)
  }
  for(const sourceKind of ['random-pool','special-gift'] as const) {
    const r:P3SkillCharmSource={sourceKey:`test:${sourceKind}`,sourceKind,skillId:2,label:sourceKind==='random-pool'?'合成候选护符':'合成赠品',nameJp:'テスト護符',position:'A',minPoints:sourceKind==='random-pool'?-2:10,maxPoints:sourceKind==='random-pool'?4:10,slots:sourceKind==='random-pool'?null:0,note:'测试触发条件未确认'}
    db.prepare('INSERT INTO p3_skill_charm_sources VALUES(?,?,?)').run(r.sourceKey,2,JSON.stringify(r))
  }
  return db
}
