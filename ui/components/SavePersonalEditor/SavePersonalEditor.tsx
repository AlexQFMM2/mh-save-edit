import { useEffect, useMemo, useState } from 'react'
import type { SaveField, SaveFieldValue, SavePersonalSection, SaveSessionSnapshot } from '../../../api/save/types'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './SavePersonalEditor.css'

const groups: { key: SaveField['group']; label: string }[] = [{ key: 'identity', label: '身份' }, { key: 'progress', label: '进度' }, { key: 'currency', label: '货币与点数' }, { key: 'version', label: '版本专属' }]

type SavePersonalEditorProps = {
  section: SavePersonalSection
  session: SaveSessionSnapshot
  busy: boolean
  onCommit(field: string, value: SaveFieldValue): Promise<void>
  onDraftValidityChange?: (invalid: boolean) => void
}

function validateField(field: SaveField, raw: string): string | null {
  const value = field.valueType === 'number' || field.valueType === 'select' ? Number(raw) : raw
  if (typeof value === 'number' && (!raw.trim() || !Number.isFinite(value) || (field.min != null && value < field.min) || (field.max != null && value > field.max))) return `${field.label}必须在 ${field.min ?? '有效下限'}～${field.max ?? '有效上限'} 范围内`
  if (typeof value === 'string' && !value.trim()) return `${field.label}不能为空`
  return null
}

export function SavePersonalEditor({ section, session, busy, onCommit, onDraftValidityChange }: SavePersonalEditorProps) {
  const initial = useMemo(() => Object.fromEntries(section.fields.map(field => [field.key, String(field.value)])), [section]); const [draft, setDraft] = useState(initial); const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => { setDraft(initial); setErrors({}) }, [initial])
  const invalidDraft = section.fields.some(field => field.writable && validateField(field, draft[field.key] ?? '') != null)
  useEffect(() => { onDraftValidityChange?.(invalidDraft) }, [invalidDraft, onDraftValidityChange])
  useEffect(() => () => onDraftValidityChange?.(false), [onDraftValidityChange])
  const commit = async (field: SaveField) => {
    const raw = draft[field.key] ?? ''; const value = field.valueType === 'number' || field.valueType === 'select' ? Number(raw) : raw
    const validation = validateField(field, raw)
    if (validation) { setErrors(current => ({ ...current, [field.key]: validation })); return }
    if (String(field.value) === String(value)) return
    try { await onCommit(field.key, value); setErrors(current => ({ ...current, [field.key]: '' })) } catch { /* Provider reports the error. */ }
  }
  const changeSelect = async (field: SaveField, value: string) => {
    const previous = draft[field.key] ?? String(field.value)
    setDraft(current => ({ ...current, [field.key]: value }))
    setErrors(current => ({ ...current, [field.key]: '' }))
    if (previous === value) return
    try { await onCommit(field.key, Number(value)) } catch { setDraft(current => ({ ...current, [field.key]: previous })) }
  }
  return <div className="save-personal-editor"><div className="save-personal-editor__fields">{groups.map(group => { const fields = section.fields.filter(field => field.group === group.key); return fields.length ? <section key={group.key}><h2>{group.label}</h2><div>{fields.map(field => <label key={field.key} className={errors[field.key] ? 'is-invalid' : ''}><span>{field.label}{!field.writable && <small>只读</small>}</span>{field.valueType === 'select' && field.options ? <SearchableSelect ariaLabel={field.label} disabled={!field.writable || busy} value={draft[field.key] ?? ''} options={field.options} onChange={value => void changeSelect(field, value)} /> : <span className="save-personal-editor__input"><input aria-label={field.label} type={field.valueType === 'number' ? 'number' : 'text'} value={draft[field.key] ?? ''} min={field.min} max={field.max} readOnly={!field.writable} disabled={busy} onChange={event => setDraft(current => ({ ...current, [field.key]: event.target.value }))} onBlur={() => void commit(field)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void commit(field) } }} />{field.unit && <em>{field.unit}</em>}</span>}<span className="save-personal-editor__field-note">{errors[field.key] || field.diagnostic?.message || (field.min != null ? `编码范围 ${field.min}～${field.max}` : '失焦或按 Enter 提交')}</span></label>)}</div></section> : null })}</div><aside><h2>当前会话</h2><dl><dt>内容版本</dt><dd>{session.contentGameId.toUpperCase()}</dd><dt>环境</dt><dd>{session.emulator.toUpperCase()} / {session.platform.toUpperCase()}</dd><dt>角色</dt><dd>{session.characterName || '—'}</dd><dt>状态</dt><dd>{session.readOnly ? '只读保护' : session.dirty ? '有未保存修改' : '已同步'}</dd><dt>撤销 / 重做</dt><dd>{session.undoCount} / {session.redoCount}</dd></dl>{session.diagnostics.map(issue => <p key={`${issue.code}-${issue.path}`} className={`save-personal-editor__diagnostic is-${issue.severity}`}>{issue.message}</p>)}</aside></div>
}
