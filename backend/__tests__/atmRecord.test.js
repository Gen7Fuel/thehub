import { describe, it, expect } from 'vitest'
import ATMRecord from '../models/ATMRecord.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  date: '2026-04-01',
  amount: 500,
  source: 'till',
  stationName: 'Rankin',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('ATMRecord — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new ATMRecord(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing date', () => {
    const { date, ...rest } = base()
    const err = new ATMRecord(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects missing amount', () => {
    const { amount, ...rest } = base()
    const err = new ATMRecord(rest).validateSync()
    expect(err?.errors.amount).toBeDefined()
  })

  it('rejects missing source', () => {
    const { source, ...rest } = base()
    const err = new ATMRecord(rest).validateSync()
    expect(err?.errors.source).toBeDefined()
  })

  it('rejects missing stationName', () => {
    const { stationName, ...rest } = base()
    const err = new ATMRecord(rest).validateSync()
    expect(err?.errors.stationName).toBeDefined()
  })
})

// ─── Amount validation ─────────────────────────────────────────────────────

describe('ATMRecord — amount validation', () => {
  it('accepts amount of 0', () => {
    const doc = new ATMRecord(base({ amount: 0 }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects negative amount', () => {
    const doc = new ATMRecord(base({ amount: -1 }))
    const err = doc.validateSync()
    expect(err?.errors.amount).toBeDefined()
  })

  it('accepts large positive amounts', () => {
    const doc = new ATMRecord(base({ amount: 50000 }))
    expect(doc.validateSync()).toBeUndefined()
  })
})

// ─── Source enum ──────────────────────────────────────────────────────────────

describe('ATMRecord — source enum', () => {
  it('accepts source "till"', () => {
    const doc = new ATMRecord(base({ source: 'till' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.source).toBe('till')
  })

  it('accepts source "safe"', () => {
    const doc = new ATMRecord(base({ source: 'safe' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.source).toBe('safe')
  })

  it('rejects invalid source', () => {
    const doc = new ATMRecord(base({ source: 'vault' }))
    const err = doc.validateSync()
    expect(err?.errors.source).toBeDefined()
  })
})

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('ATMRecord — defaults', () => {
  it('defaults image to null', () => {
    const doc = new ATMRecord(base())
    expect(doc.image).toBeNull()
  })

  it('defaults createdBy to empty string', () => {
    const doc = new ATMRecord(base())
    expect(doc.createdBy).toBe('')
  })

  it('accepts optional image as a string', () => {
    const doc = new ATMRecord(base({ image: 'cdn-uuid-123.jpg' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.image).toBe('cdn-uuid-123.jpg')
  })
})
