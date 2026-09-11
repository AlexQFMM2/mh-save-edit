import type { PalicoTypeDetail } from '../../../api/catalog/types'
import './PalicoTypeDetailPanel.css'

export function PalicoTypeDetailPanel({detail,loading,error,onSelectMove}:{detail:PalicoTypeDetail|null;loading:boolean;error?:string;onSelectMove:(id:number)=>void}) {
  if (!detail) return <section className="palico-type-detail-panel palico-type-detail-panel--state">{error ?? (loading ? '正在读取倾向资料…' : '请选择一种支援倾向。')}</section>
  return <section className="palico-type-detail-panel" aria-label={`${detail.nameCn}详情`}>
    <header className="palico-type-detail-panel__header"><div><small className="palico-type-detail-panel__eyebrow">支援倾向 #{detail.typeId}</small><h2 className="palico-type-detail-panel__title">{detail.nameCn}</h2><p className="palico-type-detail-panel__names">{detail.nameEn} · {detail.nameJp}</p></div>{loading && <span role="status">正在更新…</span>}</header>
    <div className="palico-type-detail-panel__scroll">
      <section className="palico-type-detail-panel__section"><h3 className="palico-type-detail-panel__section-title">倾向说明</h3><p className="palico-type-detail-panel__paragraph">{detail.descriptionCn || '暂无简中说明。'}</p>{detail.descriptionEn && <p className="palico-type-detail-panel__paragraph palico-type-detail-panel__secondary">{detail.descriptionEn}</p>}</section>
      <section className="palico-type-detail-panel__section"><h3 className="palico-type-detail-panel__section-title">固定支援行动</h3><div className="palico-type-detail-panel__relations">{detail.supportMoves.map(move=><button className="palico-type-detail-panel__relation" type="button" key={move.supportMoveId} onClick={()=>onSelectMove(move.supportMoveId)}><span>{move.nameCn}</span><small className="palico-type-detail-panel__relation-meta">{move.nameEn} · {move.relationKind==='innate'?'固有':'关联'}</small></button>)}</div></section>
      <section className="palico-type-detail-panel__section"><h3 className="palico-type-detail-panel__section-title">固有随从技能</h3><div className="palico-type-detail-panel__readonly">{detail.skills.map(skill=><span className="palico-type-detail-panel__readonly-tag" key={skill.palicoSkillId}>{skill.nameCn}</span>)}</div></section>
    </div>
  </section>
}
