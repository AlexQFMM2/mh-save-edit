import type { SkillCatalogTab } from '../../../api/catalog/types'
import './SkillSourceTabs.css'
const tabs: { id: SkillCatalogTab; label: string }[] = [{ id: 'armor', label: '相关防具' }, { id: 'decoration', label: '相关装饰品' }, { id: 'talisman', label: '相关护石' }]
export function SkillSourceTabs({ value, counts, onChange, includeTalismans=true, idPrefix='skill-source' }: { value: SkillCatalogTab; counts: Record<SkillCatalogTab, number>; onChange: (tab: SkillCatalogTab) => void; includeTalismans?:boolean; idPrefix?:string }) {
  const visible=tabs.filter(tab=>includeTalismans||tab.id!=='talisman')
  const move=(index:number,offset:number)=>{const next=visible[(index+offset+visible.length)%visible.length];onChange(next.id);requestAnimationFrame(()=>document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus())}
  return <div className="skill-source-tabs" role="tablist" aria-label="技能来源">{visible.map((tab,index)=><button id={`${idPrefix}-tab-${tab.id}`} aria-controls={`${idPrefix}-panel`} role="tab" aria-selected={value===tab.id} tabIndex={value===tab.id?0:-1} key={tab.id} type="button" onClick={()=>onChange(tab.id)} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();move(index,1)}else if(event.key==='ArrowLeft'){event.preventDefault();move(index,-1)}}}>{tab.label}<span>{counts[tab.id]}</span></button>)}</div>
}
