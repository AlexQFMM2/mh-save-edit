import { describe, expect, it } from 'vitest'
import type { ItemRelation } from '../api/catalog/types'
import { sortRelationsByProbability } from '../ui/components/ItemRelationSection/ItemRelationSection'

function relation(id: number, probability: number | null): ItemRelation {
  return {
    id,
    sourceKind: 'monster',
    usageKind: null,
    targetId: id,
    targetName: `关系 ${id}`,
    quantity: null,
    probability,
    rank: null,
    metadata: {},
    relatedItems: [],
  }
}

describe('sortRelationsByProbability', () => {
  it('按概率降序排列，并将没有概率的关系放在最后', () => {
    const sorted = sortRelationsByProbability([
      relation(1, null),
      relation(2, 10),
      relation(3, 75),
      relation(4, null),
      relation(5, 50),
    ])

    expect(sorted.map((item) => item.id)).toEqual([3, 5, 2, 1, 4])
  })

  it('相同概率保持原来的显示顺序', () => {
    const sorted = sortRelationsByProbability([
      relation(11, 75),
      relation(12, 75),
      relation(13, 10),
    ])

    expect(sorted.map((item) => item.id)).toEqual([11, 12, 13])
  })
})
