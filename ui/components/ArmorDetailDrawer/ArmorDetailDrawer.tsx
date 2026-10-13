import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { ArmorIdentity } from '../../../api/catalog/types'
import type { P2gArmorIdentity } from '../../../api/catalog/p2gArmorTypes'
import type { GameId } from '../../../api/core/loadout'
import { getCatalogArmor, type CatalogArmorDetail } from '../../utils/catalogArmor'
import { ArmorDetailPanel } from '../ArmorDetailPanel/ArmorDetailPanel'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import './ArmorDetailDrawer.css'

type Props={onClose():void}&({gameId:GameId;armorDexId:number|null;identity?:never}|{identity:ArmorIdentity|P2gArmorIdentity|null;gameId?:never;armorDexId?:never})
export function ArmorDetailDrawer(props:Props) {
  const {onClose}=props,navigate=useNavigate()
  const identity=props.gameId?(props.armorDexId==null?null:{gameId:props.gameId,dexId:props.armorDexId}):props.identity
  const gameId=identity?.gameId,key=identity?(identity.gameId==='mhp2g'?identity.armorKey:identity.dexId):null
  const [armor,setArmor]=useState<CatalogArmorDetail|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string>()
  useEffect(()=>{
    let active=true;setArmor(null);setError(undefined)
    if(gameId==null||key==null)return
    setLoading(true)
    if(!window.mhSaveEditor?.catalog){setError('图鉴 API 尚未连接。');setLoading(false);return}
    void getCatalogArmor(gameId,key).then(value=>{if(active)setArmor(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'防具详情读取失败')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[gameId,key])
  if(!identity)return null
  const go=(path:string)=>{onClose();navigate(path)}
  return createPortal(<div className="armor-detail-drawer"><DetailDrawer title="关联防具" onClose={onClose}><ArmorDetailPanel armor={armor} loading={loading} error={error} allowCatalogWrite={false} onSelectItem={id=>go(`/game/${gameId}/catalog/items?target=${id}&item=${id}`)} onSelectSkill={id=>go(`/game/${gameId}/catalog/skills?target=${id}&skill=${id}`)}/></DetailDrawer></div>,document.body)
}
