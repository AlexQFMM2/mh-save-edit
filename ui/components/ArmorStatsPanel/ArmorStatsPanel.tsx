import type { CatalogArmorSummary } from '../../utils/catalogArmor'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { DetailSection } from '../DetailSection/DetailSection'
import { DetailStatGrid } from '../DetailStatGrid/DetailStatGrid'
import './ArmorStatsPanel.css'
const combat={both:'近战 / 远程',blademaster:'近战',gunner:'远程'},gender={both:'男女通用',male:'男性',female:'女性'}
const res=[['火','fireRes','fire'],['水','waterRes','water'],['雷','thunderRes','thunder'],['冰','iceRes','ice'],['龙','dragonRes','dragon']] as const
export function ArmorStatsPanel({armor}:{armor:CatalogArmorSummary}) {
  return <DetailSection title="属性" meta={`RARE ${armor.rarity}`} className="armor-stats-panel" ariaLabel="防具属性"><div className="armor-stats-panel__body">
    <DetailStatGrid variant="two-column" ariaLabel="防御力" items={[{label:'基础防御',value:armor.baseDefense},{label:'最大防御',value:armor.maxDefense}]}/>
    <section className="armor-stats-panel__resistances" aria-label="属性耐性"><h3 className="armor-stats-panel__label">属性耐性</h3><div className="armor-stats-panel__resistance-values">{res.map(([name,key,color])=><div className="armor-stats-panel__resistance" key={key}><span className="armor-stats-panel__label" aria-label={`${name}耐性`}><span aria-hidden="true">{name}</span><span className="sr-only">{name}耐性</span></span><strong className={`armor-stats-panel__value armor-stats-panel__value--${color}`}>{armor[key]}</strong></div>)}</div></section>
    <div className="armor-stats-panel__meta"><span>{combat[armor.combat]} · {gender[armor.gender]}</span><span className="armor-stats-panel__slots">孔位 <EquipmentSlotIndicator slots={armor.slots}/></span></div>
  </div></DetailSection>
}
