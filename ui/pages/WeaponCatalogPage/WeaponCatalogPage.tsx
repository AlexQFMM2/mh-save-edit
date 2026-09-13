import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { SharpnessStage, SortDirection, WeaponAttributeFilter, WeaponCatalogFacets, WeaponCatalogFilters, WeaponDetail, WeaponLink, WeaponMotionCatalogResult, WeaponMotionCategory, WeaponMotionFacets, WeaponMotionSort, WeaponSort, WeaponStyleId, WeaponSummary, WeaponTreeResult, WeaponViewMode } from '../../../api/catalog/types'
import { HunterArtDetailDrawer } from '../../components/HunterArtDetailDrawer/HunterArtDetailDrawer'
import { ItemDetailDrawer } from '../../components/ItemDetailDrawer/ItemDetailDrawer'
import { ItemPagination } from '../../components/ItemPagination/ItemPagination'
import { WeaponCatalogToolbar } from '../../components/WeaponCatalogToolbar/WeaponCatalogToolbar'
import { WeaponDetailPanel } from '../../components/WeaponDetailPanel/WeaponDetailPanel'
import { WeaponFilterBar } from '../../components/WeaponFilterBar/WeaponFilterBar'
import { WeaponList } from '../../components/WeaponList/WeaponList'
import { WeaponMotionTable } from '../../components/WeaponMotionTable/WeaponMotionTable'
import { WeaponMotionToolbar } from '../../components/WeaponMotionToolbar/WeaponMotionToolbar'
import { WeaponTreeCanvas } from '../../components/WeaponTreeCanvas/WeaponTreeCanvas'
import { WeaponTreeTypePrompt } from '../../components/WeaponTreeTypePrompt/WeaponTreeTypePrompt'
import type { WorkspaceOutletContext } from '../../components/WorkspaceContent/WorkspaceContent'
import { weaponMatchesFilters } from '../../utils/weaponCatalog'
import './WeaponCatalogPage.css'

const emptyFacets: WeaponCatalogFacets = { weaponTypes: [], attributes: [], rarities: [], slots: [], sharpnessStages: ['base', 'handicraft1'] }
const emptyMotionFacets: WeaponMotionFacets = { weaponTypes: [], styles: [], categories: ['standard','style','hunterArt'] }
const weaponStyles = new Set<WeaponStyleId>(['guild','striker','aerial','adept','alchemy','valor'])
function numberParam(value: string | null): number | undefined { if (!value) return undefined; const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined }
function weaponKeyParam(value: string | null): string | undefined { return value && /^\d+:\d+(?::\d+)?$/.test(value) ? value : undefined }

export function WeaponCatalogPage() {
  const { game } = useOutletContext<WorkspaceOutletContext>()
  const [params, setParams] = useSearchParams()
  const [queryInput, setQueryInput] = useState(params.get('q') ?? '')
  const query = params.get('q') ?? ''
  const typeId = numberParam(params.get('type'))
  const rawAttribute = params.get('attribute')
  const attributeId: WeaponAttributeFilter | undefined = rawAttribute === 'none' ? 'none' : numberParam(rawAttribute)
  const includeHiddenAttributes = params.get('hidden') !== '0'
  const rarity = numberParam(params.get('rarity'))
  const slots = numberParam(params.get('slots'))
  const directlyProducible = params.get('producible') === '1'
  const includePlaceholders = params.get('debug') === '1'
  const sort = (['saveId', 'name', 'rarity', 'attack', 'slots', 'sharpness', 'affinity'].includes(params.get('sort') ?? '') ? params.get('sort') : 'saveId') as WeaponSort
  const direction = (params.get('direction') === 'desc' ? 'desc' : 'asc') as SortDirection
  const sharpnessStage = (['handicraft1', 'handicraft2'].includes(params.get('sharpness') ?? '') ? params.get('sharpness') : 'base') as SharpnessStage
  const requestedView = params.get('view')
  const view:WeaponViewMode = requestedView === 'list' ? 'list' : requestedView === 'motion' && game.id === 'mhgu' ? 'motion' : 'tree'
  const page = numberParam(params.get('page')) || 1
  const selectedKey = weaponKeyParam(params.get('weapon'))
  const targetWeaponKey = weaponKeyParam(params.get('target'))
  const [facets, setFacets] = useState<WeaponCatalogFacets>(emptyFacets)
  const [items, setItems] = useState<WeaponSummary[]>([])
  const [meta, setMeta] = useState({ total: 0, pageSize: 100, hasNext: false })
  const [detail, setDetail] = useState<WeaponDetail | null>(null)
  const [tree, setTree] = useState<WeaponTreeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [treeLoading, setTreeLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [treeError, setTreeError] = useState<string>()
  const [detailError, setDetailError] = useState<string>()
  const [drawerItemId, setDrawerItemId] = useState<number | null>(null)
  const motionTypeId=typeId??1
  const motionQuery=params.get('mq')??''
  const motionStyles=(params.get('styles')??'').split(',').filter((style):style is WeaponStyleId=>weaponStyles.has(style as WeaponStyleId))
  const motionCategory=(['standard','style','hunterArt'].includes(params.get('motionCategory')??'')?params.get('motionCategory'):undefined) as WeaponMotionCategory|undefined
  const motionSort=(['motionValue','stun','exhaust'].includes(params.get('motionSort')??'')?params.get('motionSort'):'source') as WeaponMotionSort
  const motionDirection=(params.get('motionDirection')==='desc'?'desc':'asc') as SortDirection
  const expandedMotion=params.get('move')??undefined
  const [motionQueryInput,setMotionQueryInput]=useState(motionQuery)
  const [motionFacets,setMotionFacets]=useState<WeaponMotionFacets>(emptyMotionFacets)
  const [motionResult,setMotionResult]=useState<WeaponMotionCatalogResult|null>(null)
  const [motionLoading,setMotionLoading]=useState(false)
  const [motionError,setMotionError]=useState<string>()
  const [drawerHunterArtId,setDrawerHunterArtId]=useState<number|null>(null)
  const detailRequest = useRef(0)

  const update = useCallback((changes: Record<string, string | number | undefined>) => setParams((current) => { const next = new URLSearchParams(current); for (const [key, value] of Object.entries(changes)) { if (value == null || value === '') next.delete(key); else next.set(key, String(value)) } return next }), [setParams])
  const resetCatalog = useCallback(() => { setQueryInput(''); setDrawerItemId(null); setParams({}) }, [setParams])
  const resetMotions = useCallback(() => {setMotionQueryInput('');setDrawerHunterArtId(null);setParams({view:'motion',type:'1'})},[setParams])
  useEffect(() => { if (queryInput === query) return; const timer = window.setTimeout(() => update({ target: undefined, q: queryInput || undefined, page: undefined, weapon: undefined }), 280); return () => window.clearTimeout(timer) }, [queryInput, query, update])
  useEffect(() => setQueryInput(query), [query])
  useEffect(()=>setMotionQueryInput(motionQuery),[motionQuery])
  useEffect(()=>{if(view!=='motion'||motionQueryInput===motionQuery)return;const timer=window.setTimeout(()=>update({mq:motionQueryInput||undefined,move:undefined}),280);return()=>window.clearTimeout(timer)},[view,motionQueryInput,motionQuery,update])
  useEffect(()=>{if(requestedView==='motion'&&game.id!=='mhgu')update({view:'tree'})},[requestedView,game.id,update])
  useEffect(() => { let active = true; const api = window.mhSaveEditor?.catalog; if (!api) return; void api.getWeaponFacets(game.id).then((value) => { if (active) setFacets(value) }).catch(() => undefined); return () => { active = false } }, [game.id])
  useEffect(()=>{if(view!=='motion')return;let active=true;const api=window.mhSaveEditor?.catalog;if(!api)return;void api.getWeaponMotionFacets('mhgu').then(value=>{if(active)setMotionFacets(value)}).catch(()=>undefined);return()=>{active=false}},[view])
  useEffect(()=>{
    if(view!=='motion')return
    let active=true;setMotionLoading(true);setMotionError(undefined)
    const api=window.mhSaveEditor?.catalog
    if(!api){setMotionError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setMotionLoading(false);return}
    void api.searchWeaponMotions({gameId:'mhgu',weaponTypeId:motionTypeId,query:motionQuery||undefined,styleIds:motionStyles.length?motionStyles:undefined,category:motionCategory,sort:motionSort,direction:motionDirection}).then(value=>{if(active)setMotionResult(value)}).catch(cause=>{if(active)setMotionError(cause instanceof Error?cause.message:'动作值查询失败')}).finally(()=>{if(active)setMotionLoading(false)})
    return()=>{active=false}
  },[view,motionTypeId,motionQuery,params.get('styles'),motionCategory,motionSort,motionDirection])
  useEffect(() => {
    if (game.id !== 'mhgu' && sharpnessStage === 'handicraft2') update({ sharpness: 'handicraft1' })
  }, [game.id, sharpnessStage, update])
  useEffect(() => {
    if(view==='motion')return
    let active = true; setLoading(true); setError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setLoading(false); return }
    const filters: WeaponCatalogFilters = { gameId: game.id, targetWeaponKey, query, weaponTypeId: typeId, attributeId, includeHiddenAttributes, rarity, slots, directlyProducible, includePlaceholders, sort, direction, sharpnessStage, page, pageSize: 100 }
    void api.searchWeapons(filters).then((result) => { if (!active) return; setItems(result.items); setMeta({ total: result.total, pageSize: result.pageSize, hasNext: result.hasNext }); if (!selectedKey && result.items[0]) update({ weapon: result.items[0].weaponKey }) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : '武器查询失败') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [game.id, targetWeaponKey, query, typeId, attributeId, includeHiddenAttributes, rarity, slots, directlyProducible, includePlaceholders, sort, direction, sharpnessStage, page, update, view])
  useEffect(() => {
    if (view !== 'tree' || typeId == null) { setTree(null); return }
    let active = true; setTreeLoading(true); setTreeError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setTreeError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setTreeLoading(false); return }
    void api.getWeaponTree(game.id, typeId).then((value) => { if (!active) return; setTree(value); if (!selectedKey && value.nodes[0]) update({ weapon: value.nodes[0].weaponKey }) }).catch((cause) => { if (active) setTreeError(cause instanceof Error ? cause.message : '派生图读取失败') }).finally(() => { if (active) setTreeLoading(false) })
    return () => { active = false }
  }, [view, game.id, typeId, update])
  useEffect(() => {
    if (view==='motion'||!selectedKey) { if(view!=='motion')setDetail(null); return }
    const request = ++detailRequest.current
    setDetailLoading(true); setDetailError(undefined)
    const api = window.mhSaveEditor?.catalog
    if (!api) { setDetailError('图鉴 API 尚未连接，请在 Electron 应用中打开。'); setDetailLoading(false); return }
    void api.getWeapon({ gameId: game.id, weaponKey: selectedKey }).then((value) => { if (request === detailRequest.current) setDetail(value) }).catch((cause) => { if (request === detailRequest.current) setDetailError(cause instanceof Error ? cause.message : '详情读取失败') }).finally(() => { if (request === detailRequest.current) setDetailLoading(false) })
  }, [game.id, selectedKey, view])

  const selectedType = facets.weaponTypes.find((type) => type.typeId === typeId)
  const selectedVisible = items.some((item) => item.weaponKey === selectedKey)
  const treeFilters = useMemo(() => ({ query, attributeId, includeHiddenAttributes, rarity, slots, directlyProducible }), [query, attributeId, includeHiddenAttributes, rarity, slots, directlyProducible])
  const selectWeapon = (weaponKey: string) => update({ target: undefined, weapon: weaponKey })
  const selectLinkedWeapon = (weapon: WeaponLink) => update({ target: weapon.weaponKey, type: weapon.typeId, weapon: weapon.weaponKey, page: undefined })
  const changeFilter = (key: string, value?: string) => update({ target: undefined, [key]: value, page: undefined, weapon: undefined })
  const main = view === 'tree'
    ? typeId == null
      ? <WeaponTreeTypePrompt types={facets.weaponTypes} onSelect={(value) => update({ type: value, weapon: undefined, page: undefined })} />
      : treeLoading && !tree
        ? <div className="weapon-catalog-page__state" role="status">正在构建派生画布…</div>
        : treeError
          ? <div className="weapon-catalog-page__state weapon-catalog-page__state--error" role="alert">{treeError}</div>
          : tree && <WeaponTreeCanvas tree={tree} filters={treeFilters} selectedKey={selectedKey} sharpnessStage={sharpnessStage} onSelect={selectWeapon} />
    : <section className="weapon-catalog-page__list"><WeaponList gameId={game.id} items={items} selectedKey={selectedVisible ? selectedKey : undefined} selectedKind={selectedType?.kind} sharpnessStage={sharpnessStage} loading={loading} error={error} onSelect={selectWeapon} /><ItemPagination ariaLabel="武器列表分页" page={page} pageSize={meta.pageSize} total={meta.total} hasNext={meta.hasNext} onPageChange={(value) => update({ page: value, target: undefined, weapon: undefined })} /></section>

  if(view==='motion')return <div className="weapon-catalog-page weapon-catalog-page--motion">
    <WeaponMotionToolbar query={motionQueryInput} weaponTypeId={motionTypeId} styles={motionStyles} category={motionCategory} sort={motionSort} direction={motionDirection} facets={motionFacets} total={motionResult?.motions.length??0} onQueryChange={setMotionQueryInput} onChange={(key,value)=>update({[key]:value,move:undefined})} onStylesChange={values=>update({styles:values.length?values.join(','):undefined,move:undefined})} onViewChange={value=>update({view:value,move:undefined})} onReset={resetMotions}/>
    <div className="weapon-catalog-page__motion-browser"><WeaponMotionTable result={motionResult} loading={motionLoading} error={motionError} expandedKey={expandedMotion} onToggle={motionKey=>update({move:expandedMotion===motionKey?undefined:motionKey})} onSelectHunterArt={setDrawerHunterArtId}/></div>
    <HunterArtDetailDrawer gameId="mhgu" hunterArtId={drawerHunterArtId} onClose={()=>setDrawerHunterArtId(null)}/>
  </div>

  return <div className="weapon-catalog-page">
    <WeaponCatalogToolbar query={queryInput} sort={sort} direction={direction} sharpnessStage={sharpnessStage} sharpnessStages={facets.sharpnessStages} view={view} showMotion={game.id==='mhgu'} total={view === 'tree' && tree ? tree.nodes.filter((node) => weaponMatchesFilters(node, treeFilters)).length : meta.total} onQueryChange={setQueryInput} onChange={(key, value) => update({ target: undefined, [key]: value, page: undefined })} />
    <WeaponFilterBar facets={facets} typeId={typeId} attributeId={attributeId} includeHiddenAttributes={includeHiddenAttributes} rarity={rarity} slots={slots} directlyProducible={directlyProducible} includePlaceholders={includePlaceholders} onChange={changeFilter} onReset={resetCatalog} />
    <div className="weapon-catalog-page__layout"><div className="weapon-catalog-page__browser">{main}</div><WeaponDetailPanel gameId={game.id} weapon={detail} loading={detailLoading} error={detailError} sharpnessStage={sharpnessStage} showRelations={false} onSelectItem={setDrawerItemId} onSelectWeapon={selectLinkedWeapon} /></div>
    <ItemDetailDrawer gameId={game.id} itemSaveId={drawerItemId} onClose={() => setDrawerItemId(null)} />
  </div>
}
