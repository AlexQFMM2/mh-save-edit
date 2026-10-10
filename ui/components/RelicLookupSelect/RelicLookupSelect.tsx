import { useMemo } from 'react'
import type { LoadoutRelicLookup } from '../../../api/loadout/types'
import { RelicSharpnessBar, getRelicSharpnessProfile } from '../RelicSharpnessBar/RelicSharpnessBar'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect/SearchableSelect'
import { relicLookupOptions } from './relicLookupOptions'
import './RelicLookupSelect.css'

type Props = {
  lookups: LoadoutRelicLookup[]
  domain: string
  saveType: number
  variant: string
  value: number
  ariaLabel: string
  onChange: (value: number) => void
}

export function RelicLookupSelect({ lookups, domain, saveType, variant, value, ariaLabel, onChange }: Props) {
  const options = useMemo(() => relicLookupOptions(lookups, domain, saveType, variant, value), [domain, lookups, saveType, value, variant])

  const showsSharpness = domain === 'sharpness' && variant === 'melee'
  const renderSharpness = (option: SearchableSelectOption, compact: boolean) => {
    const code = Number(option.value)
    return getRelicSharpnessProfile(code) ? <RelicSharpnessBar code={code} compact={compact} /> : option.label
  }

  return <SearchableSelect
    className={`relic-lookup-select${showsSharpness ? ' relic-lookup-select--sharpness' : ''}`}
    ariaLabel={ariaLabel}
    value={String(value)}
    options={options}
    renderValue={showsSharpness ? option => renderSharpness(option, true) : undefined}
    renderOption={showsSharpness ? option => renderSharpness(option, false) : undefined}
    onChange={next => onChange(Number(next))}
  />
}
