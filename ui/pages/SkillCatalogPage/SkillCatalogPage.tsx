import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { SkillCatalogFilters, SkillCatalogTab, SkillDetail, SkillSummary } from '../../../api/catalog/types'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { ArmorDetailDrawer } from '../../components/ArmorDetailDrawer/ArmorDetailDrawer'
import { DecorationDetailDrawer } from '../../components/DecorationDetailDrawer/DecorationDetailDrawer'
import { SkillDetailDrawer } from '../../components/SkillDetailDrawer/SkillDetailDrawer'
import { P2gSkillEquipmentDrawer } from '../../components/P2gSkillEquipmentDrawer/P2gSkillEquipmentDrawer'
import { SkillCatalogToolbar } from '../../components/SkillCatalogToolbar/SkillCatalogToolbar'
import { SkillDetailPanel } from '../../components/SkillDetailPanel/SkillDetailPanel'
import { SkillSearchList } from '../../components/SkillSearchList/SkillSearchList'
import './SkillCatalogPage.css'

type Drawer = {kind:'armor'|'decoration'|'skill';id:number}|null
const tabs: SkillCatalogTab[] = ['armor', 'decoration', 'talisman']
export function SkillCatalogPage() {
  const {game}=useOutletContext<WorkspaceOutletContext>(),[params,setParams]=useSearchParams(),isP2g=game.id==='mhp2g'
  const query=params.get('q')??'',[queryInput,setQueryInput]=useState(query),skillId=numberParam(params.get('skill')),targetSkillId=numberParam(params.get('target'))
  const requestedTab=params.get('tab') as SkillCatalogTab,tab=tabs.includes(requestedTab)&&(!isP2g||requestedTab!=='talisman')?requestedTab:'armor'
  const direction=['positive','negative','special'].includes(params.get('direction')??'')?params.get('direction') as SkillCatalogFilters['direction']:undefined
  const requestedSource=params.get('source'),source=['armor','decoration',...(isP2g?[]:['talisman'])].includes(requestedSource??'')?requestedSource as NonNullable<SkillCatalogFilters['source']>:'all'
  const sort=['name','activationCount'].includes(params.get('sort')??'')?params.get('sort') as NonNullable<SkillCatalogFilters['sort']>:'skillId'
  const includePlaceholders=params.get('debug')==='1',page=numberParam(params.get('page'))||1,equipmentKey=isP2g?params.get('equipment'):null
  const [items,setItems]=useState<SkillSummary[]>([]),[detail,setDetail]=useState<SkillDetail|null>(null),[meta,setMeta]=useState({pageSize:100,total:0,hasNext:false})
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState<string>(),[detailError,setDetailError]=useState<string>(),[drawer,setDrawer]=useState<Drawer>(null)
  const update=useCallback((changes:Record<string,string|number|undefined>)=>setParams(current=>{const next=new URLSearchParams(current);Object.entries(changes).forEach(([key,value])=>value==null||value===''?next.delete(key):next.set(key,String(value)));return next}),[setParams])
  // Selection and detail tabs must not restart the list query or overwrite newer navigation.
  const selectionRef=useRef({skillId,update})
  useLayoutEffect(()=>{selectionRef.current={skillId,update}},[skillId,update])
  const closeEquipment=useCallback(()=>update({equipment:undefined}),[update]),closeDrawer=useCallback(()=>setDrawer(null),[])
  const reset=useCallback(()=>{setQueryInput('');setDrawer(null);setParams({})},[setParams])
  useEffect(()=>setQueryInput(query),[query])
  useEffect(()=>{if(queryInput===query)return;const timer=window.setTimeout(()=>update({q:queryInput||undefined,target:undefined,skill:undefined,page:undefined,equipment:undefined}),280);return()=>window.clearTimeout(timer)},[queryInput,query,update])
  useEffect(()=>{setDrawer(null)},[game.id,equipmentKey])
  useEffect(()=>{
    let active=true;setLoading(true);setError(undefined)
    const api=window.mhSaveEditor?.catalog
    if(!api){setError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setLoading(false);return}
    void api.searchSkills({gameId:game.id,targetSkillId,query,direction,source,includePlaceholders,sort,page,pageSize:100}).then(result=>{
      if(!active)return
      setItems(result.items);setMeta({pageSize:result.pageSize,total:result.total,hasNext:result.hasNext})
      const selection=selectionRef.current
      if(selection.skillId==null&&result.items[0])selection.update({skill:result.items[0].skillId})
    }).catch(cause=>{if(active){setItems([]);setError(cause instanceof Error?cause.message:'技能列表读取失败')}}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[game.id,targetSkillId,query,direction,source,includePlaceholders,sort,page])
  useEffect(()=>{
    let active=true;setDetail(null);setDetailError(undefined)
    if(skillId==null){setDetailLoading(false);return}
    setDetailLoading(true);const api=window.mhSaveEditor?.catalog
    if(!api){setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setDetailLoading(false);return}
    void api.getSkill({gameId:game.id,skillId}).then(value=>{if(active)setDetail(value)}).catch(cause=>{if(active)setDetailError(cause instanceof Error?cause.message:'技能详情读取失败')}).finally(()=>{if(active)setDetailLoading(false)})
    return()=>{active=false}
  },[game.id,skillId])
  const selected=items.some(item=>item.skillId===skillId)?skillId:undefined
  const open=(kind:NonNullable<Drawer>['kind'],id:number)=>{if(equipmentKey)closeEquipment();setDrawer({kind,id})}
  return <div className="skill-catalog-page"><SkillCatalogToolbar query={queryInput} direction={direction} source={source} sort={sort} includePlaceholders={includePlaceholders} includeTalismans={!isP2g} onQueryChange={setQueryInput} onChange={(key,value)=>{setDrawer(null);update({[key]:value,target:undefined,skill:undefined,page:undefined,equipment:undefined})}} onReset={reset}/>
    <div className="skill-catalog-page__layout"><SkillSearchList items={items} selectedId={selected} loading={loading} error={error} page={page} pageSize={meta.pageSize} total={meta.total} hasNext={meta.hasNext} onSelect={id=>update({skill:id})} onPageChange={next=>update({page:next,skill:undefined})}/><SkillDetailPanel skill={detail} loading={detailLoading} error={detailError} tab={tab} onTabChange={value=>update({tab:value})} onSelectDecoration={value=>open('decoration',value.saveId)} onSelectArmor={value=>open('armor',value.dexId)} onSelectSkill={id=>open('skill',id)} onSelectP2gEquipment={value=>{setDrawer(null);update({equipment:value.equipmentKey})}}/></div>
    {game.id !== 'mhp2g'&&<><DecorationDetailDrawer gameId={game.id} decorationSaveId={drawer?.kind==='decoration'?drawer.id:null} onClose={closeDrawer}/><ArmorDetailDrawer gameId={game.id} armorDexId={drawer?.kind==='armor'?drawer.id:null} onClose={closeDrawer}/></>}
    <SkillDetailDrawer gameId={game.id} skillId={drawer?.kind==='skill'?drawer.id:null} onClose={closeDrawer}/><P2gSkillEquipmentDrawer equipmentKey={equipmentKey} onClose={closeEquipment}/>
  </div>
}
function numberParam(value:string|null){if(!value)return undefined;const n=Number(value);return Number.isInteger(n)&&n>=0?n:undefined}
