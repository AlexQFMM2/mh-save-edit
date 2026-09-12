import type { SavePalicoDetail, SavePalicoGenerationPattern, SavePalicoGenerationRules } from './types'

type RebuildResult = Pick<SavePalicoDetail,
  | 'forte'
  | 'equippedActions'
  | 'equippedSkills'
  | 'learnedActions'
  | 'learnedSkills'
  | 'actionPattern'
  | 'actionValidLength'
  | 'skillPattern'
  | 'skillValidLength'
>

function patternFor(rules: SavePalicoGenerationRules, scope: SavePalicoGenerationPattern['scope'], preferred: number) {
  const candidates = rules.patterns.filter(value => value.scope === scope)
  const selected = candidates.find(value => value.patternId === preferred) ?? candidates[0]
  if (!selected || !/^[ABC]+$/.test(selected.sequence)) throw new Error(`缺少可用的猎猫生成模式：${scope}`)
  return selected
}

function grantIds(rules: SavePalicoGenerationRules, forte: number, kind: 'move' | 'skill', role: SavePalicoGenerationRules['grants'][number]['role']) {
  const owner = role === 'common' ? -1 : forte
  return rules.grants.filter(value => value.forteId === owner && value.kind === kind && value.role === role).map(value => value.entryId)
}

function currentGenerated(values: number[], fixed: number, sequenceLength: number) {
  return values.slice(fixed, fixed + sequenceLength).filter(value => value > 0 && value !== 57 && value !== 96)
}

function chooseGenerated(rules: SavePalicoGenerationRules, kind: 'move' | 'skill', sequence: string, preferred: number[]) {
  const used = new Set<number>()
  return [...sequence].map(group => {
    const choices = rules.pools.filter(value => value.kind === kind && value.group === group).map(value => value.entryId)
    const preserved = preferred.find(value => !used.has(value) && choices.includes(value))
    const selected = preserved ?? choices.find(value => !used.has(value)) ?? choices[0]
    if (selected == null) throw new Error(`猎猫${kind === 'move' ? '行动' : '技能'} ${group} 组没有候选`)
    used.add(selected)
    return selected
  })
}

function transfers(values: number[], start: number, count: number, sentinel: number) {
  return values.slice(start, start + count).filter(value => value > 0 && value !== sentinel).slice(0, count)
}

function fixedLength(forte: number) { return forte === 0 ? 3 : 4 }

/**
 * Rebuilds only the documented Palico ability structure. The caller keeps every
 * unrelated field, including level, EXP, training state and assignment bytes.
 */
export function rebuildPalicoStructure(current: SavePalicoDetail, rules: SavePalicoGenerationRules, forte: number): RebuildResult {
  if (!Number.isInteger(forte) || forte < 0 || forte > 7) throw new Error('支援倾向超出原生范围')
  const oldActionScope = current.forte === 0 ? 'charisma_move' : 'normal_move'
  const newActionScope = forte === 0 ? 'charisma_move' : 'normal_move'
  const oldActionPattern = patternFor(rules, oldActionScope, current.actionPattern)
  const actionPattern = patternFor(rules, newActionScope, current.actionPattern)
  const skillPattern = patternFor(rules, 'skill', current.skillPattern)

  const oldActionFixed = fixedLength(current.forte)
  const oldActionGenerated = currentGenerated(current.learnedActions, oldActionFixed, oldActionPattern.sequence.length)
  const oldSkillGenerated = currentGenerated(current.learnedSkills, 2, skillPattern.sequence.length)
  const generatedActions = chooseGenerated(rules, 'move', actionPattern.sequence, oldActionGenerated)
  const generatedSkills = chooseGenerated(rules, 'skill', skillPattern.sequence, oldSkillGenerated)

  const oldActionTransferCount = current.forte === 0 ? 3 : 2
  const newActionTransferCount = forte === 0 ? 3 : 2
  const preservedActionTransfers = transfers(current.learnedActions, oldActionFixed + oldActionPattern.sequence.length, oldActionTransferCount, 57).slice(0, newActionTransferCount)
  const actionTransfers = [...preservedActionTransfers, ...Array(newActionTransferCount - preservedActionTransfers.length).fill(0)]
  const preservedSkillTransfers = transfers(current.learnedSkills, 2 + skillPattern.sequence.length, 2, 96)
  const skillTransfers = [...preservedSkillTransfers, ...Array(2 - preservedSkillTransfers.length).fill(0)]

  const primary = grantIds(rules, forte, 'move', 'primary')
  if (primary.length !== 1) throw new Error('支援倾向缺少唯一固有行动')
  const secondaryRole = forte === 7 ? 'secondary_fixed' : 'secondary'
  const secondary = forte === 0 ? [] : grantIds(rules, forte, 'move', secondaryRole).slice(0, 1)
  if (forte !== 0 && secondary.length !== 1) throw new Error('支援倾向缺少准固有行动')
  const common = grantIds(rules, forte, 'move', 'common')
  if (common.length !== 2) throw new Error('猎猫共通行动资料不完整')
  const fixedSkills = grantIds(rules, forte, 'skill', 'innate')
  if (fixedSkills.length !== 2) throw new Error('支援倾向固有技能资料不完整')

  const learnedActions = [...primary, ...secondary, ...common, ...generatedActions, ...actionTransfers]
  const learnedSkills = [...fixedSkills, ...generatedSkills, ...skillTransfers]
  if (learnedActions.length > 16 || learnedSkills.length > 12) throw new Error('重建后的猎猫能力结构超过存档容量')

  return {
    forte,
    equippedActions: Array(8).fill(0),
    equippedSkills: Array(8).fill(0),
    learnedActions: [...learnedActions, ...Array(16 - learnedActions.length).fill(57)],
    learnedSkills: [...learnedSkills, ...Array(12 - learnedSkills.length).fill(96)],
    actionPattern: actionPattern.patternId,
    actionValidLength: actionPattern.validLength,
    skillPattern: skillPattern.patternId,
    skillValidLength: skillPattern.validLength,
  }
}

export function describePalicoStructureChange(before: SavePalicoDetail, after: RebuildResult) {
  const changedActions = before.learnedActions.filter((value, index) => value !== after.learnedActions[index]).length
  const changedSkills = before.learnedSkills.filter((value, index) => value !== after.learnedSkills[index]).length
  const clearedActions = before.equippedActions.filter(Boolean).length
  const clearedSkills = before.equippedSkills.filter(Boolean).length
  return { changedActions, changedSkills, clearedActions, clearedSkills }
}
