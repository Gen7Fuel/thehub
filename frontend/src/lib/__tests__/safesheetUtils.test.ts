import { describe, it, expect } from 'vitest'
import {
  pad,
  ymd,
  ymdFixed,
  parseYmd,
  fmtNumber,
  fmtNumberShowZero,
  recomputeCashOnHand,
  typeRank,
  getSortKey,
  type SafesheetEntry,
} from '../safesheetUtils'

// ─── pad ─────────────────────────────────────────────────────────────────────

describe('pad', () => {
  it('zero-pads single-digit numbers', () => {
    expect(pad(1)).toBe('01')
    expect(pad(9)).toBe('09')
  })

  it('leaves double-digit numbers unchanged', () => {
    expect(pad(10)).toBe('10')
    expect(pad(31)).toBe('31')
  })
})

// ─── ymd / ymdFixed ──────────────────────────────────────────────────────────

describe('ymd', () => {
  it('formats a Date to YYYY-MM-DD using local time', () => {
    // Construct a known local date to avoid timezone ambiguity
    const d = new Date(2026, 2, 10, 12, 0, 0) // March 10 2026 noon local
    expect(ymd(d)).toBe('2026-03-10')
  })

  it('zero-pads month and day', () => {
    const d = new Date(2026, 0, 5, 0, 0, 0) // Jan 5
    expect(ymd(d)).toBe('2026-01-05')
  })
})

describe('ymdFixed', () => {
  it('produces the same result as ymd for the same input', () => {
    const d = new Date(2026, 11, 31, 0, 0, 0) // Dec 31
    expect(ymdFixed(d)).toBe('2026-12-31')
  })
})

// ─── parseYmd ─────────────────────────────────────────────────────────────────

describe('parseYmd', () => {
  it('parses a valid YYYY-MM-DD string into a local-midnight Date', () => {
    const d = parseYmd('2026-03-10')
    expect(d).toBeInstanceOf(Date)
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(2)   // 0-indexed
    expect(d!.getDate()).toBe(10)
    expect(d!.getHours()).toBe(0)
    expect(d!.getMinutes()).toBe(0)
    expect(d!.getSeconds()).toBe(0)
  })

  it('returns undefined for an empty string', () => {
    expect(parseYmd('')).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(parseYmd(undefined)).toBeUndefined()
  })

  it('returns undefined for a non-YYYY-MM-DD string', () => {
    expect(parseYmd('10-03-2026')).toBeUndefined()
    expect(parseYmd('not a date')).toBeUndefined()
    expect(parseYmd('2026-3-10')).toBeUndefined() // missing zero-pad
  })
})

// ─── fmtNumber ────────────────────────────────────────────────────────────────

describe('fmtNumber', () => {
  it('returns empty string for 0', () => {
    expect(fmtNumber(0)).toBe('')
  })

  it('returns empty string for null', () => {
    expect(fmtNumber(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(fmtNumber(undefined)).toBe('')
  })

  it('formats a positive integer with 2 decimal places', () => {
    // The exact string depends on the locale of the test runner; just check structure
    const result = fmtNumber(1500)
    expect(result).toMatch(/1[,.]?500\.00/)
  })

  it('formats a decimal value', () => {
    const result = fmtNumber(99.5)
    expect(result).toMatch(/99\.50/)
  })
})

// ─── fmtNumberShowZero ───────────────────────────────────────────────────────

describe('fmtNumberShowZero', () => {
  it('formats 0 as "0.00"', () => {
    expect(fmtNumberShowZero(0)).toBe('0.00')
  })

  it('returns empty string for null', () => {
    expect(fmtNumberShowZero(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(fmtNumberShowZero(undefined)).toBe('')
  })

  it('formats a positive number with 2 decimal places', () => {
    const result = fmtNumberShowZero(250)
    expect(result).toMatch(/250\.00/)
  })
})

// ─── recomputeCashOnHand ──────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<SafesheetEntry>): SafesheetEntry => ({
  _id: Math.random().toString(36).slice(2),
  date: new Date().toISOString(),
  cashIn: 0,
  cashExpenseOut: 0,
  cashDepositBank: 0,
  ...overrides,
})

describe('recomputeCashOnHand', () => {
  it('applies initialBalance as the starting point', () => {
    const entry = makeEntry({ cashIn: 0, cashExpenseOut: 0, cashDepositBank: 0 })
    const result = recomputeCashOnHand([entry], 500)
    expect(result[0].cashOnHandSafe).toBe(500)
  })

  it('adds cashIn to the balance', () => {
    const entry = makeEntry({ cashIn: 200, cashExpenseOut: 0, cashDepositBank: 0 })
    const result = recomputeCashOnHand([entry], 100)
    expect(result[0].cashOnHandSafe).toBe(300)
  })

  it('subtracts cashExpenseOut from the balance', () => {
    const entry = makeEntry({ cashIn: 0, cashExpenseOut: 50, cashDepositBank: 0 })
    const result = recomputeCashOnHand([entry], 200)
    expect(result[0].cashOnHandSafe).toBe(150)
  })

  it('subtracts cashDepositBank from the balance', () => {
    const entry = makeEntry({ cashIn: 0, cashExpenseOut: 0, cashDepositBank: 80 })
    const result = recomputeCashOnHand([entry], 300)
    expect(result[0].cashOnHandSafe).toBe(220)
  })

  it('chains balances correctly across multiple entries', () => {
    const entries = [
      makeEntry({ cashIn: 500, cashExpenseOut: 0, cashDepositBank: 0 }),
      makeEntry({ cashIn: 0, cashExpenseOut: 100, cashDepositBank: 0 }),
      makeEntry({ cashIn: 0, cashExpenseOut: 0, cashDepositBank: 200 }),
    ]
    const result = recomputeCashOnHand(entries, 0)
    expect(result[0].cashOnHandSafe).toBe(500)
    expect(result[1].cashOnHandSafe).toBe(400)
    expect(result[2].cashOnHandSafe).toBe(200)
  })

  it('does not mutate the original entries array', () => {
    const entries = [makeEntry({ cashIn: 100, cashExpenseOut: 0, cashDepositBank: 0 })]
    const original = entries[0].cashOnHandSafe
    recomputeCashOnHand(entries, 0)
    expect(entries[0].cashOnHandSafe).toBe(original)
  })
})

// ─── typeRank ────────────────────────────────────────────────────────────────

describe('typeRank', () => {
  it('returns 0 for a cashIn entry', () => {
    expect(typeRank({ cashIn: 100, cashExpenseOut: 0, cashDepositBank: 0 })).toBe(0)
  })

  it('returns 1 for a cashExpenseOut entry', () => {
    expect(typeRank({ cashIn: 0, cashExpenseOut: 50, cashDepositBank: 0 })).toBe(1)
  })

  it('returns 2 for a cashDepositBank entry', () => {
    expect(typeRank({ cashIn: 0, cashExpenseOut: 0, cashDepositBank: 75 })).toBe(2)
  })

  it('returns 3 for an empty/zero entry', () => {
    expect(typeRank({ cashIn: 0, cashExpenseOut: 0, cashDepositBank: 0 })).toBe(3)
  })

  it('handles null/undefined gracefully', () => {
    expect(typeRank({ cashIn: null, cashExpenseOut: null, cashDepositBank: null })).toBe(3)
  })
})

// ─── getSortKey ───────────────────────────────────────────────────────────────

describe('getSortKey', () => {
  it('returns assignedDate when present and valid', () => {
    const entry = { date: '2026-03-10T12:00:00Z', assignedDate: '2026-03-08' }
    expect(getSortKey(entry)).toBe('2026-03-08')
  })

  it('falls back to the date field when assignedDate is absent', () => {
    const entry = { date: '2026-03-10T00:00:00Z' }
    // We check it returns a YYYY-MM-DD string matching the UTC date
    const result = getSortKey(entry)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('falls back to the date field when assignedDate is malformed', () => {
    const entry = { date: '2026-03-10T00:00:00Z', assignedDate: 'not-a-date' }
    const result = getSortKey(entry)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ignores an invalid assignedDate and uses date instead', () => {
    const entry = { date: '2026-01-15T00:00:00Z', assignedDate: '2026-1-5' }
    // '2026-1-5' doesn't match YYYY-MM-DD (missing zero-pad)
    const result = getSortKey(entry)
    expect(result).not.toBe('2026-1-5')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
