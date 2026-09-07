import { LockKeyhole } from 'lucide-react'
import type { WeaponAttribute } from '../../../api/catalog/types'
import './WeaponAttributeList.css'

export function WeaponAttributeList({ attributes, compact = false }: { attributes: WeaponAttribute[]; compact?: boolean }) {
  if (!attributes.length) return <span className="weapon-attribute-list weapon-attribute-list--empty">无属性</span>
  return <span className={`weapon-attribute-list${compact ? ' weapon-attribute-list--compact' : ''}`}>{attributes.map((attribute, index) => <span key={`${attribute.attributeId}-${index}`} className={`weapon-attribute-list__item weapon-attribute-list__item--${attributeColor(attribute.kind)}`} title={`${attribute.nameCn} ${attribute.value}${attribute.isHidden ? '（觉醒）' : ''}`}>
    {attribute.isHidden && <LockKeyhole aria-hidden="true" />}<span>{attribute.nameCn}</span><strong>{attribute.value}</strong>{attribute.isHidden && <span className="weapon-attribute-list__hidden-text">觉醒</span>}
  </span>)}</span>
}

function attributeColor(kind: string): string {
  return ({ fire: 'fire', wat: 'water', thun: 'thunder', ice: 'ice', dra: 'dragon', pois: 'poison', para: 'paralysis', sleep: 'sleep', blast: 'blast' } as Record<string, string>)[kind] ?? 'neutral'
}
