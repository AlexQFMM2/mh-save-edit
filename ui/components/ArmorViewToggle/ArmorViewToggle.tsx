import { List, PanelsTopLeft } from 'lucide-react'
import type { ArmorViewMode } from '../../../api/catalog/types'
import './ArmorViewToggle.css'

export function ArmorViewToggle({ value, onChange }: { value: ArmorViewMode; onChange: (value: ArmorViewMode) => void }) {
  return <div className="armor-view-toggle" aria-label="防具视图模式">
    <button type="button" aria-pressed={value === 'list'} onClick={() => onChange('list')}><List aria-hidden="true" />列表</button>
    <button type="button" aria-pressed={value === 'set'} onClick={() => onChange('set')}><PanelsTopLeft aria-hidden="true" />套装</button>
  </div>
}
