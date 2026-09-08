import { Search } from 'lucide-react'
import './MonsterSearchInput.css'

export function MonsterSearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="monster-search-input"><Search aria-hidden="true"/><span className="monster-search-input__label">搜索怪物</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="名称或 ID" aria-label="搜索怪物名称或 ID"/></label>
}
