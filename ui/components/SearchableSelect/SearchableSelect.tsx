import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './SearchableSelect.css'

export type SearchableSelectOption = {
  value: string
  label: string
  keywords?: string[]
  disabled?: boolean
}

type CommonProps = {
  options: SearchableSelectOption[]
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
}

type Props = CommonProps & ({
  value: string
  onChange: (value: string) => void
  multiple?: false
} | {
  value: string[]
  onChange: (value: string[]) => void
  multiple: true
})

export function SearchableSelect(props: Props) {
  const { value, options, placeholder = '请选择', ariaLabel, disabled = false } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 210 })
  const selectedValues = Array.isArray(value) ? value : [value]
  const selected = options.filter((option) => selectedValues.includes(option.value))
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

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const menu = menuRef.current.getBoundingClientRect()
    const gutter = 8
    const gap = 4
    const width = Math.max(trigger.width, 210)
    const left = Math.max(gutter, Math.min(trigger.left, window.innerWidth - width - gutter))
    const fitsBelow = trigger.bottom + gap + menu.height <= window.innerHeight - gutter
    const top = fitsBelow ? trigger.bottom + gap : Math.max(gutter, trigger.top - menu.height - gap)
    setMenuPosition((current) => current.left === left && current.top === top && current.width === width ? current : { left, top, width })
  }, [open, filteredOptions.length])

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
    if (props.multiple) {
      props.onChange(selectedValues.includes(option.value) ? selectedValues.filter((item) => item !== option.value) : [...selectedValues, option.value])
    } else {
      props.onChange(option.value)
      close(true)
    }
  }

  const openMenu = () => {
    if (disabled) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.max(rect.width, 210)
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8))
      setMenuPosition({ left, top: rect.bottom + 4, width })
    }
    setOpen(true)
    setQuery('')
    setActiveIndex(Math.max(options.findIndex((option) => selectedValues.includes(option.value)), 0))
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
      <span className={`searchable-select__value${selected.length ? '' : ' searchable-select__placeholder'}`}>{selected.length ? (props.multiple ? selected.map((option) => option.label).join('、') : selected[0].label) : placeholder}</span>
      <ChevronDown className="searchable-select__chevron" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={menuRef} className="searchable-select__menu" style={menuPosition}>
      <label className="searchable-select__search"><Search className="searchable-select__search-icon" aria-hidden="true" /><input className="searchable-select__search-input" ref={searchRef} role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={filteredOptions[activeIndex]?`${listId}-option-${activeIndex}`:undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={handleSearchKeyDown} placeholder="输入关键词筛选" aria-label={`${ariaLabel}关键词`} /></label>
      <div className="searchable-select__options" id={listId} role="listbox" aria-multiselectable={props.multiple || undefined} aria-label={ariaLabel}>
        {filteredOptions.length ? filteredOptions.map((option, index) => <button id={`${listId}-option-${index}`} type="button" role="option" tabIndex={-1} aria-selected={selectedValues.includes(option.value)} disabled={option.disabled} className={`searchable-select__option${index === activeIndex ? ' searchable-select__option--active' : ''}`} key={`${option.value}-${index}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(option)}>
          <span className="searchable-select__option-label">{option.label}</span>{selectedValues.includes(option.value) && <Check className="searchable-select__check" aria-hidden="true" />}
        </button>) : <p className="searchable-select__empty">无匹配选项</p>}
      </div>
      {props.multiple && <button className="searchable-select__done" type="button" onClick={() => close(true)}>完成（已选 {selected.length}）</button>}
    </div>, document.body)}
  </div>
}
