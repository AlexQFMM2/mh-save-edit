import type { WeaponStyleId } from '../../../api/catalog/types'
import './WeaponStyleBadgeList.css'

const labels:Record<WeaponStyleId,string>={guild:'公会',striker:'强袭',aerial:'空战',adept:'武士道',alchemy:'炼金',valor:'勇气'}
const all=Object.keys(labels) as WeaponStyleId[]

export function WeaponStyleBadgeList({styles,compact=false,asCells=false}:{styles:WeaponStyleId[];compact?:boolean;asCells?:boolean}){
  if(asCells)return <>{all.map(style=><td key={style} className={`weapon-style-badge-list__cell${styles.includes(style)?' weapon-style-badge-list__cell--available':''}`} title={`${labels[style]}：${styles.includes(style)?'可用':'不可用'}`} aria-label={`${labels[style]}${styles.includes(style)?'可用':'不可用'}`}>{styles.includes(style)?'●':'—'}</td>)}</>
  return <div className={`weapon-style-badge-list${compact?' weapon-style-badge-list--compact':''}`} aria-label={`可用风格：${styles.map(style=>labels[style]).join('、')}`}>
    {all.map(style=><span key={style} className={`weapon-style-badge-list__badge${styles.includes(style)?' weapon-style-badge-list__badge--available':''}`} title={`${labels[style]}：${styles.includes(style)?'可用':'不可用'}`}>{labels[style]}</span>)}
  </div>
}
