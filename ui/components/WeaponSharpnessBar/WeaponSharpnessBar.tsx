import type { SharpnessStageView } from '../../utils/weaponCatalog'
import { sharpnessColors } from '../../utils/weaponCatalog'
import './WeaponSharpnessBar.css'

type Props = { stage: SharpnessStageView; emphasized?: boolean; compact?: boolean }

export function WeaponSharpnessBar({ stage, emphasized = false, compact = false }: Props) {
  const details = sharpnessColors.filter((color) => stage.segments[color] > 0).map((color) => `${color} ${stage.segments[color]}`).join('，')
  return <div className={`weapon-sharpness-bar${emphasized ? ' weapon-sharpness-bar--emphasized' : ''}${compact ? ' weapon-sharpness-bar--compact' : ''}`} title={`${stage.label}：${stage.summary}；${details}`}>
    <span className="weapon-sharpness-bar__label">{compact ? stage.shortLabel : stage.label}</span>
    <span className="weapon-sharpness-bar__track" aria-hidden="true">
      {sharpnessColors.map((color) => <span key={color} className={`weapon-sharpness-bar__segment weapon-sharpness-bar__segment--${color}`} style={{ width: `${stage.total ? stage.segments[color] / stage.total * 100 : 0}%` }} />)}
    </span>
    {!compact && <span className="weapon-sharpness-bar__summary">{stage.summary}</span>}
  </div>
}
