import type { P2gQuestData } from '../../../api/catalog/p2gQuestTypes'
import './P2gQuestIndividuals.css'
const labels: Record<string,string> = {区分:'类别',難度:'难度',種別:'类型',サイズ倍率:'尺寸倍率',体力:'体力',攻撃力倍率:'攻击力倍率',全体防御率:'全体防御率',備考:'备注'}
export function P2gQuestIndividuals({ data, onSelectMonster }: { data: P2gQuestData; onSelectMonster: (id: number) => void }) {
  if (!data.appearances.length) return null
  return <details className="p2g-quest-individuals"><summary>Wiki 个体数值</summary>{data.appearances.map((row,index) => <div className="p2g-quest-individuals__entry" key={index}>
    <button type="button" className="p2g-quest-individuals__link" onClick={() => onSelectMonster(row.monster.monsterId)}>{row.monster.nameCn}</button>
    <dl className="p2g-quest-individuals__fields">{row.fields.map((field,i) => <div className="p2g-quest-individuals__field" key={i}><dt>{labels[field.label.replace(/\s/g,'')] ?? field.label}</dt><dd className="p2g-quest-individuals__data">{field.value || '未收录'}</dd></div>)}</dl>
    <p className="p2g-quest-individuals__note">{row.sourceNote}</p>
  </div>)}</details>
}
