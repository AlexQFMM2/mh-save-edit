import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DecorationDetail } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { DecorationDetailPanel } from '../DecorationDetailPanel/DecorationDetailPanel'
import './DecorationDetailDrawer.css'
type Props = { gameId: GameId; decorationSaveId: number | null; onClose: () => void }
export function DecorationDetailDrawer({ gameId, decorationSaveId, onClose }: Props) { const navigate=useNavigate();const[item,setItem]=useState<DecorationDetail|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState<string>();useEffect(()=>{if(decorationSaveId==null)return;let active=true;setLoading(true);setError(undefined);setItem(null);const api=window.mhSaveEditor?.catalog;if(!api){setError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setLoading(false);return()=>{active=false}}void api.getDecoration({gameId,saveId:decorationSaveId}).then(result=>{if(active)setItem(result)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'装饰品详情读取失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[gameId,decorationSaveId]);if(decorationSaveId==null)return null;const go=(path:string)=>{onClose();navigate(path)};return <div className="decoration-detail-drawer"><DetailDrawer title="关联装饰品" onClose={onClose}><DecorationDetailPanel item={item} loading={loading} error={error} onSelectMaterial={material=>go(`/game/${gameId}/catalog/items?target=${material.saveId}&item=${material.saveId}`)} onSelectSkill={skillId=>go(`/game/${gameId}/catalog/decorations?skill=${skillId}&sort=skillPoints`)}/></DetailDrawer></div> }
