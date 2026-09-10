import './EquipmentSlotIndicator.css'

type EquipmentSlotIndicatorProps = {
  slots: number | null | undefined
  usedSlots?: number
  compact?: boolean
}

export function EquipmentSlotIndicator({ slots, usedSlots, compact = false }: EquipmentSlotIndicatorProps) {
  const normalized = slots == null ? null : Math.max(0, Math.min(3, Math.trunc(slots)))
  const used = usedSlots == null ? null : Math.max(0, Math.trunc(usedSlots))
  const occupied = normalized == null || used == null ? 0 : Math.min(normalized, used)
  const label = normalized == null ? '孔位未知' : used == null ? `${normalized} 个孔位` : `${normalized} 个孔位，已占 ${used}，剩余 ${normalized - used}`
  const title = used == null ? label : `${label}；● 已占孔，O 可用孔，— 不可用孔`

  return (
    <span className={`equipment-slot-indicator${compact ? ' equipment-slot-indicator--compact' : ''}`} role="img" aria-label={label} title={title}>
      {normalized == null
        ? <span className="equipment-slot-indicator__unknown" aria-hidden="true">???</span>
        : Array.from({ length: 3 }, (_, index) => (
          <span className={index < occupied ? 'equipment-slot-indicator__occupied' : index < normalized ? 'equipment-slot-indicator__open' : 'equipment-slot-indicator__closed'} aria-hidden="true" key={index}>
            {index < occupied ? '●' : index < normalized ? 'O' : '—'}
          </span>
        ))}
    </span>
  )
}
