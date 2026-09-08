import { useEffect, useRef } from 'react'
import type { MonsterSummary } from '../../../api/catalog/types'
import { MonsterListRow } from '../MonsterListRow/MonsterListRow'
import { MonsterSearchInput } from '../MonsterSearchInput/MonsterSearchInput'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import './MonsterSearchList.css'

export function MonsterSearchList({ monsters, selectedId, query, loading, error, includePlaceholders, onQueryChange, onPlaceholderChange, onReset, onSelect }: { monsters: MonsterSummary[]; selectedId?: number; query: string; loading: boolean; error?: string; includePlaceholders:boolean; onQueryChange: (value: string) => void; onPlaceholderChange:(value:boolean)=>void;onReset:()=>void; onSelect: (id: number) => void }) {
  const refs=useRef(new Map<number,HTMLButtonElement>())
  useEffect(()=>{if(selectedId==null)return;const selected=refs.current.get(selectedId);if(typeof selected?.scrollIntoView==='function')selected.scrollIntoView({block:'nearest'})},[selectedId])
  const move=(index:number,next:number)=>{const target=monsters[Math.max(0,Math.min(monsters.length-1,index+next))];if(target){onSelect(target.monsterId);requestAnimationFrame(()=>refs.current.get(target.monsterId)?.focus())}}
  return <aside className="monster-search-list" aria-label="怪物列表"><div className="monster-search-list__controls"><MonsterSearchInput value={query} onChange={onQueryChange}/><CatalogResetButton onReset={onReset}/></div><div className="monster-search-list__summary"><span>{loading?'更新中…':`${monsters.length} 个结果`}</span><label><input type="checkbox" checked={includePlaceholders} onChange={event=>onPlaceholderChange(event.target.checked)}/> 调试占位</label>{error&&<span role="alert">读取失败</span>}</div><div className="monster-search-list__rows" role="listbox" aria-label="怪物搜索结果">
    {error?<p className="monster-search-list__state">{error}</p>:!loading&&!monsters.length?<p className="monster-search-list__state">没有符合条件的怪物。</p>:monsters.map((monster,index)=><div role="option" aria-selected={monster.monsterId===selectedId} key={monster.monsterId} ref={(node)=>{if(node){const button=node.querySelector('button');if(button)refs.current.set(monster.monsterId,button)}else refs.current.delete(monster.monsterId)}}><MonsterListRow monster={monster} selected={monster.monsterId===selectedId} tabIndex={monster.monsterId===selectedId||selectedId==null&&index===0?0:-1} onSelect={()=>onSelect(monster.monsterId)} onKeyDown={(event)=>{if(event.key==='ArrowDown'){event.preventDefault();move(index,1)}else if(event.key==='ArrowUp'){event.preventDefault();move(index,-1)}else if(event.key==='Home'){event.preventDefault();move(index,-index)}else if(event.key==='End'){event.preventDefault();move(index,monsters.length-1-index)}}}/></div>)}
  </div></aside>
}
