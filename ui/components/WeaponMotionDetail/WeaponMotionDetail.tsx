import type { BowWeaponMotion, BowgunWeaponMotion, MeleeWeaponMotion } from '../../../api/catalog/types'
import './WeaponMotionDetail.css'

type Motion=MeleeWeaponMotion|BowgunWeaponMotion|BowWeaponMotion
const evidenceLabels:Record<string,string>={verified:'已验证',native:'原生资源',nativeCrosschecked:'原生交叉核验','secondary-crosschecked':'二级来源交叉核验'}
export function WeaponMotionDetail({motion,onSelectHunterArt}:{motion:Motion;onSelectHunterArt:(id:number)=>void}){return <div className="weapon-motion-detail">
  <div className="weapon-motion-detail__heading"><div className="weapon-motion-detail__title"><strong className="weapon-motion-detail__name">{motion.nameCn}</strong><span className="weapon-motion-detail__secondary-name">{motion.nameEn}</span></div>{motion.hunterArtId!=null&&<button className="weapon-motion-detail__hunter-art-button" type="button" onClick={()=>onSelectHunterArt(motion.hunterArtId as number)}>查看狩技资料</button>}</div>
  <div className="weapon-motion-detail__variants">
    {motion.variants.map(variant=><section className="weapon-motion-detail__variant" key={variant.variantId}>
      <header className="weapon-motion-detail__variant-heading"><strong className="weapon-motion-detail__variant-name">{variant.labelCn}</strong>{variant.conditionCn&&<span className="weapon-motion-detail__condition">{variant.conditionCn}</span>}<b className="weapon-motion-detail__total">合计 {variant.motionValueTotal??'—'}</b></header>
      <div className="weapon-motion-detail__hits" role="list" aria-label={`${variant.labelCn}各 Hit`}>
        {variant.hits.map(hit=><span className="weapon-motion-detail__hit" role="listitem" key={hit.sequence}>{variant.hits.length===1&&motion.hitCountMax>1?`${motion.hitCountMax} Hit 合计`:`Hit ${hit.sequence}`}<b className="weapon-motion-detail__hit-value">{hit.motionValue??'非伤害'}</b>{hit.attackType&&<small className="weapon-motion-detail__hit-extra">攻击系 {hit.attackType}</small>}{hit.sharpnessModifier!=null&&<small className="weapon-motion-detail__hit-extra">斩味补正 {hit.sharpnessModifier}</small>}{hit.stun!=null&&<small className="weapon-motion-detail__hit-extra">气绝 {hit.stun}</small>}{hit.exhaust!=null&&<small className="weapon-motion-detail__hit-extra">减气 {hit.exhaust}</small>}</span>)}
      </div>
    </section>)}
  </div>
  {motion.notes&&<p className="weapon-motion-detail__notes">{motion.notes}</p>}
  <small className="weapon-motion-detail__source">证据状态：{evidenceLabels[motion.evidenceStatus]??motion.evidenceStatus} · 动作键 {motion.nativeActionId}</small>
</div>}
