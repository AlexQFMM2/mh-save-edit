import type { ArmorDetail } from '../../../api/catalog/types'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { ArmorSkillList } from '../ArmorSkillList/ArmorSkillList'
import './ArmorStatsPanel.css'

const combat={both:'近战 / 远程',blademaster:'近战',gunner:'远程'};const gender={both:'男女通用',male:'男性',female:'女性'}
const resistanceTypes = [
  ['火', 'fireRes', 'is-fire'],
  ['水', 'waterRes', 'is-water'],
  ['雷', 'thunderRes', 'is-thunder'],
  ['冰', 'iceRes', 'is-ice'],
  ['龙', 'dragonRes', 'is-dragon'],
] as const

export function ArmorStatsPanel({ armor, onSelectSkill }: { armor: ArmorDetail; onSelectSkill?: (skillId:number)=>void }) {
  return <section className="armor-stats-panel">
    <header><span>属性</span><strong>RARE {armor.rarity}</strong></header>
    <div className="armor-stats-panel__defense" aria-label="防御力">
      <Stat label="基础防御" value={armor.baseDefense}/>
      <Stat label="最大防御" value={armor.maxDefense}/>
    </div>
    <section className="armor-stats-panel__resistances" aria-label="属性耐性">
      <h3>属性耐性</h3>
      <div className="armor-stats-panel__resistance-values">
        {resistanceTypes.map(([label, key, className]) => <div className={className} key={key}>
          <span aria-label={`${label}耐性`}><span aria-hidden="true">{label}</span><span className="sr-only">{label}耐性</span></span><strong>{armor[key]}</strong>
        </div>)}
      </div>
    </section>
    <ArmorSkillList skills={armor.skills} onSelectSkill={onSelectSkill}/>
    <div className="armor-stats-panel__meta"><span>{combat[armor.combat]} · {gender[armor.gender]}</span><span>孔位 <EquipmentSlotIndicator slots={armor.slots}/></span></div>
  </section>
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>
}
