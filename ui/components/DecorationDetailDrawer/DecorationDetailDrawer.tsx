import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { DecorationDetail, DecorationIdentity } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { decorationIdentity, decorationNumber } from '../../../api/catalog/decorationIdentity'
import { itemNumber } from '../../../api/catalog/itemIdentity'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { DecorationDetailPanel } from '../DecorationDetailPanel/DecorationDetailPanel'
import './DecorationDetailDrawer.css'
type Props = { onClose:()=>void } & ({ identity:DecorationIdentity|null;gameId?:never;decorationSaveId?:never } | {gameId:GameId;decorationSaveId:number|null;identity?:never})
export function DecorationDetailDrawer(props:Props) {
  const {onClose}=props,identity=props.gameId?(props.decorationSaveId==null?null:decorationIdentity(props.gameId,props.decorationSaveId)):props.identity
  const gameId=identity?.gameId,id=identity?decorationNumber(identity):null,navigate=useNavigate()
  const [item,setItem]=useState<DecorationDetail|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState<string>(),[retry,setRetry]=useState(0)
  useEffect(()=>{
    let active=true;setItem(null);setError(undefined)
    if(gameId==null||id==null){setLoading(false);return}
    setLoading(true);const api=window.mhSaveEditor?.catalog
    if(!api){setError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setLoading(false);return}
    void api.getDecoration(decorationIdentity(gameId,id)).then(result=>{if(active)setItem(result)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'装饰品详情读取失败')}).finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[gameId,id,retry])
  if(!identity)return null
  const go=(path:string)=>{onClose();navigate(path)}
  const content=<div className="decoration-detail-drawer"><DetailDrawer title="关联装饰品" onClose={onClose}>
    <DecorationDetailPanel item={item} loading={loading} error={error} onRetry={()=>setRetry(n=>n+1)} allowCatalogWrite={false}
      onSelectMaterial={material=>go(`/game/${material.gameId}/catalog/items?target=${itemNumber(material)}&item=${itemNumber(material)}`)}
      onSelectItem={target=>go(`/game/${target.gameId}/catalog/items?target=${itemNumber(target)}&item=${itemNumber(target)}`)}
      onSelectSkill={skillId=>go(`/game/${gameId}/catalog/skills?target=${skillId}&skill=${skillId}`)}/>
  </DetailDrawer></div>
  return (gameId==='mhp2g'||gameId==='mhp3')?createPortal(content,document.body):content
}
