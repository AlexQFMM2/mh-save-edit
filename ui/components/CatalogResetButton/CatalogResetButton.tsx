import { RotateCcw } from 'lucide-react'
import './CatalogResetButton.css'

type CatalogResetButtonProps = {
  onReset: () => void
}

export function CatalogResetButton({ onReset }: CatalogResetButtonProps) {
  return (
    <button
      className="catalog-reset-button"
      type="button"
      aria-label="重置全部筛选条件"
      title="清空搜索、筛选和当前选择"
      onClick={onReset}
    >
      <RotateCcw aria-hidden="true" />
      <span>重置</span>
    </button>
  )
}
