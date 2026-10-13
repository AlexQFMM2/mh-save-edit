import { GitFork } from 'lucide-react'
import type { CatalogWeaponType } from '../../utils/catalogWeapon'
import './WeaponTreeTypePrompt.css'

export function WeaponTreeTypePrompt({ types, onSelect }: { types: CatalogWeaponType[]; onSelect: (typeId: number) => void }) {
  return <section className="weapon-tree-type-prompt"><GitFork aria-hidden="true" /><h2>选择一种武器查看派生路线</h2><p>派生画布一次展示一种武器类型，避免不同体系的路线混在一起。</p><div>{types.map((type) => <button type="button" key={type.typeId} onClick={() => onSelect(type.typeId)}>{type.nameCn}<small>{type.nameEn}</small></button>)}</div></section>
}
