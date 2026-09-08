import './EquipmentSlotIndicator.css'

type EquipmentSlotIndicatorProps = {
  slots: number | null | undefined
  compact?: boolean
}

export function EquipmentSlotIndicator({ slots, compact = false }: EquipmentSlotIndicatorProps) {
  const normalized = slots == null ? null : Math.max(0, Math.min(3, Math.trunc(slots)))
  const label = normalized == null ? '孔位未知' : `${normalized} 个孔位`

  return (
    <span className={`equipment-slot-indicator${compact ? ' equipment-slot-indicator--compact' : ''}`} role="img" aria-label={label} title={label}>
      {normalized == null
        ? <span className="equipment-slot-indicator__unknown" aria-hidden="true">???</span>
        : Array.from({ length: 3 }, (_, index) => (
          <span className={index < normalized ? 'equipment-slot-indicator__open' : 'equipment-slot-indicator__closed'} aria-hidden="true" key={index}>
            {index < normalized ? 'O' : '—'}
          </span>
        ))}
    </span>
  )
}
