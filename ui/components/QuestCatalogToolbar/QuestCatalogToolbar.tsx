import { Search } from 'lucide-react'
import type { QuestCatalogFacets, QuestCatalogFilters } from '../../../api/catalog/types'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './QuestCatalogToolbar.css'

type FilterKey = 'system' | 'level' | 'rank' | 'type' | 'map' | 'key' | 'availability' | 'debug'
type Props = {
  query: string
  filters: QuestCatalogFilters
  facets: QuestCatalogFacets
  showAvailability: boolean
  onQueryChange: (value: string) => void
  onChange: (key: FilterKey, value: string | undefined) => void
  onReset: () => void
}

const rankNames = { low: '下位', high: '上位', g: 'G 位', other: '其他' }

export function QuestCatalogToolbar({ query, filters, facets, showAvailability, onQueryChange, onChange, onReset }: Props) {
  const field = (label: string, control: React.ReactNode) => (
    <label className="quest-catalog-toolbar__field">
      <span className="quest-catalog-toolbar__field-label">{label}</span>
      {control}
    </label>
  )

  return (
    <div className="quest-catalog-toolbar">
      <label className="quest-catalog-toolbar__search">
        <span className="sr-only">搜索任务</span>
        <Search className="quest-catalog-toolbar__search-icon" aria-hidden="true" />
        <input className="quest-catalog-toolbar__search-input" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="任务、目标、怪物、奖励或狩技" />
      </label>
      {field('体系', <SearchableSelect ariaLabel="筛选任务体系" value={filters.system ?? ''} options={[{ value: '', label: '全部' }, ...facets.systems.map(value => ({ value: value.key, label: value.nameCn }))]} onChange={value => onChange('system', value || undefined)} />)}
      {field('等级', <SearchableSelect ariaLabel="筛选任务等级" value={String(filters.levelId ?? '')} options={[{ value: '', label: '全部' }, ...facets.levels.map(value => ({ value: String(value.id), label: value.nameCn }))]} onChange={value => onChange('level', value || undefined)} />)}
      {field('位阶', <SearchableSelect ariaLabel="筛选任务位阶" value={filters.rank ?? ''} options={[{ value: '', label: '全部' }, ...facets.ranks.map(value => ({ value, label: rankNames[value] }))]} onChange={value => onChange('rank', value || undefined)} />)}
      {field('类型', <SearchableSelect ariaLabel="筛选任务类型" value={String(filters.questTypeId ?? '')} options={[{ value: '', label: '全部' }, ...facets.questTypes.map(value => ({ value: String(value.id), label: value.nameCn }))]} onChange={value => onChange('type', value || undefined)} />)}
      {field('地图', <SearchableSelect ariaLabel="筛选任务地图" value={String(filters.locationId ?? '')} options={[{ value: '', label: '全部' }, ...facets.locations.map(value => ({ value: String(value.id), label: value.nameCn }))]} onChange={value => onChange('map', value || undefined)} />)}
      {field('状态', <SearchableSelect ariaLabel="筛选关键任务" value={filters.keyStatus ?? ''} options={[{ value: '', label: '全部' }, { value: 'normal', label: '普通' }, { value: 'key', label: '关键' }, { value: 'urgent', label: '紧急' }]} onChange={value => onChange('key', value || undefined)} />)}
      {showAvailability && field('版本', <SearchableSelect ariaLabel="筛选任务版本" value={filters.availability ?? ''} options={[{ value: '', label: '全部' }, ...facets.availabilities.map(value => ({ value, label: value === 'common' ? '共通' : value === 'mhgu' ? 'MHGU' : 'MHXX' }))]} onChange={value => onChange('availability', value || undefined)} />)}
      <label className="quest-catalog-toolbar__debug">
        <input className="quest-catalog-toolbar__debug-input" type="checkbox" checked={filters.includePlaceholders ?? false} onChange={event => onChange('debug', event.target.checked ? '1' : undefined)} />
        <span>显示占位</span>
      </label>
      <CatalogResetButton onReset={onReset} />
    </div>
  )
}
