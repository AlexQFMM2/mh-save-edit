import { GitFork, List } from 'lucide-react'
import type { WeaponViewMode } from '../../../api/catalog/types'
import './WeaponViewToggle.css'

export function WeaponViewToggle({ value, onChange }: { value: WeaponViewMode; onChange: (value: WeaponViewMode) => void }) {
  return <div className="weapon-view-toggle" aria-label="武器图鉴视图">
    <button type="button" aria-pressed={value === 'list'} onClick={() => onChange('list')}><List aria-hidden="true" />列表</button>
    <button type="button" aria-pressed={value === 'tree'} onClick={() => onChange('tree')}><GitFork aria-hidden="true" />派生</button>
  </div>
}
