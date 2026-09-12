import type { ArmorDetail } from '../../../api/catalog/types'
import { ArmorIcon } from '../ArmorIcon/ArmorIcon'
import { ArmorMaterialList } from '../ArmorMaterialList/ArmorMaterialList'
import { ArmorSkillList } from '../ArmorSkillList/ArmorSkillList'
import { ArmorStatsPanel } from '../ArmorStatsPanel/ArmorStatsPanel'
import { CatalogWriteControl } from '../CatalogWriteControl/CatalogWriteControl'
import { DetailActionBar } from '../DetailActionBar/DetailActionBar'
import './ArmorDetailPanel.css'

const part={head:'头部',chest:'胸部',arms:'腕部',waist:'腰部',legs:'腿部'}
export function ArmorDetailPanel({ armor, loading, error, allowCatalogWrite = true, onSelectItem, onSelectSkill }: { armor: ArmorDetail|null; loading: boolean; error?: string; allowCatalogWrite?: boolean; onSelectItem?: (saveId:number)=>void; onSelectSkill?: (skillId:number)=>void }) {
  if(!armor&&loading)return <aside className="armor-detail-panel armor-detail-panel--state" role="status">正在读取防具详情…</aside>
  if(!armor&&error)return <aside className="armor-detail-panel armor-detail-panel--state" role="alert">{error}</aside>
  if(!armor)return <aside className="armor-detail-panel armor-detail-panel--state">从左侧选择一件防具查看详情。</aside>
  const saveIdentity=armor.saveIdentities.length===1?armor.saveIdentities[0]:null
  return <aside className={`armor-detail-panel${loading?' armor-detail-panel--loading':''}`} aria-busy={loading} aria-label={`${armor.nameCn}详情`}>
    {loading&&<span className="armor-detail-panel__updating">正在更新…</span>}
    <div className="armor-detail-panel__scroll">
      <section className="armor-detail-panel__craft"><header><ArmorIcon path={armor.iconPath} name={armor.nameCn} size="large"/><div><small>{part[armor.part]} · Dex #{armor.dexId} · 0x{armor.dexId.toString(16).toUpperCase()}</small><h2>{armor.nameCn}</h2><p>{armor.nameEn}</p>{armor.nameJp&&<p>{armor.nameJp}</p>}</div></header><div className="armor-detail-panel__price"><span>制作费用</span><strong>{armor.price==null?'—':`${armor.price} z`}</strong></div>{armor.saveIdentities.length>0&&<p className="armor-detail-panel__identity">存档映射：{armor.saveIdentities.map(value=>`${value.saveType}:${value.saveId}`).join('、')}</p>}</section>
      {allowCatalogWrite&&armor.saveIdentities.length>1&&<p className="armor-detail-panel__mapping-warning" role="status">该防具有多个存档身份，已停止自动选择；请从修改器装备选择器中按身份确认后写入。</p>}
      <ArmorStatsPanel armor={armor}/>
      <ArmorSkillList skills={armor.skills} onSelectSkill={onSelectSkill}/>
      <ArmorMaterialList materials={armor.materials} onSelectItem={onSelectItem}/>
    </div>
    {allowCatalogWrite&&saveIdentity&&<DetailActionBar className="armor-detail-panel__actions"><CatalogWriteControl gameId={armor.gameId} kind="equipment" saveType={saveIdentity.saveType} saveId={saveIdentity.saveId}/></DetailActionBar>}
  </aside>
}
