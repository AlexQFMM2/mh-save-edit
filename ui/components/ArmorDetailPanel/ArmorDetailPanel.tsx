import { useCatalogScroll } from '../../utils/useCatalogScroll'
import { p2gSaveIdentity } from '../../../api/save/p2g/identity'
import type { CatalogArmorDetail } from '../../utils/catalogArmor'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { ArmorMaterialList } from '../ArmorMaterialList/ArmorMaterialList'
import { ArmorSkillList } from '../ArmorSkillList/ArmorSkillList'
import { ArmorStatsPanel } from '../ArmorStatsPanel/ArmorStatsPanel'
import { P2gArmorRecipeList } from '../P2gArmorRecipeList/P2gArmorRecipeList'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import { DetailActionBar } from '../DetailActionBar/DetailActionBar'
import './ArmorDetailPanel.css'

const part={head:'头部',chest:'胸部',arms:'腕部',waist:'腰部',legs:'腿部'}
export function ArmorDetailPanel({ armor, loading, error, allowCatalogWrite = true, layout = 'panel', onSelectItem, onSelectSkill, onRetry, emptyMessage, scrollKey }: { onRetry?: () => void; emptyMessage?: string; scrollKey?: string; armor: CatalogArmorDetail|null; loading: boolean; error?: string; allowCatalogWrite?: boolean; layout?: 'panel' | 'embedded'; onSelectItem?: (id:number)=>void; onSelectSkill?: (skillId:number)=>void }) {
  const scroll = useCatalogScroll(scrollKey, !!armor && !loading)
  if(!armor&&loading)return <aside className="armor-detail-panel armor-detail-panel--state" role="status">正在读取防具详情…</aside>
  if(error)return <aside className="armor-detail-panel armor-detail-panel--state" role="alert"><p>{error}</p>{onRetry&&<button className="armor-detail-panel__retry" type="button" onClick={onRetry}>重试详情</button>}</aside>
  if(!armor)return <aside className="armor-detail-panel armor-detail-panel--state">{emptyMessage??'从左侧选择一件防具查看详情。'}</aside>
  const native=armor.gameId==='mhp2g'||armor.gameId==='mhp3',saveIdentities=native?[]:armor.saveIdentities
  const saveIdentity=saveIdentities.length===1?saveIdentities[0]:null
  return <aside className={`armor-detail-panel${loading?' armor-detail-panel--loading':''}${layout === 'embedded' ? ' armor-detail-panel--embedded' : ''}`} aria-busy={loading} aria-label={`${armor.nameCn}详情`}>
    {loading&&<span className="armor-detail-panel__updating">正在更新…</span>}
    <div {...scroll} className={`armor-detail-panel__scroll${layout === 'embedded' ? ' armor-detail-panel__scroll--embedded' : ''}`}>
      <section className="armor-detail-panel__craft"><header className="armor-detail-panel__header"><ArmorIcon path={armor.iconPath} name={armor.nameCn} size="large"/><div className="armor-detail-panel__names"><small className="armor-detail-panel__secondary">{part[armor.part]} · {native?armor.armorKey:`Dex #${armor.dexId} · 0x${armor.dexId.toString(16).toUpperCase()}`}</small><h2 className="armor-detail-panel__title">{armor.nameCn}</h2>{armor.nameEn&&<p className="armor-detail-panel__secondary">{armor.nameEn}</p>}{armor.nameJp&&<p className="armor-detail-panel__secondary">{armor.nameJp}</p>}{native&&<p className="armor-detail-panel__secondary">{(armor.nameSource==='official'||armor.nameSource==='gu-pass-02')?'官汉对应':'项目译名'}</p>}</div></header>
        {(!native||armor.price!=null)&&<div className="armor-detail-panel__price"><span>制作费用</span><strong className="armor-detail-panel__data">{armor.price==null?'—':`${armor.price} z`}</strong></div>}
        {native&&<p className="armor-detail-panel__acquisition">{armor.acquisition}{armor.gameId==='mhp3'&&armor.acquisitionSource.startsWith('wiki-')&&'（取得资料：P3 日文 Wiki）'}</p>}
        {saveIdentities.length>0&&<p className="armor-detail-panel__identity">存档映射：{saveIdentities.map(value=>`${value.saveType}:${value.saveId}`).join('、')}</p>}
      </section>
      {allowCatalogWrite && armor.gameId === 'mhp2g' && <DetailActionBar className="armor-detail-panel__actions"><CatalogWriteControl gameId="mhp2g" kind="equipment" {...p2gSaveIdentity(armor.armorKey)} /></DetailActionBar>}
    {allowCatalogWrite&&saveIdentities.length>1&&<p className="armor-detail-panel__mapping-warning" role="status">该防具有多个存档身份，已停止自动选择；请从修改器装备选择器中按身份确认后写入。</p>}
      {!native&&armor.mappingStatus==='foreign_variant'&&<p className="armor-detail-panel__mapping-warning" role="status">这是 Dex 收录的美版防具，不能按此条目的属性写入 MH4G 存档，也不参与 MH4G 自动配装。</p>}
      {armor.gameId==='mhp3'&&<p className="armor-detail-panel__acquisition">收录状态：{{obtainable:'正常可获取',special:'特殊用途',unknown:'取得未确认'}[armor.acquisitionStatus]} · 属性与制作采用本作原生资料</p>}
      <ArmorStatsPanel armor={armor}/>
      <ArmorSkillList skills={armor.skills} onSelectSkill={onSelectSkill}/>
      {native?<P2gArmorRecipeList<import('../../../api/catalog/p2gArmorTypes').P2gArmorRecipe | import('../../../api/catalog/p3ArmorTypes').P3ArmorRecipe> recipes={armor.recipes} onSelectItem={onSelectItem}/>:<ArmorMaterialList materials={armor.materials} onSelectItem={onSelectItem}/>}
    </div>
    {!native&&allowCatalogWrite&&saveIdentity&&<DetailActionBar className="armor-detail-panel__actions"><CatalogWriteControl gameId={armor.gameId} kind="equipment" saveType={saveIdentity.saveType} saveId={saveIdentity.saveId}/></DetailActionBar>}
  </aside>
}
