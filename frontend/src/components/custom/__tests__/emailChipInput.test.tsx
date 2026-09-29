import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmailChipInput } from '../emailChipInput'

// Small controlled-input wrapper so tests can interact with the component
// the same way the real form does (value/onChange round-trip through state).
function ControlledChipInput({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <EmailChipInput value={value} onChange={setValue} placeholder="Add email" />
}

describe('EmailChipInput', () => {
  it('commits a chip on space', () => {
    render(<ControlledChipInput />)
    const input = screen.getByPlaceholderText('Add email')
    fireEvent.change(input, { target: { value: 'a@example.com' } })
    fireEvent.keyDown(input, { key: ' ' })
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('commits a chip on comma', () => {
    render(<ControlledChipInput />)
    const input = screen.getByPlaceholderText('Add email')
    fireEvent.change(input, { target: { value: 'b@example.com' } })
    fireEvent.keyDown(input, { key: ',' })
    expect(screen.getByText('b@example.com')).toBeInTheDocument()
  })

  it('commits a chip on Enter and does not submit an enclosing form', () => {
    const onSubmit = vi.fn(e => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <ControlledChipInput />
      </form>
    )
    const input = screen.getByPlaceholderText('Add email')
    fireEvent.change(input, { target: { value: 'c@example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('c@example.com')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects text that does not look like an email, keeping it editable', () => {
    render(<ControlledChipInput />)
    const input = screen.getByPlaceholderText('Add email') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-an-email' } })
    fireEvent.keyDown(input, { key: ' ' })
    expect(screen.queryByText('not-an-email')).not.toBeInTheDocument()
    expect(input.value).toBe('not-an-email')
    expect(screen.getByText(/doesn't look like a valid email/)).toBeInTheDocument()
  })

  it('auto-splits a pasted comma-separated list into multiple chips', () => {
    render(<ControlledChipInput />)
    const input = screen.getByPlaceholderText('Add email')
    fireEvent.paste(input, {
      clipboardData: { getData: () => 'd@example.com, e@example.com' },
    })
    expect(screen.getByText('d@example.com')).toBeInTheDocument()
    expect(screen.getByText('e@example.com')).toBeInTheDocument()
  })

  it('removes a chip when its remove button is clicked', () => {
    render(<ControlledChipInput initial="f@example.com,g@example.com" />)
    fireEvent.click(screen.getByLabelText('Remove f@example.com'))
    expect(screen.queryByText('f@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('g@example.com')).toBeInTheDocument()
  })

  it('pops the last chip back into the draft on backspace when the input is empty', () => {
    render(<ControlledChipInput initial="h@example.com" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(screen.queryByText('h@example.com')).not.toBeInTheDocument()
    expect(input.value).toBe('h@example.com')
  })

  it('commits a valid draft on blur', () => {
    render(<ControlledChipInput />)
    const input = screen.getByPlaceholderText('Add email')
    fireEvent.change(input, { target: { value: 'i@example.com' } })
    fireEvent.blur(input)
    expect(screen.getByText('i@example.com')).toBeInTheDocument()
  })
})
