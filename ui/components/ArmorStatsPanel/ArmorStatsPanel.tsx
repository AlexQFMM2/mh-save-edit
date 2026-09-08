import type { ArmorDetail } from '../../../api/catalog/types'
import { EquipmentSlotIndicator } from '../EquipmentSlotIndicator/EquipmentSlotIndicator'
import { ArmorSkillList } from '../ArmorSkillList/ArmorSkillList'
import './ArmorStatsPanel.css'

const combat={both:'近战 / 远程',blademaster:'近战',gunner:'远程'};const gender={both:'男女通用',male:'男性',female:'女性'}
export function ArmorStatsPanel({ armor, onSelectSkill }: { armor: ArmorDetail; onSelectSkill?: (skillId:number)=>void }) {const stats=[['基础防御',armor.baseDefense],['最大防御',armor.maxDefense],['火耐性',armor.fireRes],['水耐性',armor.waterRes],['雷耐性',armor.thunderRes],['冰耐性',armor.iceRes],['龙耐性',armor.dragonRes]];return <section className="armor-stats-panel"><header><span>属性</span><strong>RARE {armor.rarity}</strong></header><dl>{stats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div><dt>孔位</dt><dd><EquipmentSlotIndicator slots={armor.slots}/></dd></div></dl><p>{combat[armor.combat]} · {gender[armor.gender]}</p><ArmorSkillList skills={armor.skills} onSelectSkill={onSelectSkill}/></section>}
