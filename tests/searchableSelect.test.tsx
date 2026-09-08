// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchableSelect } from '../ui/components/SearchableSelect/SearchableSelect'

afterEach(cleanup)

describe('SearchableSelect', () => {
  const options = [
    { value: '', label: '全部技能' },
    { value: '1', label: '采取', keywords: ['Gathering'] },
    { value: '2', label: '攻击', keywords: ['Attack'] },
  ]

  it('filters options by supplemental English keywords and selects with the keyboard', () => {
    const onChange = vi.fn()
    render(<SearchableSelect ariaLabel="技能" value="" options={options} onChange={onChange}/>)
    fireEvent.click(screen.getByRole('button', { name: '技能' }))
    const input = screen.getByRole('combobox', { name: '技能关键词' })
    fireEvent.change(input, { target: { value: 'attack' } })
    expect(screen.getByRole('option', { name: '攻击' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: '采取' })).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('does not render its floating menu inside the layout container', () => {
    const { container } = render(<SearchableSelect ariaLabel="技能" value="" options={options} onChange={()=>undefined}/>)
    fireEvent.click(screen.getByRole('button', { name: '技能' }))
    expect(container.querySelector('.searchable-select__menu')).toBeNull()
    expect(document.body.querySelector('.searchable-select__menu')).toBeTruthy()
  })
})
