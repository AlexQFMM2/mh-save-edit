export type PalicoGenerationFilter = 'A' | 'B' | 'C' | 'fixed'

export const palicoUnlockKindLabels = {
  initial: '初始可用',
  innate: '倾向固有',
  monster: '狩猎怪物',
  level: '等级解锁',
  distribution: '配信传授',
} as const

export function palicoGenerationLabel(group: string | null, compact = false) {
  if (group) return compact ? `${group}组` : `${group} 组（随机池）`
  return compact ? '固定' : '固定/特殊（不参与随机分组）'
}

export function palicoRoleLabel(role: string, kind: 'move' | 'skill') {
  if (role === 'generated') return '随机候选'
  if (kind === 'skill') {
    if (role === 'special') return '特殊/配信技能'
    if (role === 'innate') return '倾向固有技能'
  } else {
    if (role === 'common') return '基础固定行动'
    if (role === 'primary') return '倾向专属行动'
    if (role === 'secondary' || role === 'secondary_fixed') return '倾向固定行动'
  }
  return '固定条目'
}
