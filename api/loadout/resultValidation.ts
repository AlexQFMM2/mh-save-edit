import { calculateLoadout } from './calculator'
import type { AutoLoadoutTarget, LoadoutCalculationSnapshot, LogicalLoadout } from './types'

export function resolveAutoTargets(snapshot: LoadoutCalculationSnapshot, targets: AutoLoadoutTarget[]): AutoLoadoutTarget[] {
  return targets.map(target => {
    const activation = snapshot.skills.find(skill => skill.skillId === target.skillId)?.activations.find(a => a.activationKey === target.activationKey && a.direction === 'positive')
    if (!activation) throw new Error(`自动配装目标不存在或不可用：${target.nameCn}`)
    return { activationKey: activation.activationKey, skillId: activation.skillId, nameCn: activation.nameCn, threshold: activation.threshold }
  })
}

/** Called after rehydration; stored thresholds and calculated totals are never authoritative. */
export function validateAutoResult(snapshot: LoadoutCalculationSnapshot, loadout: LogicalLoadout, targets: AutoLoadoutTarget[]) {
  if (loadout.gameId !== snapshot.gameId || loadout.dataVersion !== snapshot.dataVersion) throw new Error('资料版本已变化，请重新进入配装页面后复核')
  const calculation = calculateLoadout(snapshot, loadout)
  if (calculation.encoding === 'blocked') throw new Error(`配装结构无效：${calculation.issues.find(i => i.severity === 'error')?.message ?? '请检查诊断'}`)
  if (snapshot.gameId === 'mhp2g' && calculation.legality !== 'confirmed') throw new Error(`自动结果不适用：${calculation.issues[0]?.message ?? '请检查性别、职业和孔位'}`)
  const missing = resolveAutoTargets(snapshot, targets).find(t => (calculation.skills.find(s => s.skillId === t.skillId)?.total ?? 0) < t.threshold)
  if (missing) throw new Error(`当前资料复核后不再满足目标：${missing.nameCn}`)
  return calculation
}
