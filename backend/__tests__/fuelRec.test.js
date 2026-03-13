import { describe, it, expect } from 'vitest'
// Import model directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import BOLPhoto from '../models/FuelRec.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  site: 'Rankin',
  date: '2026-03-13',
  filename: 'uuid-abc123.jpg',
  bolNumber: 'BOL-2026-001',
  ...overrides,
})

// ─── BOLPhoto schema — required fields ────────────────────────────────────────

describe('BOLPhoto schema — required fields', () => {
  it('passes validation with all required fields', () => {
    expect(new BOLPhoto(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = base()
    expect(new BOLPhoto(rest).validateSync()?.errors.site).toBeDefined()
  })

  it('rejects missing date', () => {
    const { date, ...rest } = base()
    expect(new BOLPhoto(rest).validateSync()?.errors.date).toBeDefined()
  })

  it('rejects missing filename', () => {
    const { filename, ...rest } = base()
    expect(new BOLPhoto(rest).validateSync()?.errors.filename).toBeDefined()
  })

  it('rejects missing bolNumber', () => {
    const { bolNumber, ...rest } = base()
    expect(new BOLPhoto(rest).validateSync()?.errors.bolNumber).toBeDefined()
  })
})

// ─── BOLPhoto schema — date format validation ──────────────────────────────────

describe('BOLPhoto schema — date format validation', () => {
  it('accepts a valid YYYY-MM-DD date', () => {
    expect(new BOLPhoto(base({ date: '2026-03-13' })).validateSync()).toBeUndefined()
  })

  it('rejects a date without dashes (YYYYMMDD)', () => {
    const err = new BOLPhoto(base({ date: '20260313' })).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects a date in MM/DD/YYYY format', () => {
    const err = new BOLPhoto(base({ date: '03/13/2026' })).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects a freeform date string', () => {
    const err = new BOLPhoto(base({ date: 'March 13 2026' })).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects an empty date string', () => {
    const err = new BOLPhoto(base({ date: '' })).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('accepts the earliest valid date', () => {
    expect(new BOLPhoto(base({ date: '2000-01-01' })).validateSync()).toBeUndefined()
  })
})

// ─── BOLPhoto schema — bolNumber trimming ──────────────────────────────────────

describe('BOLPhoto schema — bolNumber trimming', () => {
  it('trims leading and trailing whitespace from bolNumber', () => {
    const doc = new BOLPhoto(base({ bolNumber: '  BOL-001  ' }))
    expect(doc.bolNumber).toBe('BOL-001')
  })

  it('stores bolNumber as-is when already trimmed', () => {
    const doc = new BOLPhoto(base({ bolNumber: 'BOL-2026-007' }))
    expect(doc.bolNumber).toBe('BOL-2026-007')
  })
})

// ─── BOLPhoto schema — comments subdocument ────────────────────────────────────

describe('BOLPhoto schema — comments subdocument', () => {
  it('accepts an empty comments array', () => {
    const doc = new BOLPhoto(base({ comments: [] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.comments).toHaveLength(0)
  })

  it('accepts a valid comment with text and user', () => {
    const doc = new BOLPhoto(base({
      comments: [{ text: 'Please retake — image is blurry', user: 'manager@rankin.ca' }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.comments[0].text).toBe('Please retake — image is blurry')
    expect(doc.comments[0].user).toBe('manager@rankin.ca')
  })

  it('defaults comment createdAt to now', () => {
    const before = Date.now()
    const doc = new BOLPhoto(base({
      comments: [{ text: 'Looks good', user: 'admin' }],
    }))
    expect(doc.comments[0].createdAt.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('rejects a comment missing required text', () => {
    const doc = new BOLPhoto(base({
      comments: [{ user: 'admin' }],
    }))
    expect(doc.validateSync()?.errors['comments.0.text']).toBeDefined()
  })

  it('rejects a comment missing required user', () => {
    const doc = new BOLPhoto(base({
      comments: [{ text: 'Some comment' }],
    }))
    expect(doc.validateSync()?.errors['comments.0.user']).toBeDefined()
  })

  it('accepts multiple comments', () => {
    const doc = new BOLPhoto(base({
      comments: [
        { text: 'First comment', user: 'alice' },
        { text: 'Second comment', user: 'bob' },
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.comments).toHaveLength(2)
  })
})

// ─── BOLPhoto schema — timestamps ─────────────────────────────────────────────

describe('BOLPhoto schema — timestamps', () => {
  it('has createdAt and updatedAt fields from timestamps option', () => {
    const doc = new BOLPhoto(base())
    // Mongoose timestamps are set on save, but the paths exist on the schema
    expect(doc.schema.paths).toHaveProperty('createdAt')
    expect(doc.schema.paths).toHaveProperty('updatedAt')
  })
})

// ─── BOLPhoto.fromPayload static method ───────────────────────────────────────

describe('BOLPhoto.fromPayload — static helper', () => {
  it('creates a valid document from a well-formed payload', () => {
    const doc = BOLPhoto.fromPayload({
      site: 'Couchiching',
      date: '2026-03-13',
      filename: 'uuid-xyz.jpg',
      bolNumber: 'BOL-567',
    })
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.site).toBe('Couchiching')
    expect(doc.date).toBe('2026-03-13')
    expect(doc.filename).toBe('uuid-xyz.jpg')
    expect(doc.bolNumber).toBe('BOL-567')
  })

  it('trims whitespace from site in fromPayload', () => {
    const doc = BOLPhoto.fromPayload({ ...base(), site: '  Rankin  ' })
    expect(doc.site).toBe('Rankin')
  })

  it('trims whitespace from filename in fromPayload', () => {
    const doc = BOLPhoto.fromPayload({ ...base(), filename: '  uuid-abc.jpg  ' })
    expect(doc.filename).toBe('uuid-abc.jpg')
  })

  it('converts a Date object to YYYY-MM-DD in fromPayload', () => {
    const doc = BOLPhoto.fromPayload({
      ...base(),
      date: new Date('2026-03-13T00:00:00Z'),
    })
    expect(doc.date).toBe('2026-03-13')
  })

  it('returns a document with empty site when payload is missing site', () => {
    const doc = BOLPhoto.fromPayload({ date: '2026-03-13', filename: 'f.jpg', bolNumber: 'B1' })
    const err = doc.validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('returns a document with undefined date when payload date is invalid', () => {
    const doc = BOLPhoto.fromPayload({ ...base(), date: 'not-a-date' })
    const err = doc.validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('handles an empty payload without throwing', () => {
    const doc = BOLPhoto.fromPayload({})
    expect(doc).toBeDefined()
    expect(doc.validateSync()).toBeDefined() // will have validation errors
  })
})
