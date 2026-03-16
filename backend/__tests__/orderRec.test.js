import { describe, it, expect } from 'vitest'
// Import the model directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import OrderRec from '../models/OrderRec.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid OrderRec document (in-memory, no DB write). */
const base = (overrides = {}) => ({
  site: 'Rankin',
  vendor: 'vendor-1',
  ...overrides,
})

// ─── OrderRec schema — top-level field validation ─────────────────────────────

describe('OrderRec schema — field validation', () => {
  it('passes validation with all required fields present', () => {
    expect(new OrderRec(base()).validateSync()).toBeUndefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = base()
    const err = new OrderRec(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing vendor', () => {
    const { vendor, ...rest } = base()
    const err = new OrderRec(rest).validateSync()
    expect(err?.errors.vendor).toBeDefined()
  })

  it('defaults completed to false', () => {
    const doc = new OrderRec(base())
    expect(doc.completed).toBe(false)
  })

  it('defaults currentStatus to "Created"', () => {
    const doc = new OrderRec(base())
    expect(doc.currentStatus).toBe('Created')
  })

  it('defaults orderPlaced to false', () => {
    const doc = new OrderRec(base())
    expect(doc.orderPlaced).toBe(false)
  })

  it('defaults delivered to false', () => {
    const doc = new OrderRec(base())
    expect(doc.delivered).toBe(false)
  })

  it('defaults extraItemsNote to empty string', () => {
    const doc = new OrderRec(base())
    expect(doc.extraItemsNote).toBe('')
  })

  it('defaults comments to empty array', () => {
    const doc = new OrderRec(base())
    expect(doc.comments).toEqual([])
  })

  it('stores statusHistory with a "Created" entry by default', () => {
    const doc = new OrderRec(base())
    expect(doc.statusHistory.length).toBeGreaterThan(0)
    expect(doc.statusHistory[0].status).toBe('Created')
  })
})

// ─── CategorySchema validation ────────────────────────────────────────────────

describe('OrderRec schema — category validation', () => {
  it('rejects a category with a missing number', () => {
    const doc = new OrderRec(base({ categories: [{ number: '', items: [] }] }))
    const err = doc.validateSync()
    expect(err?.errors['categories.0.number']).toBeDefined()
  })

  it('accepts a valid category with a number', () => {
    const doc = new OrderRec(base({ categories: [{ number: '100', items: [] }] }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('defaults category completed to false', () => {
    const doc = new OrderRec(base({ categories: [{ number: '100', items: [] }] }))
    expect(doc.categories[0].completed).toBe(false)
  })
})

// ─── ItemSchema validation ────────────────────────────────────────────────────

describe('OrderRec schema — item validation', () => {
  const withItem = (itemOverrides = {}) =>
    base({
      categories: [{ number: '100', items: [{ gtin: '012345678901', ...itemOverrides }] }],
    })

  it('rejects an item with a missing gtin', () => {
    const doc = new OrderRec(base({ categories: [{ number: '100', items: [{ gtin: '' }] }] }))
    const err = doc.validateSync()
    expect(err?.errors['categories.0.items.0.gtin']).toBeDefined()
  })

  it('accepts a valid item with a gtin', () => {
    const doc = new OrderRec(withItem())
    expect(doc.validateSync()).toBeUndefined()
  })

  it('defaults item numeric fields to 0', () => {
    const doc = new OrderRec(withItem())
    const item = doc.categories[0].items[0]
    expect(item.onHandQty).toBe(0)
    expect(item.onHandQtyOld).toBe(0)
    expect(item.forecast).toBe(0)
    expect(item.minStock).toBe(0)
    expect(item.itemsToOrder).toBe(0)
    expect(item.unitInCase).toBe(0)
    expect(item.casesToOrder).toBe(0)
    expect(item.casesToOrderOld).toBe(0)
  })

  it('defaults item completed to false', () => {
    const doc = new OrderRec(withItem())
    expect(doc.categories[0].items[0].completed).toBe(false)
  })

  it('stores provided item field values', () => {
    const doc = new OrderRec(withItem({ onHandQty: 10, casesToOrder: 3, unitInCase: 12 }))
    const item = doc.categories[0].items[0]
    expect(item.onHandQty).toBe(10)
    expect(item.casesToOrder).toBe(3)
    expect(item.unitInCase).toBe(12)
  })
})

// ─── CommentSchema validation ─────────────────────────────────────────────────

describe('OrderRec schema — comment validation', () => {
  it('rejects a comment with missing text', () => {
    const doc = new OrderRec(base({ comments: [{ text: '' }] }))
    const err = doc.validateSync()
    expect(err?.errors['comments.0.text']).toBeDefined()
  })

  it('accepts a valid comment', () => {
    const doc = new OrderRec(
      base({ comments: [{ text: 'Check quantities', author: 'admin@example.com' }] })
    )
    expect(doc.validateSync()).toBeUndefined()
  })
})
