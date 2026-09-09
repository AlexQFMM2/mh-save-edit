import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ArmorDetail } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { ArmorDetailPanel } from '../ArmorDetailPanel/ArmorDetailPanel'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import './ArmorDetailDrawer.css'

export function ArmorDetailDrawer({ gameId, armorDexId, onClose }: { gameId: GameId; armorDexId: number|null; onClose:()=>void }){const navigate=useNavigate();const[armor,setArmor]=useState<ArmorDetail|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState<string>();useEffect(()=>{if(armorDexId==null)return;let active=true;setLoading(true);setError(undefined);const api=window.mhSaveEditor?.catalog;if(!api){setError('图鉴 API 尚未连接，请在 Electron 应用中打开。');setLoading(false);return}void api.getArmor({gameId,dexId:armorDexId}).then(value=>{if(active)setArmor(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'防具详情读取失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[gameId,armorDexId]);if(armorDexId==null)return null;const go=(path:string)=>{onClose();navigate(path)};return <div className="armor-detail-drawer"><DetailDrawer title="关联防具" onClose={onClose}><ArmorDetailPanel armor={armor} loading={loading} error={error} onSelectItem={saveId=>go(`/game/${gameId}/catalog/items?target=${saveId}&item=${saveId}`)} onSelectSkill={skillId=>go(`/game/${gameId}/catalog/skills?target=${skillId}&skill=${skillId}`)}/></DetailDrawer></div>}
