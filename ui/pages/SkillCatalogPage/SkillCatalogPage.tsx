import { decorationIdentity } from '../../../api/catalog/decorationIdentity'
import { P3SkillArmorPreview } from '../../components/P3SkillArmorPreview/P3SkillArmorPreview'
import type { DecorationIdentity } from '../../../api/catalog/types'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { SkillCatalogFilters, SkillCatalogTab, SkillDetail, SkillSummary } from '../../../api/catalog/types'
import type { SkillCatalogOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { ArmorDetailDrawer } from '../../components/ArmorDetailDrawer/ArmorDetailDrawer'
import { DecorationDetailDrawer } from '../../components/DecorationDetailDrawer/DecorationDetailDrawer'
import { SkillDetailDrawer } from '../../components/SkillDetailDrawer/SkillDetailDrawer'
import { P2gSkillEquipmentDrawer } from '../../components/P2gSkillEquipmentDrawer/P2gSkillEquipmentDrawer'
import { SkillCatalogToolbar } from '../../components/SkillCatalogToolbar/SkillCatalogToolbar'
import { SkillDetailPanel } from '../../components/SkillDetailPanel/SkillDetailPanel'
import { SkillSearchList } from '../../components/SkillSearchList/SkillSearchList'
import './SkillCatalogPage.css'

type Drawer = {kind:'armor'|'skill';id:number}|{kind:'decoration';identity:DecorationIdentity}|{kind:'p3-armor';armorKey:string}|null
const tabs: SkillCatalogTab[] = ['armor', 'decoration', 'talisman']
export function SkillCatalogPage() {
  const {game}=useOutletContext<SkillCatalogOutletContext>(),[params,setParams]=useSearchParams(),isP2g=game.id==='mhp2g',isP3=game.id==='mhp3'
  const query=params.get('q')??'',[queryInput,setQueryInput]=useState(query),skillId=numberParam(params.get('skill')),targetSkillId=numberParam(params.get('target'))
  const requestedTab=params.get('tab') as SkillCatalogTab,tab=tabs.includes(requestedTab)&&(!isP2g||requestedTab!=='talisman')?requestedTab:'armor'
  const direction=['positive','negative','special'].includes(params.get('direction')??'')?params.get('direction') as SkillCatalogFilters['direction']:undefined
  const requestedSource=params.get('source'),source=['armor','decoration',...(isP2g?[]:['talisman'])].includes(requestedSource??'')?requestedSource as NonNullable<SkillCatalogFilters['source']>:'all'
  const sort=['name','activationCount'].includes(params.get('sort')??'')?params.get('sort') as NonNullable<SkillCatalogFilters['sort']>:'skillId'
  const includePlaceholders=params.get('debug')==='1',page=numberParam(params.get('page'))||1,equipmentKey=(isP2g||isP3)?params.get('equipment'):null
  const [items,setItems]=useState<SkillSummary[]>([]),[detail,setDetail]=useState<SkillDetail|null>(null),[meta,setMeta]=useState({pageSize:100,total:0,hasNext:false})
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState<string>(),[detailError,setDetailError]=useState<string>(),[drawer,setDrawer]=useState<Drawer>(null)
  const [retry,setRetry]=useState(0),retryLoad=useCallback(()=>setRetry(n=>n+1),[])
  const update=useCallback((changes:Record<string,string|number|undefined>)=>setParams(current=>{const next=new URLSearchParams(current);Object.entries(changes).forEach(([key,value])=>value==null||value===''?next.delete(key):next.set(key,String(value)));return next}),[setParams])
  // Selection and detail tabs must not restart the list query or overwrite newer navigation.
  const selectionRef=useRef({skillId,update})
  useLayoutEffect(()=>{selectionRef.current={skillId,update}},[skillId,update])
  const closeEquipment=useCallback(()=>update({equipment:undefined}),[update]),closeDrawer=useCallback(()=>setDrawer(null),[])
  const reset=useCallback(()=>{setQueryInput('');setDrawer(null);setParams({})},[setParams])
  useEffect(()=>setQueryInput(query),[query])
  useEffect(()=>{if(queryInput===query)return;const timer=window.setTimeout(()=>update({q:queryInput||undefined,target:undefined,skill:undefined,page:undefined,equipment:undefined}),280);return()=>window.clearTimeout(timer)},[queryInput,query,update])
  useEffect(()=>{setDrawer(null)},[game.id,equipmentKey,skillId,query,direction,source,page])
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
  },[game.id,targetSkillId,query,direction,source,includePlaceholders,sort,page,retry])
  useEffect(()=>{
    let active=true;setDetail(null);setDetailError(undefined)
    if(skillId==null){setDetailLoading(false);return}
    setDetailLoading(true);const api=window.mhSaveEditor?.catalog
    if(!api){setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setDetailLoading(false);return}
    void api.getSkill({gameId:game.id,skillId}).then(value=>{if(active)setDetail(value)}).catch(cause=>{if(active)setDetailError(cause instanceof Error?cause.message:'技能详情读取失败')}).finally(()=>{if(active)setDetailLoading(false)})
    return()=>{active=false}
  },[game.id,skillId,retry])
  const selected=items.some(item=>item.skillId===skillId)?skillId:undefined
  const openSkill=(id:number)=>setDrawer({kind:'skill',id})
  const listScrollKey=`skills:${game.id}:${targetSkillId}:${query}:${direction}:${source}:${sort}:${page}:${includePlaceholders}`
  return <div className="skill-catalog-page"><SkillCatalogToolbar query={queryInput} direction={direction} source={source} sort={sort} includePlaceholders={includePlaceholders} includeTalismans={!isP2g} onQueryChange={setQueryInput} onChange={(key,value)=>{setDrawer(null);update({[key]:value,target:undefined,skill:undefined,page:undefined,equipment:undefined})}} onReset={reset}/>
    <div className="skill-catalog-page__layout"><SkillSearchList items={items} selectedId={selected} loading={loading} error={error} onRetry={retryLoad} scrollKey={listScrollKey} page={page} pageSize={meta.pageSize} total={meta.total} hasNext={meta.hasNext} onSelect={id=>update({skill:id,equipment:undefined})} onPageChange={next=>update({page:next,skill:undefined})}/>{isP3&&equipmentKey?<P3SkillArmorPreview mode="inline" armorKey={equipmentKey} onClose={closeEquipment} onSelectSkill={openSkill}/>:<SkillDetailPanel skill={detail} loading={detailLoading} error={detailError} onRetry={retryLoad} emptyMessage={skillId!=null?'未找到对应技能资料。':undefined} scrollKey={`detail:${game.id}:${skillId}:${tab}`} tab={tab} onTabChange={value=>update({tab:value})} onSelectDecoration={value=>setDrawer({kind:'decoration',identity:decorationIdentity(value.gameId,value.gameId==='mhp3'?value.itemId:value.saveId)})} onSelectArmor={value=>setDrawer(value.gameId==='mhp3'?{kind:'p3-armor',armorKey:value.armorKey}:{kind:'armor',id:value.dexId})} onSelectSkill={openSkill} onSelectP2gEquipment={value=>{setDrawer(null);update({equipment:value.equipmentKey})}}/>}</div>
    <DecorationDetailDrawer identity={drawer?.kind==='decoration'?drawer.identity:null} onClose={closeDrawer}/>
    {game.id!=='mhp2g'&&game.id!=='mhp3'&&<ArmorDetailDrawer gameId={game.id} armorDexId={drawer?.kind==='armor'?drawer.id:null} onClose={closeDrawer}/>}
    <P3SkillArmorPreview mode="drawer" armorKey={drawer?.kind==='p3-armor'?drawer.armorKey:null} onClose={closeDrawer} onSelectSkill={id=>{closeDrawer();update({target:id,skill:id,equipment:undefined})}}/>
    <SkillDetailDrawer gameId={game.id} skillId={drawer?.kind==='skill'?drawer.id:null} onClose={closeDrawer}/><P2gSkillEquipmentDrawer equipmentKey={isP2g?equipmentKey:null} onClose={closeEquipment}/>
  </div>
}
function numberParam(value:string|null){if(!value)return undefined;const n=Number(value);return Number.isInteger(n)&&n>=0?n:undefined}
