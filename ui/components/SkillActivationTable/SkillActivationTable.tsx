import type { SkillActivation } from '../../../api/catalog/types'
import { SkillComponentList } from '../SkillComponentList/SkillComponentList'
import { DetailSection } from '../DetailSection/DetailSection'
import './SkillActivationTable.css'

const directionName = { positive: '正面', negative: '负面', special: '特殊' } as const

export function SkillActivationTable({ activations, onSelectSkill }: { activations: SkillActivation[]; onSelectSkill?: (id:number)=>void }) {
  return <DetailSection title="发动效果" meta={activations.length} className="skill-activation-table">
    {activations.length ? <div className="skill-activation-table__list">
      {activations.map((activation) => <article className="skill-activation-table__card" key={activation.activationKey}>
        <div className="skill-activation-table__threshold">
          <strong>{activation.threshold > 0 ? '+' : ''}{activation.threshold}</strong>
          <span data-direction={activation.direction}>{directionName[activation.direction]}</span>
        </div>
        <div className="skill-activation-table__names">
          <strong>{activation.nameCn}</strong>
          {activation.nameEn && <small>{activation.nameEn}</small>}
          {activation.nameJp && <small>{activation.nameJp}</small>}
        </div>
        <div className="skill-activation-table__descriptions">
          {activation.wikiDetail && <>
            <p><span>详细效果（Wiki）</span>{activation.wikiDetail.descriptionCn}</p>
            <p><span>资料来源 · {activation.wikiDetail.sourceVersion}</span>{activation.wikiDetail.sourceUrl}</p>
            {activation.wikiDetail.sourceVersion === 'MHXX' && <p><span>版本说明</span>引用 MHXX Wiki，非 GU 程序独立验证。</p>}
          </>}
          {activation.descriptionCn && <p><span>{activation.wikiDetail ? '原始中文说明' : '中文'}</span>{activation.descriptionCn}</p>}
          {activation.descriptionEn && <p><span>English</span>{activation.descriptionEn}</p>}
          {activation.descriptionJp && <p><span>日本語</span>{activation.descriptionJp}</p>}
          {!activation.wikiDetail && !activation.descriptionCn && !activation.descriptionEn && !activation.descriptionJp && <p className="skill-activation-table__empty-description">暂无说明</p>}
        </div>
        <div className="skill-activation-table__components"><span>复合效果</span>{activation.components.length ? <SkillComponentList components={activation.components} onSelectSkill={onSelectSkill}/> : <span className="skill-activation-table__no-components">无复合效果</span>}</div>
      </article>)}
    </div> : <p>没有发动效果。</p>}
  </DetailSection>
}
