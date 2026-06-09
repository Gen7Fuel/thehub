import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import Event from '../models/Event.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  site: 'Rankin',
  title: 'Staff Meeting',
  date: '2026-04-15',
  createdBy: { id: new mongoose.Types.ObjectId() },
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('Event — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new Event(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = base()
    const err = new Event(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects missing title', () => {
    const { title, ...rest } = base()
    const err = new Event(rest).validateSync()
    expect(err?.errors.title).toBeDefined()
  })

  it('rejects missing date', () => {
    const { date, ...rest } = base()
    const err = new Event(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects missing createdBy.id', () => {
    const doc = new Event({ ...base(), createdBy: {} })
    const err = doc.validateSync()
    expect(err?.errors['createdBy.id']).toBeDefined()
  })
})

// ─── Date format validation ────────────────────────────────────────────────

describe('Event — date format validation', () => {
  it('accepts YYYY-MM-DD format', () => {
    const doc = new Event(base({ date: '2026-12-31' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects date with slashes', () => {
    const doc = new Event(base({ date: '2026/04/15' }))
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects date with time component', () => {
    const doc = new Event(base({ date: '2026-04-15T10:00:00' }))
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects non-date string', () => {
    const doc = new Event(base({ date: 'April 15 2026' }))
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('accepts all valid months', () => {
    for (let m = 1; m <= 12; m++) {
      const dateStr = `2026-${String(m).padStart(2, '0')}-01`
      const doc = new Event(base({ date: dateStr }))
      expect(doc.validateSync()).toBeUndefined()
    }
  })
})

// ─── Max-length constraints ────────────────────────────────────────────────

describe('Event — max-length constraints', () => {
  it('accepts title of exactly 200 characters', () => {
    const doc = new Event(base({ title: 'A'.repeat(200) }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects title over 200 characters', () => {
    const doc = new Event(base({ title: 'A'.repeat(201) }))
    const err = doc.validateSync()
    expect(err?.errors.title).toBeDefined()
  })

  it('accepts description of exactly 2000 characters', () => {
    const doc = new Event(base({ description: 'B'.repeat(2000) }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects description over 2000 characters', () => {
    const doc = new Event(base({ description: 'B'.repeat(2001) }))
    const err = doc.validateSync()
    expect(err?.errors.description).toBeDefined()
  })
})

// ─── Defaults and optional fields ─────────────────────────────────────────

describe('Event — defaults and optional fields', () => {
  it('defaults description to empty string', () => {
    const doc = new Event(base())
    expect(doc.description).toBe('')
  })

  it('defaults createdBy.firstName/lastName/email to empty string', () => {
    const doc = new Event(base())
    expect(doc.createdBy.firstName).toBe('')
    expect(doc.createdBy.lastName).toBe('')
    expect(doc.createdBy.email).toBe('')
  })

  it('accepts optional description', () => {
    const doc = new Event(base({ description: 'Quarterly review session' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.description).toBe('Quarterly review session')
  })

  it('stores createdBy firstName and lastName', () => {
    const id = new mongoose.Types.ObjectId()
    const doc = new Event(base({ createdBy: { id, firstName: 'Jane', lastName: 'Doe', email: 'jane@gen7.com' } }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.createdBy.firstName).toBe('Jane')
    expect(doc.createdBy.lastName).toBe('Doe')
    expect(doc.createdBy.email).toBe('jane@gen7.com')
  })
})
