import './PalicoSharpnessLevel.css'
const names={2:'橙',3:'黄',4:'绿',5:'蓝',6:'白',7:'紫'} as const
export function PalicoSharpnessLevel({value}:{value:2|3|4|5|6|7}){return <span className="palico-sharpness-level" role="img" aria-label={`斩味等级：${names[value]}`}><span className={`palico-sharpness-level__swatch palico-sharpness-level__swatch--${value}`} aria-hidden="true"/><span>{names[value]}</span></span>}
