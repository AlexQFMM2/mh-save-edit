import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PalicoSupportMoveDetail } from '../../../api/catalog/types'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { PalicoAbilityDetailPanel } from '../PalicoAbilityDetailPanel/PalicoAbilityDetailPanel'
import './PalicoSupportMoveDetailDrawer.css'

export function PalicoSupportMoveDetailDrawer({supportMoveId,onClose}:{supportMoveId:number|null;onClose:()=>void}){
  const navigate=useNavigate()
  const[detail,setDetail]=useState<PalicoSupportMoveDetail|null>(null)
  const[loading,setLoading]=useState(false)
  const[error,setError]=useState<string>()
  useEffect(()=>{if(supportMoveId==null)return;let active=true;setLoading(true);setError(undefined);void window.mhSaveEditor.catalog.getPalicoSupportMove({gameId:'mhgu',supportMoveId}).then(value=>{if(active)setDetail(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'支援行动读取失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[supportMoveId])
  if(supportMoveId==null)return null
  return <div className="palico-support-move-detail-drawer"><DetailDrawer title="支援行动详情" onClose={onClose}><PalicoAbilityDetailPanel kind="move" detail={detail} loading={loading} error={error} onSelectMonster={id=>{onClose();navigate(`/game/mhgu/catalog/monsters?target=${id}&monster=${id}`)}}/></DetailDrawer></div>
}
