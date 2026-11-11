import type { P3MonsterData } from '../../../api/catalog/p3MonsterTypes'
import './P3MonsterContext.css'
const domains = { weakness: '肉质', ailments: '异常耐性', traps: '陷阱／控制', drops: '掉落', appearances: '出没观察' } as const
const coverageLabels = { collected: '已收录', partial: '部分收录', 'not-collected': '尚未收录', 'checked-empty': '已核查无资料' }
export function P3MonsterContext({ data }: { data: P3MonsterData }) {
  return <details className="p3-monster-context"><summary className="p3-monster-context__toggle">图鉴说明 · 译名与资料覆盖</summary><div className="p3-monster-context__body">
    <p className="p3-monster-context__description">{data.descriptionCn ?? '此扩展记录没有独立的游戏图鉴说明。'}</p>
    <p>名称：{data.nameSource}</p>
    {data.descriptionJp && <details><summary>日文原文</summary><p className="p3-monster-context__original">{data.descriptionJp}</p><p>{data.descriptionSource}</p></details>}
    {data.notes.map(note => <p key={note}>{note}</p>)}
    <dl className="p3-monster-context__coverage">{Object.entries(domains).map(([key, label]) => { const coverage = data.coverage[key as keyof typeof domains]; return <div key={key}><dt>{label} · {coverageLabels[coverage.status]}</dt><dd>{coverage.note}</dd></div> })}</dl>
    {!!data.noRewardRoutes.length && <p>已核查无奖励：{data.noRewardRoutes.map(r => r.methodJp).filter((v, i, a) => a.indexOf(v) === i).join('、')}（独立资料明确记载）。</p>}
    <details><summary>条件与来源原文</summary>{data.referenceNotes.map((n, i) => <p className="p3-monster-context__original" key={i}><strong>{n.section}</strong><br />{n.textJp}</p>)}{data.combatReference?.map((r, i) => <p key={i}>{r.stateJp} · 攻击 {r.attackMultiplierJp} · 全体防御率 {r.defenseMultiplierJp} · {r.noteJp}</p>)}{data.sourceVersions.map(s => <p key={s.sha256}>{s.label}：{s.url}</p>)}</details>
  </div></details>
}
