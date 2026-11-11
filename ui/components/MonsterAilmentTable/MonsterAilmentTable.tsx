import type { MonsterAilment, MonsterTrap } from '../../../api/catalog/types'
import './MonsterAilmentTable.css'

export function MonsterAilmentTable({ ailments, traps, p2g = false, p3 = false }: {
  ailments: MonsterAilment[]; traps: MonsterTrap[]; p2g?: boolean; p3?: boolean
}) {
  const value = (input: number | null, applicable?: boolean | null) => input ?? ((!p2g && !p3) || applicable === false ? '不适用' : '未知')
  const damage = (row: MonsterAilment) => row.damage == null ? value(null, row.applicable) : row.p3?.damageUnit === 'per-interval'
    ? `${row.damage} / ${row.p3.damageIntervalSeconds} 秒` : row.p3?.damageUnit === 'total' ? `${row.damage}（总量）` : `${row.damage}（单位未注明）`
  return <div className="monster-ailment-table">
    <section className="monster-ailment-table__section"><h3 className="monster-ailment-table__title">异常耐性</h3>
      <div className="monster-ailment-table__scroller">{!ailments.length && <p className="monster-ailment-table__note">尚未收录异常耐性；不表示免疫。</p>}<table className="monster-ailment-table__table"><thead><tr>
        {['异常', '初始耐性', '耐性增量', '耐性上限', p2g || p3 ? '持续（秒）' : '持续', '伤害', ...(p3 ? ['衰减／条件'] : [])].map(label => <th className="monster-ailment-table__heading" key={label}>{label}</th>)}
      </tr></thead><tbody>{ailments.map(row => <tr key={row.id}>
        <th className="monster-ailment-table__name">{row.nameCn}</th>
        {[row.toleranceInitial, row.toleranceIncrease, row.toleranceMax, row.duration].map((number, index) => <td className="monster-ailment-table__data" key={index}>{value(number, row.applicable)}</td>)}
        <td className="monster-ailment-table__data">{p3 ? damage(row) : value(row.damage, row.applicable)}</td>
        {p3 && <td className="monster-ailment-table__note">{row.applicable === false ? '资料明确记载无效' : row.p3?.decayAmount != null && row.p3.decayIntervalSeconds != null ? `每 ${row.p3.decayIntervalSeconds} 秒减少 ${row.p3.decayAmount}` : '衰减未收录'}<details><summary>条件与来源</summary><p>{row.p3?.note}</p><p>{row.p3?.source.label}</p><p className="monster-ailment-table__original">{row.p3?.rawJp}</p></details></td>}
      </tr>)}</tbody></table></div>
    </section>
    <section className="monster-ailment-table__section"><h3 className="monster-ailment-table__title">陷阱 / 控制</h3>
      <div className="monster-ailment-table__scroller">{!traps.length && <p className="monster-ailment-table__note">尚未收录控制资料；不表示无效。</p>}<table className="monster-ailment-table__table"><thead><tr>
        {(p3 ? ['类型', '有效条件', '重复使用（秒）', '条件与来源'] : ['类型', '有效', p2g ? '持续（秒）' : '通常持续', p2g ? '愤怒持续（秒）' : '愤怒持续', p2g ? '条件（日文）' : '疲劳持续']).map(label => <th className="monster-ailment-table__heading" key={label}>{label}</th>)}
      </tr></thead><tbody>{traps.map(row => <tr key={row.id}>
        <th className="monster-ailment-table__name">{row.nameCn}</th>
        <td className="monster-ailment-table__data">{row.p3?.effect === 'conditional' ? '有条件' : row.isEffective == null ? '未知' : row.isEffective ? '有效' : '无效'}</td>
        {p3 ? <><td className="monster-ailment-table__note">{row.p3?.repetitions.length ? row.p3.repetitions.map(r => <div key={r.fromUse}>第 {r.fromUse} 次{r.onward ? '及以后' : ''}：<span className="monster-ailment-table__timing">{r.seconds} 秒</span>{r.fatiguedSeconds != null && <> · 疲劳 <span className="monster-ailment-table__timing">{r.fatiguedSeconds} 秒</span></>}{r.enragedSeconds != null && <> · 愤怒 <span className="monster-ailment-table__timing">{r.enragedSeconds} 秒</span></>}</div>) : row.isEffective === false ? '不适用' : '次数／持续时间未收录'}</td><td className="monster-ailment-table__note">{row.p3?.conditionCn}<details><summary>完整条件（日文）</summary><p className="monster-ailment-table__original">{row.p3?.conditionJp}</p><p>{row.p3?.source.label}</p></details></td></> : <><td className="monster-ailment-table__data">{value(row.duration, row.isEffective)}</td><td className="monster-ailment-table__data">{value(row.durationEnraged, row.isEffective)}</td>{p2g ? <td className="monster-ailment-table__note">{row.noteJp || '—'}</td> : <td className="monster-ailment-table__data">{value(row.durationFatigued)}</td>}</>}
      </tr>)}</tbody></table></div>
    </section>
  </div>
}
