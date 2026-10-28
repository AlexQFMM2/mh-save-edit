import type { ItemIdentity } from '../../../api/catalog/types'
import type { P3ItemLink } from '../../../api/catalog/p3ItemTypes'
import type { P3WeaponDetail as Weapon, P3WeaponLink } from '../../../api/catalog/p3WeaponTypes'
import { DetailSection } from '../DetailSection/DetailSection'
import { DetailStatGrid } from '../DetailStatGrid/DetailStatGrid'
import { P3HuntingHornDetail } from '../P3HuntingHornDetail/P3HuntingHornDetail'
import { P3WeaponRecipeList } from '../P3WeaponRecipeList/P3WeaponRecipeList'
import './P3WeaponDetail.css'

type Props = { weapon: Weapon; onSelectItem?: (item: ItemIdentity)=>void; onSelectWeapon?: (weapon:P3WeaponLink)=>void }
export function P3WeaponDetail({ weapon:w, onSelectItem, onSelectWeapon }: Props) {
  const s = w.special
  const item = (value: P3ItemLink | undefined, id: number) => <button className="p3-weapon-detail__link" type="button" disabled={!onSelectItem || !value} onClick={()=>onSelectItem?.({gameId:'mhp3',itemId:id})}>{value?.nameCn || value?.nameJp || `道具 ${id}`}</button>
  return <>
    <DetailSection title={s.kind==='bowgun'?'攻击强化与部件':'攻击强化'} className="p3-weapon-detail">
      <div className="p3-weapon-detail__table-wrap"><table className="p3-weapon-detail__table" aria-label="基础与强化攻击对照"><thead><tr>{s.kind==='bowgun' && <th>配置</th>}<th>基础攻击</th><th>强化后</th><th>{s.kind==='bowgun'?'部件费用':'强化费用'}</th></tr></thead><tbody>
        <tr>{s.kind==='bowgun' && <th>无部件</th>}<td>{w.displayAttack}</td><td>{w.boost.attack}</td><td>{s.kind==='bowgun'?'—':`${w.boost.cost.toLocaleString()} z`}</td></tr>
        {s.kind==='bowgun' && s.attachments.map(a=><tr key={a.kind}><th>{a.name}</th><td>{a.baseAttack}</td><td>{a.boostedAttack}</td><td>{a.cost.toLocaleString()} z</td></tr>)}
      </tbody></table></div>
      <p className="p3-weapon-detail__hint">攻击强化：<span className="p3-weapon-detail__data">{w.boost.cost.toLocaleString()} z</span> · {item(w.boost.material.item,w.boost.material.itemId)} <span className="p3-weapon-detail__data">× {w.boost.material.quantity}</span>。列表、排序与派生节点显示基础攻击。</p>
      {s.kind==='bowgun' && <><p className="p3-weapon-detail__hint">{s.weaponKind==='light'?'长枪管与消音器互斥':'强力枪管与盾牌互斥'}；瞄准镜可另行安装。表中费用为各部件费用，未包含武具玉强化费。</p><ul className="p3-weapon-detail__notes">{s.attachments.map(a=><li key={a.kind}>{a.name}：{a.effect}</li>)}</ul></>}
    </DetailSection>
    {s.kind==='switchAxe' && <DetailSection title="斩击斧瓶"><DetailStatGrid items={[{label:'瓶类型',value:s.phialName},{label:'瓶属性值',value:s.phialValue??'—'},...(s.swordAttributeValue==null?[]:[{label:'剑模式属性',value:s.swordAttributeValue}])]} /><p className="p3-weapon-detail__hint">瓶属性仅在对应剑模式生效，未计入基础属性栏；数值来自 P3 Wiki。</p></DetailSection>}
    {s.kind==='gunlance' && <DetailSection title="炮击"><DetailStatGrid items={[{label:'类型',value:s.shellingType},{label:'等级',value:s.level}]}/></DetailSection>}
    {s.kind==='huntingHorn' && <P3HuntingHornDetail key={w.weaponKey} special={s}/>}
    {s.kind==='bowgun' && <DetailSection title="弩参数与弹药" className="p3-weapon-detail">
      <DetailStatGrid items={[{label:'装填',value:s.reload},{label:'反动',value:s.recoil},{label:'偏移',value:s.deviation}]}/>
      <p className="p3-weapon-detail__hint">弹药与速射／蹲射参数来自 P3 Wiki。“需技能”不计入基础可用弹药。</p>
      <div className="p3-weapon-detail__table-wrap"><table className="p3-weapon-detail__table" aria-label="弩弹装填表"><thead><tr><th>弹药</th><th>基础装填</th><th>追加技能后</th></tr></thead><tbody>{s.ammo.map(a=><tr key={a.itemId}><th>{item(a.item,a.itemId)}</th><td>{a.available?a.capacity:'不可用'}</td><td>{a.requiresSkill?`${a.skillCapacity}（需技能）`:'—'}</td></tr>)}</tbody></table></div>
      {s.weaponKind==='light' ? <><h4 className="p3-weapon-detail__heading">速射</h4>{!s.rapidFire.length && <p className="p3-weapon-detail__hint">无速射弹种</p>}{s.rapidFire.map(a=><div className="p3-weapon-detail__entry" key={a.itemId}>{item(a.item,a.itemId)}<span className="p3-weapon-detail__data">{a.shots} 连发 · 硬直 {a.recoil}</span><small className="p3-weapon-detail__hint">每发补正（独立资料）：{a.multiplierText??'未收录'}</small></div>)}</> : <><h4 className="p3-weapon-detail__heading">蹲射</h4>{!s.crouchFire.length && <p className="p3-weapon-detail__hint">无蹲射弹种</p>}{s.crouchFire.map(a=><div className="p3-weapon-detail__entry" key={a.itemId}>{item(a.item,a.itemId)}<span className="p3-weapon-detail__data">蹲射 {a.capacity} 发</span></div>)}</>}
    </DetailSection>}
    {s.kind==='bow' && <DetailSection title="弓蓄力与瓶" className="p3-weapon-detail"><DetailStatGrid items={[{label:'曲射',value:s.arcType}]}/><div className="p3-weapon-detail__table-wrap"><table className="p3-weapon-detail__table" aria-label="弓蓄力表"><thead><tr><th>蓄力段</th><th>箭型</th><th>使用条件</th></tr></thead><tbody>{s.charges.map(c=><tr key={c.level}><th>{c.level}</th><td>{c.shotLevel==null?'—':`${c.typeCode} Lv.${c.shotLevel}`}</td><td>{c.requiresLoadUp?'需装填数 UP':c.available?'基础可用':'不可用'}</td></tr>)}</tbody></table></div>
      <h4 className="p3-weapon-detail__heading">瓶</h4>{s.coatings.map(c=><div className="p3-weapon-detail__entry" key={c.itemId}>{item(c.item,c.itemId)}<span className={c.available?'p3-weapon-detail__data':'p3-weapon-detail__hint'}>{c.available?(c.enhanced?'可用 · 强化':'可用'):'不可用'}</span></div>)}<p className="p3-weapon-detail__hint">箭型、追加蓄力段与瓶资料来自 P3 Wiki。</p>
    </DetailSection>}
    <P3WeaponRecipeList recipes={w.recipes} onSelectItem={onSelectItem} onSelectWeapon={onSelectWeapon}/>
    <DetailSection title="取得与资料来源" className="p3-weapon-detail"><p className="p3-weapon-detail__hint">{w.acquisition}</p><p className="p3-weapon-detail__hint">完整任务解锁条件尚未收录。译名：{w.nameSource.startsWith('GU')?'GU 简中用词':w.nameSource}；基础属性、攻击强化与斩味采用 P3 原生资料，专属参数的独立来源见各区说明。</p></DetailSection>
  </>
}
