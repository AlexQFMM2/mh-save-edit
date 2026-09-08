import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { DecorationCatalogFacets, DecorationDetail, DecorationSummary } from '../../../api/catalog/types'
import { DecorationCatalogToolbar } from '../../components/DecorationCatalogToolbar/DecorationCatalogToolbar'
import { DecorationDetailPanel } from '../../components/DecorationDetailPanel/DecorationDetailPanel'
import { DecorationList } from '../../components/DecorationList/DecorationList'
import { DecorationSkillFilter } from '../../components/DecorationSkillFilter/DecorationSkillFilter'
import { ItemPagination } from '../../components/ItemPagination/ItemPagination'
import { ItemDetailDrawer } from '../../components/ItemDetailDrawer/ItemDetailDrawer'
import { SkillDetailDrawer } from '../../components/SkillDetailDrawer/SkillDetailDrawer'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import './DecorationCatalogPage.css'

type Sort = 'saveId'|'name'|'slots'|'skillPoints'
export function parseDecorationNumber(value: string | null): number | undefined { if (value == null || value === '') return undefined; const parsed=Number(value); return Number.isInteger(parsed)&&parsed>=0?parsed:undefined }
export function DecorationCatalogPage() {
  const { game }=useOutletContext<WorkspaceOutletContext>(); const [params,setParams]=useSearchParams()
  const [queryInput,setQueryInput]=useState(params.get('q')??''); const query=params.get('q')??''
  const skillId=parseDecorationNumber(params.get('skill')); const rawSort=params.get('sort'); const sort:Sort=rawSort==='name'||rawSort==='slots'||(rawSort==='skillPoints'&&skillId!=null)?rawSort:'saveId'
  const slots=parseDecorationNumber(params.get('slots')); const page=parseDecorationNumber(params.get('page'))||1; const selectedId=parseDecorationNumber(params.get('item')); const targetSaveId=parseDecorationNumber(params.get('target')); const includePlaceholders=params.get('debug')==='1'
  const [items,setItems]=useState<DecorationSummary[]>([]); const [detail,setDetail]=useState<DecorationDetail|null>(null); const [facets,setFacets]=useState<DecorationCatalogFacets>({slots:[],skills:[]}); const [facetsLoaded,setFacetsLoaded]=useState(false); const [meta,setMeta]=useState({total:0,pageSize:100,hasNext:false}); const [loading,setLoading]=useState(true); const [detailLoading,setDetailLoading]=useState(false); const [error,setError]=useState<string>(); const [detailError,setDetailError]=useState<string>()
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null)
  const [drawerSkillId, setDrawerSkillId] = useState<number | null>(null)
  const closeDrawer = useCallback(() => setDrawerItemId(null), [])
  const update=useCallback((changes:Record<string,string|number|undefined>)=>setParams(current=>{const next=new URLSearchParams(current); for(const [key,value] of Object.entries(changes)){if(value==null||value==='')next.delete(key);else next.set(key,String(value))} return next}),[setParams])
  const resetCatalog=useCallback(()=>{setQueryInput('');setDrawerItemId(null);setDrawerSkillId(null);setParams({})},[setParams])
  useEffect(()=>{if(queryInput===query)return;const timer=window.setTimeout(()=>update({target:undefined,q:queryInput||undefined,page:undefined,item:undefined}),280);return()=>window.clearTimeout(timer)},[queryInput,query,update])
  useEffect(()=>setQueryInput(query),[query])
  useEffect(()=>{let active=true; setLoading(true);setError(undefined); const api=window.mhSaveEditor?.catalog; if(!api){setError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setLoading(false);return()=>{active=false}} void api.searchDecorations({gameId:game.id,targetSaveId,query,skillId,slots,includePlaceholders,sort,page,pageSize:100}).then(result=>{if(!active)return;setItems(result.items);setMeta({total:result.total,pageSize:result.pageSize,hasNext:result.hasNext});if(selectedId==null&&result.items[0])update({item:result.items[0].saveId})}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'装饰品查询失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[game.id,targetSaveId,query,skillId,slots,includePlaceholders,sort,page])
  useEffect(()=>{let active=true;setFacetsLoaded(false);const api=window.mhSaveEditor?.catalog;if(!api)return()=>{active=false};void api.getDecorationFacets(game.id).then(result=>{if(active){setFacets(result);setFacetsLoaded(true)}}).catch(()=>{if(active)setFacetsLoaded(true)});return()=>{active=false}},[game.id])
  useEffect(()=>{if(facetsLoaded&&skillId!=null&&!facets.skills.some(skill=>skill.skillId===skillId))update({skill:undefined,sort:undefined,page:undefined,item:undefined})},[facets,facetsLoaded,skillId,update])
  useEffect(()=>{if(selectedId==null){setDetail(null);return}let active=true;setDetailLoading(true);setDetailError(undefined);const api=window.mhSaveEditor?.catalog;if(!api){setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setDetailLoading(false);return()=>{active=false}}void api.getDecoration({gameId:game.id,saveId:selectedId}).then(result=>{if(active)setDetail(result&&!result.isPlaceholder||includePlaceholders?result:null)}).catch(cause=>{if(active)setDetailError(cause instanceof Error?cause.message:'详情读取失败')}).finally(()=>{if(active)setDetailLoading(false)});return()=>{active=false}},[game.id,selectedId,includePlaceholders])
  const selectedVisible=useMemo(()=>items.some(item=>item.saveId===selectedId),[items,selectedId])
  return <div className="decoration-catalog-page"><DecorationCatalogToolbar query={queryInput} sort={sort} onQueryChange={setQueryInput} onSortChange={value=>update({target:undefined,sort:value,page:undefined,item:undefined})}/><DecorationSkillFilter facets={facets} skillId={skillId} slots={slots} includePlaceholders={includePlaceholders} onChange={(key,value)=>update({target:undefined,[key]:value,page:undefined,item:undefined,sort:key==='skill'&&value?'skillPoints':key==='skill'?undefined:sort})} onReset={resetCatalog}/><div className="decoration-catalog-page__layout"><section className="decoration-catalog-page__list" aria-label="装饰品列表"><DecorationList items={items} selectedId={selectedVisible?selectedId:undefined} loading={loading} error={error} onSelect={id=>update({item:id})}/><ItemPagination ariaLabel="装饰品列表分页" page={page} pageSize={meta.pageSize} total={meta.total} hasNext={meta.hasNext} onPageChange={value=>update({page:value,item:undefined})}/></section><DecorationDetailPanel item={detail} loading={detailLoading} error={detailError} onSelectMaterial={(material)=>{setDrawerSkillId(null);setDrawerItemId(material.saveId)}} onSelectSkill={value=>{setDrawerItemId(null);setDrawerSkillId(value)}}/></div><ItemDetailDrawer gameId={game.id} itemSaveId={drawerItemId} onClose={closeDrawer}/><SkillDetailDrawer gameId={game.id} skillId={drawerSkillId} onClose={()=>setDrawerSkillId(null)}/></div>
}
