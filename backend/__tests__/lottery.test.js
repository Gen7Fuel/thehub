import { describe, it, expect } from 'vitest'
import Lottery from '../models/Lottery.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  site: 'Rankin',
  date: '2026-04-15',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('Lottery — required field validation', () => {
  it('passes with only site and date', () => {
    expect(new Lottery(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = base()
    const err = new Lottery(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects missing date', () => {
    const { date, ...rest } = base()
    const err = new Lottery(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })
})

// ─── Date format validation (custom validator) ────────────────────────────────

describe('Lottery — date format validation', () => {
  it('accepts valid YYYY-MM-DD date', () => {
    const doc = new Lottery(base({ date: '2026-01-31' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects date with slashes', () => {
    const doc = new Lottery(base({ date: '2026/04/15' }))
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects date with time component', () => {
    const doc = new Lottery(base({ date: '2026-04-15T00:00:00Z' }))
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects plain number string', () => {
    const doc = new Lottery(base({ date: '20260415' }))
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('accepts last day of each month', () => {
    const endDays = [
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
      '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31',
    ]
    for (const date of endDays) {
      const doc = new Lottery(base({ date }))
      expect(doc.validateSync()).toBeUndefined()
    }
  })
})

// ─── Numeric field defaults (nullable) ────────────────────────────────────────

describe('Lottery — numeric field defaults', () => {
  const numericFields = [
    'lottoPayout', 'dataWave', 'feeDataWave', 'onlineLottoTotal',
    'instantLottTotal', 'vouchersRedeemed', 'scratchFreeTickets',
    'scratchCashPayout', 'onDemandFreeTickets', 'onDemandCashPayout',
    'oldScratchTickets', 'onlineCancellations', 'onlineDiscounts',
  ]

  numericFields.forEach((field) => {
    it(`defaults ${field} to null`, () => {
      const doc = new Lottery(base())
      expect(doc[field]).toBeNull()
    })
  })

  it('accepts numeric values for all lottery fields', () => {
    const doc = new Lottery(base({
      lottoPayout: 250.00,
      dataWave: 1000.00,
      feeDataWave: 5.00,
      onlineLottoTotal: 500.00,
      scratchFreeTickets: 3,
      scratchCashPayout: 75.00,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.lottoPayout).toBe(250)
    expect(doc.scratchFreeTickets).toBe(3)
  })
})

// ─── Image arrays ─────────────────────────────────────────────────────────────

describe('Lottery — image arrays', () => {
  it('defaults images to empty array', () => {
    const doc = new Lottery(base())
    expect(doc.images).toEqual([])
  })

  it('defaults datawaveImages to empty array', () => {
    const doc = new Lottery(base())
    expect(doc.datawaveImages).toEqual([])
  })

  it('accepts images as string array', () => {
    const doc = new Lottery(base({ images: ['slip1.jpg', 'slip2.jpg'] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.images).toHaveLength(2)
  })

  it('accepts datawaveImages as string array', () => {
    const doc = new Lottery(base({ datawaveImages: ['dw-2026-04.jpg'] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.datawaveImages).toHaveLength(1)
  })
})

// ─── Pre-save deduplication logic ────────────────────────────────────────────

describe('Lottery — image deduplication logic', () => {
  it('deduplicates identical filenames', () => {
    const input = ['slip1.jpg', 'slip1.jpg', 'slip2.jpg']
    const result = Array.from(new Set(input.map((s) => String(s || '').trim()).filter(Boolean)))
    expect(result).toEqual(['slip1.jpg', 'slip2.jpg'])
  })

  it('trims whitespace from filenames', () => {
    const input = ['  slip1.jpg  ', 'slip1.jpg']
    const result = Array.from(new Set(input.map((s) => String(s || '').trim()).filter(Boolean)))
    expect(result).toEqual(['slip1.jpg'])
  })

  it('removes empty strings', () => {
    const input = ['slip1.jpg', '', '   ', 'slip2.jpg']
    const result = Array.from(new Set(input.map((s) => String(s || '').trim()).filter(Boolean)))
    expect(result).toEqual(['slip1.jpg', 'slip2.jpg'])
  })
})
