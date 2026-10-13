import type { SaveEquipmentCell } from '../../../api/save/types'
import './SaveEquipmentUpgradeField.css'

export function SaveEquipmentUpgradeField({ upgrade, value, onChange }: { upgrade: NonNullable<SaveEquipmentCell['upgrade']>; value: number; onChange(value: number): void }) {
  const valid = Number.isInteger(value) && value >= 0 && value <= upgrade.maximum
  return <div className="save-equipment-upgrade-field">
    <label className="save-equipment-upgrade-field__field"><span className="save-equipment-upgrade-field__label">{upgrade.label}</span><input className="save-equipment-upgrade-field__input" type="number" min={0} max={upgrade.maximum} value={value} aria-invalid={!valid} onChange={event => onChange(Number(event.target.value))} /></label>
    <p className="save-equipment-upgrade-field__note">自然上限 {upgrade.naturalMaximum} 次。应用后进入存档草稿；弩附件与未确认字段保持原值。</p>
    {!valid ? <p className="save-equipment-upgrade-field__note" role="alert">请输入 0～{upgrade.maximum} 的整数。</p> : value > upgrade.naturalMaximum && <p className="save-equipment-upgrade-field__note" role="status">超过自然强化上限；数值仍可编码。</p>}
  </div>
}
