import { ArmorDetailDrawer } from '../ArmorDetailDrawer/ArmorDetailDrawer'
import { DecorationDetailDrawer } from '../DecorationDetailDrawer/DecorationDetailDrawer'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { P2gSkillEquipmentDetail } from '../../../api/catalog/p2gSkillTypes'
import { itemNumber } from '../../../api/catalog/itemIdentity'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { P2gSkillEquipmentPanel } from '../P2gSkillEquipmentPanel/P2gSkillEquipmentPanel'
import './P2gSkillEquipmentDrawer.css'
export function P2gSkillEquipmentDrawer({equipmentKey,onClose}:{equipmentKey:string|null;onClose:()=>void}) {
  const [equipment,setEquipment]=useState<P2gSkillEquipmentDetail|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string>();const navigate=useNavigate()
  useEffect(()=>{let active=true;setEquipment(null);setError(undefined);if(!equipmentKey||equipmentKey.startsWith('armor_'))return;setLoading(true);const api=window.mhSaveEditor?.catalog;if(!api){setError('图鉴 API 尚未连接。');setLoading(false);return}void api.getP2gSkillEquipment({gameId:'mhp2g',equipmentKey}).then(value=>{if(active)setEquipment(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'装备资料读取失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[equipmentKey])
  if(!equipmentKey)return null
  if(equipmentKey.startsWith('armor_'))return <ArmorDetailDrawer identity={{gameId:'mhp2g',armorKey:equipmentKey}} onClose={onClose}/>
  if(equipment?.decorationItemId!=null)return <DecorationDetailDrawer identity={{gameId:'mhp2g',itemId:equipment.decorationItemId}} onClose={onClose}/>
  const go=(path:string)=>{onClose();navigate(path)}
  return createPortal(<div className="p2g-skill-equipment-drawer"><DetailDrawer title="关联装备技能资料" onClose={onClose}><P2gSkillEquipmentPanel equipment={equipment} loading={loading} error={error} onSelectSkill={id=>go(`/game/mhp2g/catalog/skills?target=${id}&skill=${id}`)} onSelectItem={item=>go(`/game/${item.gameId}/catalog/items?target=${itemNumber(item)}&item=${itemNumber(item)}`)}/></DetailDrawer></div>,document.body)
}
