import { Search } from 'lucide-react'
import type { HunterArtCatalogFacets, HunterArtCatalogFilters, HunterArtUnlockKind } from '../../../api/catalog/types'
import { CatalogResetButton } from '../CatalogResetButton/CatalogResetButton'
import { SearchableSelect } from '../SearchableSelect/SearchableSelect'
import './HunterArtCatalogToolbar.css'

const unlockNames: Record<HunterArtUnlockKind, string> = {
  initial: '初始解锁',
  quest: '任务',
  hunterRank: '猎人等级',
  contribution: '村庄进度',
  palicoLevel: '随从等级',
  monster: '狩猎怪物',
  npc: 'NPC 对话',
  compound: '复合条件',
  other: '其他',
}

type Props = {
  query: string
  filters: HunterArtCatalogFilters
  facets: HunterArtCatalogFacets
  onQueryChange: (value: string) => void
  onChange: (key: 'weapon' | 'level' | 'unlock' | 'debug', value: string | undefined) => void
  onReset: () => void
}

export function HunterArtCatalogToolbar({ query, filters, facets, onQueryChange, onChange, onReset }: Props) {
  const field = (label: string, control: React.ReactNode) => (
    <label className="hunter-art-catalog-toolbar__field">
      <span className="hunter-art-catalog-toolbar__field-label">{label}</span>
      {control}
    </label>
  )

  return (
    <div className="hunter-art-catalog-toolbar">
      <label className="hunter-art-catalog-toolbar__search">
        <span className="sr-only">搜索狩技</span>
        <Search className="hunter-art-catalog-toolbar__search-icon" aria-hidden="true" />
        <input className="hunter-art-catalog-toolbar__search-input" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="狩技、说明或解锁任务" />
      </label>
      {field('武器', <SearchableSelect ariaLabel="筛选狩技武器类型" value={String(filters.weaponTypeId ?? '')} options={[{ value: '', label: '全部' }, ...facets.weaponTypes.map(value => ({ value: String(value.id), label: value.nameCn, keywords: [value.nameEn] }))]} onChange={value => onChange('weapon', value || undefined)} />)}
      {field('等级', <SearchableSelect ariaLabel="筛选狩技等级" value={filters.level == null ? '' : String(filters.level)} options={[{ value: '', label: '全部' }, { value: 'none', label: '无等级' }, ...facets.levels.map(value => ({ value: String(value), label: `等级 ${value}` }))]} onChange={value => onChange('level', value || undefined)} />)}
      {field('解锁', <SearchableSelect ariaLabel="筛选狩技解锁方式" value={filters.unlockKind ?? ''} options={[{ value: '', label: '全部' }, ...facets.unlockKinds.map(value => ({ value, label: unlockNames[value] }))]} onChange={value => onChange('unlock', value || undefined)} />)}
      <label className="hunter-art-catalog-toolbar__debug">
        <input className="hunter-art-catalog-toolbar__debug-input" type="checkbox" checked={filters.includePlaceholders ?? false} onChange={event => onChange('debug', event.target.checked ? '1' : undefined)} />
        <span>显示占位</span>
      </label>
      <CatalogResetButton onReset={onReset} />
    </div>
  )
}
