import type { P3SkillCharmSource } from '../../../api/catalog/p3SkillTypes'
import './P3SkillCharmSources.css'

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`
export function P3SkillCharmSources({ rows }: { rows: P3SkillCharmSource[] }) {
  const random = rows.filter(r => r.sourceKind === 'random-pool')
  const gifts = rows.filter(r => r.sourceKind === 'special-gift')
  return <div className="p3-skill-charm-sources">
    <p className="p3-skill-charm-sources__note">随机候选范围按技能位置列出；不能据此判断双技能与孔位的组合是否合法。</p>
    {random.length > 0 && <section aria-label="随机候选范围"><h3 className="p3-skill-charm-sources__title">随机候选范围</h3>{random.map(r => <div className="p3-skill-charm-sources__row" key={r.sourceKey}><span>{r.label} · 技能 {r.position}</span><strong className="p3-skill-charm-sources__data">{signed(r.minPoints)} ～ {signed(r.maxPoints)}</strong></div>)}</section>}
    {gifts.length > 0 && <section aria-label="特殊赠送"><h3 className="p3-skill-charm-sources__title">特殊赠送</h3>{gifts.map(r => <div className="p3-skill-charm-sources__gift" key={r.sourceKey}><div className="p3-skill-charm-sources__row"><span>{r.label} · {r.nameJp}</span><strong className="p3-skill-charm-sources__data">{signed(r.minPoints)} · {r.slots} 孔</strong></div><p className="p3-skill-charm-sources__note">{r.note}</p></div>)}</section>}
    {!rows.length && <p className="p3-skill-charm-sources__note">当前资料没有该技能的候选或赠品记录；这不代表不存在合法护石。</p>}
  </div>
}
