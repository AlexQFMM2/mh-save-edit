import { P3DecorationSkillDrawer } from '../../components/P3DecorationSkillDrawer/P3DecorationSkillDrawer'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { DecorationCatalogFacets, DecorationCatalogFilters, DecorationDetail, DecorationSummary, ItemIdentity } from '../../../api/catalog/types'
import { decorationIdentity, decorationNumber } from '../../../api/catalog/decorationIdentity'
import { itemIdentity, itemNumber } from '../../../api/catalog/itemIdentity'
import { DecorationCatalogToolbar } from '../../components/DecorationCatalogToolbar/DecorationCatalogToolbar'
import { DecorationDetailPanel } from '../../components/DecorationDetailPanel/DecorationDetailPanel'
import { DecorationList } from '../../components/DecorationList/DecorationList'
import { DecorationSkillFilter } from '../../components/DecorationSkillFilter/DecorationSkillFilter'
import { ItemPagination } from '../../components/ItemPagination/ItemPagination'
import { ItemDetailDrawer } from '../../components/ItemDetailDrawer/ItemDetailDrawer'
import { SkillDetailDrawer } from '../../components/SkillDetailDrawer/SkillDetailDrawer'
import type { DecorationCatalogOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './DecorationCatalogPage.css'

type Drawer = { kind:'item';identity:ItemIdentity } | { kind:'skill';id:number } | null
export function parseDecorationNumber(value:string|null):number|undefined { if(value==null||value==='')return undefined;const n=Number(value);return Number.isInteger(n)&&n>=0?n:undefined }
export function DecorationCatalogPage() {
  const {game}=useOutletContext<DecorationCatalogOutletContext>(),[params,setParams]=useSearchParams(),isNative=game.id==='mhp2g'||game.id==='mhp3'
  const query=params.get('q')??'',[queryInput,setQueryInput]=useState(query)
  const skillId=parseDecorationNumber(params.get('skill')),slots=parseDecorationNumber(params.get('slots')),page=parseDecorationNumber(params.get('page'))||1
  const selectedId=parseDecorationNumber(params.get('item')),target=parseDecorationNumber(params.get('target')),includePlaceholders=params.get('debug')==='1'
  const rawSort=params.get('sort'),sort:NonNullable<DecorationCatalogFilters['sort']>=rawSort==='name'||rawSort==='slots'||(rawSort==='skillPoints'&&skillId!=null)?rawSort:isNative?'itemId':'saveId'
  const [items,setItems]=useState<DecorationSummary[]>([]),[detail,setDetail]=useState<DecorationDetail|null>(null)
  const [facets,setFacets]=useState<DecorationCatalogFacets>({slots:[],skills:[]}),[facetsLoaded,setFacetsLoaded]=useState(false),[meta,setMeta]=useState({total:0,pageSize:100,hasNext:false})
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState<string>(),[detailError,setDetailError]=useState<string>(),[drawer,setDrawer]=useState<Drawer>(null)
  const [retry,setRetry]=useState(0),[facetsError,setFacetsError]=useState<string>()
  const retryLoad=()=>setRetry(n=>n+1)
  const closeDrawer=useCallback(()=>setDrawer(null),[])
  const update=useCallback((changes:Record<string,string|number|undefined>)=>setParams(current=>{const next=new URLSearchParams(current);for(const [key,value] of Object.entries(changes)){if(value==null||value==='')next.delete(key);else next.set(key,String(value))}return next}),[setParams])
  // Selection changes load details only. Pending searches use the latest committed URL.
  const selectionRef=useRef({selectedId,update})
  useLayoutEffect(()=>{selectionRef.current={selectedId,update}},[selectedId,update])
  const reset=useCallback(()=>{setQueryInput('');setDrawer(null);setParams({})},[setParams])
  useEffect(()=>setQueryInput(query),[query])
  useEffect(()=>{if(queryInput===query)return;const timer=window.setTimeout(()=>update({target:undefined,q:queryInput||undefined,page:undefined,item:undefined}),280);return()=>window.clearTimeout(timer)},[queryInput,query,update])
  useEffect(()=>setDrawer(null),[game.id,selectedId,query,skillId,slots,page])
  useEffect(()=>{
    let active=true;setLoading(true);setError(undefined)
    const api=window.mhSaveEditor?.catalog
    if(!api){setError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setLoading(false);return}
    void api.searchDecorations({gameId:game.id,...(isNative?{targetItemId:target}:{targetSaveId:target}),query,skillId,slots,includePlaceholders,sort,page,pageSize:100}).then(result=>{
      if(!active)return
      setItems(result.items);setMeta({total:result.total,pageSize:result.pageSize,hasNext:result.hasNext})
      const selection=selectionRef.current
      if(selection.selectedId==null&&result.items[0])selection.update({item:decorationNumber(result.items[0])})
    }).catch(cause=>{if(active){setItems([]);setError(cause instanceof Error?cause.message:'装饰品查询失败')}}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[game.id,isNative,target,query,skillId,slots,includePlaceholders,sort,page,retry])
  useEffect(()=>{
    let active=true;setFacetsError(undefined);setFacetsLoaded(false);setFacets({slots:[],skills:[]})
    const api=window.mhSaveEditor?.catalog;if(!api)return
    void api.getDecorationFacets(game.id).then(result=>{if(active){setFacets(result);setFacetsLoaded(true)}}).catch(cause=>{if(active)setFacetsError(cause instanceof Error?cause.message:'筛选资料读取失败')})
    return()=>{active=false}
  },[game.id,retry])
  useEffect(()=>{if(facetsLoaded&&skillId!=null&&!facets.skills.some(s=>s.skillId===skillId))update({skill:undefined,sort:undefined,page:undefined,item:undefined})},[facets,facetsLoaded,skillId,update])
  useEffect(()=>{
    let active=true;setDetail(null);setDetailError(undefined)
    if(selectedId==null){setDetailLoading(false);return}
    setDetailLoading(true);const api=window.mhSaveEditor?.catalog
    if(!api){setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setDetailLoading(false);return}
    void api.getDecoration(decorationIdentity(game.id,selectedId)).then(result=>{if(active)setDetail(result&&(!result.isPlaceholder||includePlaceholders)?result:null)}).catch(cause=>{if(active)setDetailError(cause instanceof Error?cause.message:'详情读取失败')}).finally(()=>{if(active)setDetailLoading(false)})
    return()=>{active=false}
  },[game.id,selectedId,includePlaceholders,retry])
  const openItem=(item:ItemIdentity)=>setDrawer({kind:'item',identity:itemIdentity(item.gameId,itemNumber(item))})
  return <div className="decoration-catalog-page">
    <DecorationCatalogToolbar nativeIdentity={isNative} query={queryInput} sort={sort} onQueryChange={setQueryInput} onSortChange={value=>update({target:undefined,sort:value,page:undefined,item:undefined})}/>
    <DecorationSkillFilter includeNegativeSkills={game.id==='mhp3'} facets={facets} skillId={skillId} slots={slots} includePlaceholders={includePlaceholders} onChange={(key,value)=>update({target:undefined,[key]:value,page:undefined,item:undefined,sort:key==='skill'&&value?'skillPoints':key==='skill'?undefined:sort})} onReset={reset}/>
    <div className="decoration-catalog-page__layout"><section className="decoration-catalog-page__list" aria-label="装饰品列表">
      <DecorationList items={items} selectedId={items.some(i=>decorationNumber(i)===selectedId)?selectedId:undefined} loading={loading} error={error??facetsError} onRetry={retryLoad} onSelect={id=>update({item:id})}/>
      <ItemPagination ariaLabel="装饰品列表分页" page={page} pageSize={meta.pageSize} total={meta.total} hasNext={meta.hasNext} onPageChange={value=>update({page:value,item:undefined})}/>
    </section><DecorationDetailPanel item={detail} loading={detailLoading} error={detailError} onRetry={retryLoad} onSelectMaterial={openItem} onSelectItem={openItem} onSelectSkill={id=>setDrawer({kind:'skill',id})}/></div>
    <ItemDetailDrawer identity={drawer?.kind==='item'?drawer.identity:null} onClose={closeDrawer}/>{game.id==='mhp3'?<P3DecorationSkillDrawer skill={drawer?.kind==='skill'?detail?.skills.find(s=>s.skillId===drawer.id)??null:null} onClose={closeDrawer}/>:<SkillDetailDrawer gameId={game.id} skillId={drawer?.kind==='skill'?drawer.id:null} onClose={closeDrawer}/>}
  </div>
}
