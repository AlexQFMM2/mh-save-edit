import './RelicSharpnessBar.css'

const SHARPNESS_NAMES = ['红', '橙', '黄', '绿', '蓝', '白', '紫'] as const

const NORMAL_SHARPNESS = [
  [150, 20, 80, 0, 0, 0, 0],
  [200, 10, 20, 20, 0, 0, 0],
  [30, 30, 170, 20, 0, 0, 0],
  [30, 20, 175, 75, 0, 0, 0],
  [40, 60, 80, 120, 0, 0, 0],
  [60, 30, 100, 100, 10, 0, 0],
  [100, 70, 80, 40, 10, 0, 0],
  [40, 160, 30, 20, 50, 0, 0],
  [30, 70, 70, 20, 60, 0, 0],
  [30, 70, 70, 20, 100, 10, 0],
  [50, 70, 80, 100, 75, 20, 0],
  [60, 40, 50, 160, 40, 0, 0],
  [120, 20, 40, 90, 30, 0, 0],
  [190, 20, 60, 80, 0, 0, 0],
  [30, 60, 160, 50, 0, 0, 0],
  [10, 50, 190, 0, 0, 0, 0],
  [30, 20, 150, 0, 0, 0, 0],
  [100, 60, 40, 70, 50, 30, 0],
  [30, 70, 70, 20, 100, 105, 0],
  [50, 70, 80, 100, 75, 20, 0],
  [145, 10, 20, 150, 20, 50, 0],
  [95, 80, 40, 60, 70, 80, 25],
] as const

const SPECIAL_SHARPNESS = [235, 0, 0, 0, 0, 0, 215] as const
const SHARPNESS_SCALE = 450

export type RelicSharpnessProfile = {
  label: string
  lengths: readonly number[]
  provisional: boolean
}

export function getRelicSharpnessProfile(code: number): RelicSharpnessProfile | null {
  if (code >= 0 && code < NORMAL_SHARPNESS.length) {
    return { label: `方案 ${code + 1}`, lengths: NORMAL_SHARPNESS[code], provisional: false }
  }
  if (code === 0xda) return { label: '特殊方案', lengths: SPECIAL_SHARPNESS, provisional: true }
  return null
}

function profileDescription(profile: RelicSharpnessProfile) {
  return profile.lengths.map((length, index) => `${SHARPNESS_NAMES[index]} ${length}`).join('、')
}

type Props = {
  code: number
  compact?: boolean
}

export function RelicSharpnessBar({ code, compact = false }: Props) {
  const profile = getRelicSharpnessProfile(code)
  if (!profile) return null

  const total = profile.lengths.reduce((sum, length) => sum + length, 0)
  const highestIndex = profile.lengths.reduce((highest, length, index) => length > 0 ? index : highest, 0)
  const description = profileDescription(profile)
  const accessibleText = `${profile.label}；${description}；合计 ${total}/${SHARPNESS_SCALE}${profile.provisional ? '；推定映射，待实机确认' : ''}`

  return <span className={`relic-sharpness-bar${compact ? ' relic-sharpness-bar--compact' : ''}`} role="img" aria-label={accessibleText}>
    <span className="relic-sharpness-bar__heading" aria-hidden="true">
      <span className="relic-sharpness-bar__label">{profile.label}</span>
      <span className="relic-sharpness-bar__summary">最高 {SHARPNESS_NAMES[highestIndex]} · {total}/{SHARPNESS_SCALE}</span>
      {profile.provisional && <span className="relic-sharpness-bar__evidence">推定映射</span>}
    </span>
    <span className="relic-sharpness-bar__track" aria-hidden="true">
      {profile.lengths.map((length, index) => length > 0 && <span
        className={`relic-sharpness-bar__segment relic-sharpness-bar__segment--${index}`}
        style={{ flexBasis: `${length / SHARPNESS_SCALE * 100}%` }}
        title={`${SHARPNESS_NAMES[index]} ${length}`}
        key={SHARPNESS_NAMES[index]}
      />)}
      {total < SHARPNESS_SCALE && <span className="relic-sharpness-bar__unused" style={{ flexBasis: `${(SHARPNESS_SCALE - total) / SHARPNESS_SCALE * 100}%` }} />}
    </span>
    {!compact && <span className="relic-sharpness-bar__details" aria-hidden="true">{description}</span>}
  </span>
}
