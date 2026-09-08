import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { QuestDetail } from '../../../api/catalog/types'
import type { GameId } from '../../../api/core/loadout'
import { DetailDrawer } from '../DetailDrawer/DetailDrawer'
import { QuestDetailPanel } from '../QuestDetailPanel/QuestDetailPanel'
import './QuestDetailDrawer.css'
export function QuestDetailDrawer({gameId,questKey,onClose}:{gameId:GameId;questKey:string|null;onClose:()=>void}){const navigate=useNavigate();const[quest,setQuest]=useState<QuestDetail|null>(null);const[loading,setLoading]=useState(false);const[error,setError]=useState<string>();useEffect(()=>{if(!questKey)return;let active=true;setLoading(true);setError(undefined);window.mhSaveEditor.catalog.getQuest({gameId,questKey}).then(value=>{if(active)setQuest(value)}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'任务详情读取失败')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[gameId,questKey]);if(!questKey)return null;return <div className="quest-detail-drawer"><DetailDrawer title="任务详情" onClose={onClose}><QuestDetailPanel quest={quest} loading={loading} error={error} onSelectMonster={monsterId=>{onClose();navigate(`/game/${gameId}/catalog/monsters?target=${monsterId}&monster=${monsterId}&tab=weakness`)}}/></DetailDrawer></div>}
