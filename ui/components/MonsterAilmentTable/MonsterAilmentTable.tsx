import type { MonsterAilment, MonsterTrap } from '../../../api/catalog/types'
import './MonsterAilmentTable.css'

export function MonsterAilmentTable({ ailments, traps, p2g = false }: {
  ailments: MonsterAilment[]; traps: MonsterTrap[]; p2g?: boolean
}) {
  const value = (input: number | null, applicable?: boolean | null) => input ?? (!p2g || applicable === false ? '不适用' : '未知')
  return <div className="monster-ailment-table">
    <section className="monster-ailment-table__section"><h3 className="monster-ailment-table__title">异常耐性</h3>
      <div className="monster-ailment-table__scroller"><table className="monster-ailment-table__table"><thead><tr>
        {['异常', '初始耐性', '耐性增量', '耐性上限', p2g ? '持续（秒）' : '持续', '伤害'].map(label => <th className="monster-ailment-table__heading" key={label}>{label}</th>)}
      </tr></thead><tbody>{ailments.map(row => <tr key={row.id}>
        <th className="monster-ailment-table__name">{row.nameCn}</th>
        {[row.toleranceInitial, row.toleranceIncrease, row.toleranceMax, row.duration, row.damage].map((number, index) => <td className="monster-ailment-table__data" key={index}>{value(number, row.applicable)}</td>)}
      </tr>)}</tbody></table></div>
    </section>
    <section className="monster-ailment-table__section"><h3 className="monster-ailment-table__title">陷阱 / 控制</h3>
      <div className="monster-ailment-table__scroller"><table className="monster-ailment-table__table"><thead><tr>
        {['类型', '有效', p2g ? '持续（秒）' : '通常持续', p2g ? '愤怒持续（秒）' : '愤怒持续', p2g ? '条件（日文）' : '疲劳持续'].map(label => <th className="monster-ailment-table__heading" key={label}>{label}</th>)}
      </tr></thead><tbody>{traps.map(row => <tr key={row.id}>
        <th className="monster-ailment-table__name">{row.nameCn}</th>
        <td className="monster-ailment-table__data">{row.isEffective == null ? '未知' : row.isEffective ? '有效' : '无效'}</td>
        <td className="monster-ailment-table__data">{value(row.duration, row.isEffective)}</td>
        <td className="monster-ailment-table__data">{value(row.durationEnraged, row.isEffective)}</td>
        {p2g ? <td className="monster-ailment-table__note">{row.noteJp || '—'}</td> : <td className="monster-ailment-table__data">{value(row.durationFatigued)}</td>}
      </tr>)}</tbody></table></div>
    </section>
  </div>
}
