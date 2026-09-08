import { useId, useRef } from 'react'
import type { MonsterCatalogTab } from '../../../api/catalog/types'
import './MonsterDetailTabs.css'

const tabs:[MonsterCatalogTab,string][]=[['weakness','肉质'],['ailments','异常耐性'],['drops','掉落物'],['quests','出没任务']]
export function MonsterDetailTabs({ value, panelId, onChange }: { value: MonsterCatalogTab; panelId:string; onChange: (tab: MonsterCatalogTab) => void }) {
  const prefix=useId();const refs=useRef(new Map<MonsterCatalogTab,HTMLButtonElement>())
  const select=(index:number)=>{const [tab]=tabs[(index+tabs.length)%tabs.length];onChange(tab);requestAnimationFrame(()=>refs.current.get(tab)?.focus())}
  return <div className="monster-detail-tabs" role="tablist" aria-label="怪物资料分类">{tabs.map(([tab,label],index)=><button key={tab} ref={node=>{if(node)refs.current.set(tab,node);else refs.current.delete(tab)}} id={`${prefix}-${tab}`} type="button" role="tab" aria-selected={value===tab} aria-controls={panelId} tabIndex={value===tab?0:-1} onClick={()=>onChange(tab)} onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();select(index+1)}else if(event.key==='ArrowLeft'){event.preventDefault();select(index-1)}else if(event.key==='Home'){event.preventDefault();select(0)}else if(event.key==='End'){event.preventDefault();select(tabs.length-1)}}}>{label}</button>)}</div>
}
