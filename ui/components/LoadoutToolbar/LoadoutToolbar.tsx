import { Download, History, LoaderCircle, Plus, RotateCcw, Save, Sparkles, Undo2, Upload } from 'lucide-react'
import type { LoadoutResult, LogicalLoadout } from '../../../api/loadout/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './LoadoutToolbar.css'

type Props = { loadout: LogicalLoadout; result: LoadoutResult; notice?: string; canUndo: boolean; activeJobCount: number; unreadJobCount: number; onUndo: () => void; onNameChange: (value: string) => void; onGenderChange: (value: 'male' | 'female') => void; onReset: () => void; onNew: () => void; onImport: (file: File) => void; onExport: () => void; onOpenAuto: () => void; onOpenHistory: () => void; onWriteToSave?: () => void }
const iconClass = 'loadout-toolbar__action-icon'

export function LoadoutToolbar({ loadout, result, notice, canUndo, activeJobCount, unreadJobCount, onUndo, onNameChange, onGenderChange, onReset, onNew, onImport, onExport, onOpenAuto, onOpenHistory, onWriteToSave }: Props) {
  return <header className="loadout-toolbar">
    <div className="loadout-toolbar__identity"><input className="loadout-toolbar__name" aria-label="配装名称" value={loadout.name} onChange={event => onNameChange(event.target.value)} /><span className="loadout-toolbar__status" data-state={result.legality}>{result.legality === 'confirmed' ? '自然合法' : result.legality === 'invalid' ? '存在风险' : '状态未知'}</span></div>
    <label className="loadout-toolbar__field"><span className="loadout-toolbar__field-label">性别</span><SearchableSelect ariaLabel="配装性别" value={loadout.gender} options={[{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }]} onChange={value => onGenderChange(value as 'male' | 'female')} /></label>
    <div className="loadout-toolbar__actions">
      <button className="loadout-toolbar__action" type="button" onClick={onUndo} disabled={!canUndo}><Undo2 className={iconClass} aria-hidden="true" />撤销</button>
      <button className="loadout-toolbar__action" type="button" onClick={onNew}><Plus className={iconClass} aria-hidden="true" />新建</button>
      <label className="loadout-toolbar__file"><Upload className={iconClass} aria-hidden="true" />导入<input className="loadout-toolbar__file-input" type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.currentTarget.value = '' }} /></label>
      <button className="loadout-toolbar__action" type="button" onClick={onExport}><Download className={iconClass} aria-hidden="true" />导出</button>
      <button className="loadout-toolbar__action loadout-toolbar__primary" type="button" onClick={onOpenAuto}><Sparkles className={iconClass} aria-hidden="true" />自动配装</button>
      <button className="loadout-toolbar__action loadout-toolbar__history" type="button" onClick={onOpenHistory} aria-label={`自动任务历史${activeJobCount ? `，${activeJobCount} 个任务正在运行` : ''}${unreadJobCount ? `，${unreadJobCount} 个未查看结果` : ''}`}><span className="loadout-toolbar__history-icon-wrap">{activeJobCount ? <LoaderCircle className={`${iconClass} loadout-toolbar__running-icon`} aria-hidden="true" /> : <History className={iconClass} aria-hidden="true" />}{unreadJobCount > 0 && <span className="loadout-toolbar__badge" aria-hidden="true">{Math.min(99, unreadJobCount)}</span>}</span>历史任务{activeJobCount > 0 && <span className="loadout-toolbar__active-count">{activeJobCount}</span>}</button>
      <button className="loadout-toolbar__action" type="button" onClick={onReset}><RotateCcw className={iconClass} aria-hidden="true" />重置</button>
    </div>
    {onWriteToSave&&<button type="button" className="loadout-toolbar__save-write" onClick={onWriteToSave}><Plus className={iconClass} aria-hidden="true" />一键加入装备箱</button>}<span className="loadout-toolbar__notice" aria-live="polite" title={notice}>{notice}</span><span className="loadout-toolbar__encoding"><Save className="loadout-toolbar__encoding-icon" aria-hidden="true" />{result.encoding === 'unsupported' ? '存档写入未支持' : result.encoding === 'encodable' ? '可编码' : '结构阻断'}</span>
  </header>
}
