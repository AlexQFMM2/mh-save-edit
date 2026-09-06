import type { Loadout } from './loadout'
export interface ValidationIssue { path: string; message: string; severity: 'error' | 'warning' }
export interface ValidationResult { valid: boolean; issues: ValidationIssue[] }
export function validateLoadoutShape(loadout: Loadout): ValidationResult {
  const issues: ValidationIssue[] = []
  if (!loadout.name.trim()) issues.push({ path: 'name', message: '配装名称不能为空', severity: 'error' })
  for (const slot of ['weapon','head','chest','arms','waist','legs','charm'] as const) if (!loadout.equipment[slot]) issues.push({ path: slot, message: `请选择${slot}`, severity: 'error' })
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues }
}
