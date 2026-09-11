import { useRef } from 'react'
import './PalicoEntryList.css'

type Entry={id:number;nameCn:string;nameEn:string;meta?:string}
export function PalicoEntryList({entries,selectedId,loading,error,label,onSelect}:{entries:Entry[];selectedId?:number;loading:boolean;error?:string;label:string;onSelect:(id:number)=>void}){
  const refs=useRef(new Map<number,HTMLButtonElement>())
  const move=(index:number,step:number)=>{if(!entries.length)return;const next=entries[(index+step+entries.length)%entries.length];onSelect(next.id);requestAnimationFrame(()=>refs.current.get(next.id)?.focus())}
  if(loading&&!entries.length)return <div className="palico-entry-list__state" role="status">正在读取{label}…</div>
  if(error&&!entries.length)return <div className="palico-entry-list__state palico-entry-list__state--error" role="alert">{error}</div>
  if(!entries.length)return <div className="palico-entry-list__state">没有符合条件的{label}。</div>
  return <div className="palico-entry-list" role="listbox" aria-label={label}>{entries.map((entry,index)=><button ref={node=>{if(node)refs.current.set(entry.id,node);else refs.current.delete(entry.id)}} className={`palico-entry-list__row${selectedId===entry.id?' palico-entry-list__row--selected':''}`} type="button" role="option" aria-selected={selectedId===entry.id} tabIndex={selectedId===entry.id||selectedId==null&&index===0?0:-1} key={entry.id} onClick={()=>onSelect(entry.id)} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();move(index,1)}else if(event.key==='ArrowUp'){event.preventDefault();move(index,-1)}else if(event.key==='Home'){event.preventDefault();onSelect(entries[0].id);requestAnimationFrame(()=>refs.current.get(entries[0].id)?.focus())}else if(event.key==='End'){event.preventDefault();const last=entries.at(-1)!;onSelect(last.id);requestAnimationFrame(()=>refs.current.get(last.id)?.focus())}}}><span className="palico-entry-list__identity"><strong className="palico-entry-list__primary-name">{entry.nameCn}</strong><small className="palico-entry-list__secondary-name">{entry.nameEn}</small></span>{entry.meta&&<span className="palico-entry-list__meta">{entry.meta}</span>}</button>)}</div>
}
