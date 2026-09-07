import { useId, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ItemRelation, WeaponRelationTarget } from '../../../api/catalog/types'
import './ItemRelationSection.css'

type ItemRelationSectionProps = {
  title: string
  relations: ItemRelation[]
  onSelectItem: (saveId: number) => void
  onSelectDecoration?: (saveId: number) => void
  onSelectWeapon?: (weapon: WeaponRelationTarget) => void
}

export function sortRelationsByProbability(relations: ItemRelation[]): ItemRelation[] {
  return relations
    .map((relation, index) => ({ relation, index }))
    .sort((left, right) => {
      const leftProbability = left.relation.probability
      const rightProbability = right.relation.probability
      if (leftProbability == null && rightProbability == null) return left.index - right.index
      if (leftProbability == null) return 1
      if (rightProbability == null) return -1
      return rightProbability - leftProbability || left.index - right.index
    })
    .map(({ relation }) => relation)
}

export function ItemRelationSection({ title, relations, onSelectItem, onSelectDecoration, onSelectWeapon }: ItemRelationSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const sortedRelations = useMemo(() => sortRelationsByProbability(relations), [relations])
  if (!relations.length) return null

  return (
    <section className="item-relation-section">
      <button
        className="item-relation-section__toggle"
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="item-relation-section__heading">
          <span>{title}</span>
          <span className="item-relation-section__count">{relations.length}</span>
        </span>
        <ChevronDown className="item-relation-section__chevron" aria-hidden="true" />
      </button>
      {expanded && (
        <ul id={bodyId} className="item-relation-section__body">
          {sortedRelations.map((relation) => (
            <li key={relation.id}>
              <span className="item-relation-section__main">
                {relation.usageKind === 'weapon' && onSelectWeapon && relation.relatedWeapon
                  ? <button type="button" onClick={() => onSelectWeapon(relation.relatedWeapon!)}>{relationLabel(relation)}</button>
                  : relation.usageKind === 'decoration' && onSelectDecoration && relation.metadata.Target_Save_ID
                  ? <button type="button" onClick={() => onSelectDecoration(Number(relation.metadata.Target_Save_ID))}>{relationLabel(relation)}</button>
                  : <span>{relationLabel(relation)}</span>}
                {relation.relatedItems.length > 0 && (
                  <span className="item-relation-section__links">
                    关联道具：
                    {relation.relatedItems.map((target) => (
                      <button
                        key={target.saveId}
                        type="button"
                        onClick={() => onSelectItem(target.saveId)}
                      >
                        {target.nameCn}
                      </button>
                    ))}
                  </span>
                )}
              </span>
              <small>
                {relation.quantity != null ? `× ${relation.quantity}` : ''}
                {relation.probability != null ? ` · ${relation.probability.toFixed(0)}%` : ''}
              </small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function relationLabel(relation: ItemRelation): string {
  const rank = relation.metadata.Rank_Name ?? relation.metadata.rankName
  const parts: string[] = []
  if (rank) parts.push(rank)
  if (relation.sourceKind === 'exchange') parts.push('山菜爷')
  parts.push(relation.metadata.Qst_Name ?? relation.relatedWeapon?.nameCn ?? relation.targetName)
  if (relation.sourceKind === 'monster' && relation.metadata.Mon_GetItmType_ID) parts.push(relation.metadata.Mon_GetItmType_Name ?? '获取方式未收录')
  if (relation.sourceKind === 'location') {
    if (relation.metadata.Loc_Ara_ID) parts.push(relation.metadata.Loc_Ara_Name ?? '区域未收录')
    if (relation.metadata.Loc_GetType_ID) parts.push(relation.metadata.Loc_GetType_Name ?? '采集方式未收录')
  }
  if (relation.sourceKind === 'quest' && relation.metadata.Type) parts.push(`奖励栏 ${relation.metadata.Type}`)
  if (relation.metadata.Qst_Lv_Name) parts.unshift(relation.metadata.Qst_Lv_Name)
  if (relation.metadata.Qst_Loc_Name) parts.push(`地图 ${relation.metadata.Qst_Loc_Name}`)
  if (relation.metadata.Region) parts.push(`区域版本 ${relation.metadata.Region}`)
  if (relation.sourceKind === 'weapon' && relation.metadata.Type) parts.push(relation.metadata.Type === 'P' ? '生产' : relation.metadata.Type === 'U' ? '强化' : `类型 ${relation.metadata.Type}`)
  return parts.join(' · ')
}
