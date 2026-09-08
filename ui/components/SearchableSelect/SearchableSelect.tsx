import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './SearchableSelect.css'

export type SearchableSelectOption = {
  value: string
  label: string
  keywords?: string[]
  disabled?: boolean
}

type Props = {
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
}

export function SearchableSelect({ value, options, onChange, placeholder = '请选择', ariaLabel, disabled = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 210 })
  const selected = options.find((option) => option.value === value)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) => [option.label, ...(option.keywords ?? [])].join(' ').toLocaleLowerCase().includes(normalizedQuery))
  }, [normalizedQuery, options])

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnViewportChange = () => setOpen(false)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    window.addEventListener('resize', closeOnViewportChange)
    window.addEventListener('scroll', closeOnViewportChange, true)
    searchRef.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      window.removeEventListener('resize', closeOnViewportChange)
      window.removeEventListener('scroll', closeOnViewportChange, true)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex((current) => Math.min(Math.max(current, 0), Math.max(filteredOptions.length - 1, 0)))
  }, [filteredOptions.length])

  const close = (restoreFocus = false) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const select = (option: SearchableSelectOption) => {
    if (option.disabled) return
    onChange(option.value)
    close(true)
  }

  const openMenu = () => {
    if (disabled) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.max(rect.width, 210)
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8))
      const estimatedHeight = Math.min(318, window.innerHeight - 16)
      const top = rect.bottom + estimatedHeight <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - estimatedHeight - 4)
      setMenuPosition({ left, top, width })
    }
    setOpen(true)
    setQuery('')
    setActiveIndex(Math.max(options.findIndex((option) => option.value === value), 0))
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) openMenu()
      else setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)))
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      close(true)
    }
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filteredOptions[activeIndex]
      if (option) select(option)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    } else if (event.key === 'Tab') {
      close()
    }
  }

  return <div ref={rootRef} className={`searchable-select${open ? ' searchable-select--open' : ''}`}>
    <button ref={triggerRef} type="button" className="searchable-select__trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => open ? close() : openMenu()} onKeyDown={handleTriggerKeyDown}>
      <span className={selected ? '' : 'searchable-select__placeholder'}>{selected?.label ?? placeholder}</span>
      <ChevronDown aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menuRef} className="searchable-select__menu" style={menuPosition}>
      <label className="searchable-select__search"><Search aria-hidden="true" /><input ref={searchRef} role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={filteredOptions[activeIndex]?`${listId}-option-${activeIndex}`:undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={handleSearchKeyDown} placeholder="输入关键词筛选" aria-label={`${ariaLabel}关键词`} /></label>
      <div className="searchable-select__options" id={listId} role="listbox" aria-label={ariaLabel}>
        {filteredOptions.length ? filteredOptions.map((option, index) => <button id={`${listId}-option-${index}`} type="button" role="option" tabIndex={-1} aria-selected={option.value === value} disabled={option.disabled} className={`searchable-select__option${index === activeIndex ? ' searchable-select__option--active' : ''}`} key={`${option.value}-${index}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(option)}>
          <span>{option.label}</span>{option.value === value && <Check aria-hidden="true" />}
        </button>) : <p className="searchable-select__empty">无匹配选项</p>}
      </div>
    </div>, document.body)}
  </div>
}
