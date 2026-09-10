import { useMemo } from 'react'
import type { LoadoutRelicLookup } from '../../../api/loadout/types'
import { RelicSharpnessBar, getRelicSharpnessProfile } from '../RelicSharpnessBar/RelicSharpnessBar'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect/SearchableSelect'
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

const attributeNames = ['无', '火', '水', '雷', '龙', '冰', '毒', '麻痹', '睡眠', '爆破']
const sharpnessColorNames = ['红', '橙', '黄', '绿', '蓝', '白', '紫']
const simpleTranslations: Record<string, string> = {
  None: '无', '(Nothing)': '无', Power: '强击', Element: '属性', Paralysis: '麻痹',
  Dragon: '灭龙', Exhaust: '减气', Poison: '毒', Impact: '榴弹', Attack: '攻击',
  Defense: '防御', Life: '生命吸收', Cutting: '切断', Blunt: '打击',
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function number(value: unknown) { return Number.isFinite(Number(value)) ? Number(value) : 0 }
function firstNumber(value: string) { return Number(value.match(/[-+]?\d+(?:\.\d+)?/)?.[0] ?? 0) }

function numericSortKey(domain: string, variant: string, code: number, nameCn: string): number[] | null {
  if (domain === 'attack_tier') {
    const [attack = '', affinity = '', defense = ''] = nameCn.split('|')
    return [firstNumber(attack), firstNumber(affinity), firstNumber(defense), code]
  }
  if (domain === 'attribute_value' || domain === 'status_value' || domain === 'relic_defense') return [firstNumber(nameCn), code]
  if (domain === 'slots' || domain === 'rarity' || domain === 'upgrade' || domain === 'polish_requirement' || (domain === 'kinsect' && variant === 'level')) return [code]
  if (domain === 'weapon_special' && ['attack_boost', 'defense_boost', 'affinity_boost'].includes(variant)) return [firstNumber(nameCn), code]
  return null
}

function compareKeys(left: number[] | null, right: number[] | null) {
  if (!left || !right) return 0
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

function displayName(domain: string, variant: string, code: number, nameCn: string, ordinal: number) {
  if (domain === 'attribute_type') return attributeNames[code] ?? nameCn
  if (domain === 'slots') return `${code} 孔`
  if (domain === 'rarity') return `稀有度 ${code + 1}`
  if (domain === 'upgrade') return code === 0 ? '未强化' : `强化阶段 ${code}`
  if (domain === 'polish_requirement') return code === 0 ? '无需研磨材料' : `研磨要求 ${code}`
  if (domain === 'honing') return simpleTranslations[nameCn] ?? nameCn
  if (domain === 'kinsect' && variant === 'level') return `猎虫等级 ${code}`
  if (domain === 'sharpness') {
    const noun = variant === 'bow' ? '弓配置' : variant.includes('bowgun') ? '弹匣配置' : '斩味配置'
    return `${noun} ${ordinal + 1}`
  }
  if (domain === 'weapon_special' && /^0x[0-9a-f]+$/i.test(nameCn)) {
    return `${variant === 'available_shots' ? '弹药方案' : '专项方案'} ${ordinal + 1}`
  }
  if (domain === 'attack_tier') {
    const [attack, affinity, defense, deviation] = nameCn.split('|').map(part => part.trim())
    return [
      `攻击 ${attack || '—'}`,
      affinity && `会心 ${affinity}`,
      defense && `防御 ${defense.replace(/^DEF/i, '')}`,
      deviation && deviation !== 'None' && `偏移 ${simpleTranslations[deviation] ?? deviation}`,
    ].filter(Boolean).join(' · ')
  }
  if (domain === 'relic_defense') return `防御 ${nameCn}`
  if (domain === 'relic_resistance') return nameCn.replace(/Fi/gi, '火').replace(/Wa/gi, '水').replace(/Th/gi, '雷').replace(/Ic/gi, '冰').replace(/Dr/gi, '龙')
  if (domain === 'weapon_special') {
    const translated = simpleTranslations[nameCn]
    if (translated) return translated
    return nameCn.replace(/^RAW/i, '攻击').replace(/^DEF/i, '防御').replace(/^Affinity/i, '会心')
  }
  return simpleTranslations[nameCn] ?? nameCn
}

export function RelicLookupSelect({ lookups, domain, saveType, variant, value, ariaLabel, onChange }: Props) {
  const options = useMemo(() => {
    const matched = lookups
      .filter(item => item.kind === 'equipment_lookup' && text(item.payload.domain) === domain && number(item.payload.save_type) === saveType && text(item.payload.variant) === variant)
      .sort((left, right) => number(left.payload.code) - number(right.payload.code))
    const values = matched.map((item, ordinal) => {
      const code = number(item.payload.code)
      const nameCn = text(item.payload.name_cn)
      const nameEn = text(item.payload.name_en)
      const sharpness = domain === 'sharpness' && variant === 'melee' ? getRelicSharpnessProfile(code) : null
      const sharpnessKeywords = sharpness
        ? sharpness.lengths.flatMap((length, index) => length > 0 ? [sharpnessColorNames[index], `${sharpnessColorNames[index]} ${length}`] : []).concat(sharpness.provisional ? ['特殊', '推定映射'] : [])
        : []
      const option: SearchableSelectOption = { value: String(code), label: sharpness?.label ?? displayName(domain, variant, code, nameCn, ordinal), keywords: [nameCn, nameEn, String(code), ...sharpnessKeywords] }
      return { option, sortKey: numericSortKey(domain, variant, code, nameCn) }
    }).sort((left, right) => compareKeys(left.sortKey, right.sortKey)).map(item => item.option)
    if (!values.some(option => option.value === String(value))) values.unshift({ value: String(value), label: '当前参数未识别（保持原样）' })
    return values
  }, [domain, lookups, saveType, value, variant])

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
