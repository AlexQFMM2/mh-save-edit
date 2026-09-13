import type { SkillTalismanRelation } from '../../../api/catalog/types'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import './SkillTalismanRelationList.css'

const status = { exact: '精确组合', rule: '规则范围', unknown: '待确认' } as const
const points = (value: number) => `${value > 0 ? '+' : ''}${value}`

export function SkillTalismanRelationList({ rows }: { rows: SkillTalismanRelation[] }) {
  return rows.length ? <div className="skill-talisman-relation-list">
    {rows.map(row => <article className="skill-talisman-relation-list__row" key={row.rangeKey}>
      <div className="skill-talisman-relation-list__heading"><strong>{row.talismanNameCn}</strong><small>{row.talismanNameEn}</small></div>
      <dl className="skill-talisman-relation-list__facts">
        <div><dt>技能位</dt><dd>{row.position}</dd></div>
        <div><dt>技能系</dt><dd>{row.skillNameCn}</dd></div>
        <div><dt>合法点数</dt><dd>{row.minPoints === row.maxPoints ? points(row.minPoints) : `${points(row.minPoints)}～${points(row.maxPoints)}`}</dd></div>
        <div><dt>孔位</dt><dd>{row.slotCount == null ? row.maxSlots == null ? '未确认' : <span className="skill-talisman-relation-list__slot-value">上限 <EquipmentSlotIndicator slots={row.maxSlots} /></span> : <EquipmentSlotIndicator slots={row.slotCount} />}</dd></div>
        <div><dt>证据</dt><dd title={row.source}>{status[row.rangeStatus]}</dd></div>
      </dl>
    </article>)}
  </div> : <p className="skill-talisman-relation-list__empty">该技能系没有合法护石范围。</p>
}
