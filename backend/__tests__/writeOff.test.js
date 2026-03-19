import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'

// Import the model — grab schemas from the model's schema tree
const WriteOff = (await import('../models/WriteOff.js')).default

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseItem = (overrides = {}) => ({
  upc_barcode: '123456789012',
  name: 'Test Product',
  qty: 1,
  reason: 'Damaged',
  ...overrides,
})

const baseList = (overrides = {}) => ({
  listNumber: 'WO-SITE-001',
  site: 'Rankin',
  submittedBy: 'user@example.com',
  ...overrides,
})

const baseComment = (overrides = {}) => ({
  initials: 'JD',
  author: 'John Doe',
  text: 'Looks good',
  ...overrides,
})

// ─── WriteOffList schema — required fields ──────────────────────────────────

describe('WriteOffList schema — required field validation', () => {
  it('passes validation with all required fields', () => {
    expect(new WriteOff(baseList()).validateSync()).toBeUndefined()
  })

  it('rejects a missing listNumber', () => {
    const { listNumber, ...rest } = baseList()
    const err = new WriteOff(rest).validateSync()
    expect(err?.errors.listNumber).toBeDefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = baseList()
    const err = new WriteOff(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing submittedBy', () => {
    const { submittedBy, ...rest } = baseList()
    const err = new WriteOff(rest).validateSync()
    expect(err?.errors.submittedBy).toBeDefined()
  })
})

// ─── WriteOffList schema — defaults and enums ───────────────────────────────

describe('WriteOffList schema — defaults and enums', () => {
  it('defaults status to "Incomplete"', () => {
    const doc = new WriteOff(baseList())
    expect(doc.status).toBe('Incomplete')
  })

  it('defaults submitted to false', () => {
    const doc = new WriteOff(baseList())
    expect(doc.submitted).toBe(false)
  })

  it('defaults listType to "WO"', () => {
    const doc = new WriteOff(baseList())
    expect(doc.listType).toBe('WO')
  })

  it('defaults items to an empty array', () => {
    const doc = new WriteOff(baseList())
    expect(doc.items).toEqual([])
  })

  it('defaults createdAt to a Date', () => {
    const doc = new WriteOff(baseList())
    expect(doc.createdAt).toBeInstanceOf(Date)
  })

  it('accepts status "Partial"', () => {
    const doc = new WriteOff(baseList({ status: 'Partial' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.status).toBe('Partial')
  })

  it('accepts status "Complete"', () => {
    const doc = new WriteOff(baseList({ status: 'Complete' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.status).toBe('Complete')
  })

  it('rejects an invalid status', () => {
    const doc = new WriteOff(baseList({ status: 'Invalid' }))
    const err = doc.validateSync()
    expect(err?.errors.status).toBeDefined()
  })

  it('accepts listType "ATE"', () => {
    const doc = new WriteOff(baseList({ listType: 'ATE' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.listType).toBe('ATE')
  })

  it('accepts listType "BT"', () => {
    const doc = new WriteOff(baseList({ listType: 'BT' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.listType).toBe('BT')
  })

  it('rejects an invalid listType', () => {
    const doc = new WriteOff(baseList({ listType: 'INVALID' }))
    const err = doc.validateSync()
    expect(err?.errors.listType).toBeDefined()
  })
})

// ─── WriteOffItem schema — required fields ──────────────────────────────────

describe('WriteOffItem schema — required field validation', () => {
  it('passes validation with a valid item', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects an item missing upc_barcode', () => {
    const { upc_barcode, ...rest } = baseItem()
    const doc = new WriteOff(baseList({ items: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.upc_barcode']).toBeDefined()
  })

  it('rejects an item missing name', () => {
    const { name, ...rest } = baseItem()
    const doc = new WriteOff(baseList({ items: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.name']).toBeDefined()
  })

  it('rejects an item missing qty', () => {
    const { qty, ...rest } = baseItem()
    const doc = new WriteOff(baseList({ items: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.qty']).toBeDefined()
  })

  it('rejects an item with qty less than 1', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ qty: 0 })] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.qty']).toBeDefined()
  })

  it('rejects an item missing reason', () => {
    const { reason, ...rest } = baseItem()
    const doc = new WriteOff(baseList({ items: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.reason']).toBeDefined()
  })

  it('rejects an item with invalid reason', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ reason: 'Unknown' })] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.reason']).toBeDefined()
  })
})

// ─── WriteOffItem schema — all valid reasons ────────────────────────────────

describe('WriteOffItem schema — reason enum values', () => {
  const validReasons = ['Breakage', 'Spoilage', 'Store Use', 'Deli', 'Stolen', 'Damaged', 'Expired', 'Donation', 'About to Expire']

  validReasons.forEach((reason) => {
    it(`accepts reason "${reason}"`, () => {
      const doc = new WriteOff(baseList({ items: [baseItem({ reason })] }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.items[0].reason).toBe(reason)
    })
  })
})

// ─── WriteOffItem schema — defaults and optional fields ─────────────────────

describe('WriteOffItem schema — defaults and optional fields', () => {
  it('defaults onHandAtWriteOff to 0', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].onHandAtWriteOff).toBe(0)
  })

  it('defaults isManualEntry to false', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].isManualEntry).toBe(false)
  })

  it('defaults completed to false', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].completed).toBe(false)
  })

  it('defaults isEdited to false', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].isEdited).toBe(false)
  })

  it('defaults markdownAction to null', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].markdownAction).toBeNull()
  })

  it('defaults comments to an empty array', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].comments).toEqual([])
  })

  it('accepts gtin as an optional string', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ gtin: '00123456789012' })] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].gtin).toBe('00123456789012')
  })

  it('leaves gtin undefined when not provided', () => {
    const doc = new WriteOff(baseList({ items: [baseItem()] }))
    expect(doc.items[0].gtin).toBeUndefined()
  })

  it('accepts expiryDate as a Date', () => {
    const date = new Date('2026-04-01')
    const doc = new WriteOff(baseList({ items: [baseItem({ expiryDate: date })] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].expiryDate).toEqual(date)
  })

  it('accepts markdownAction "Marked Down"', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ markdownAction: 'Marked Down' })] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].markdownAction).toBe('Marked Down')
  })

  it('accepts markdownAction "No Markdown Needed"', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ markdownAction: 'No Markdown Needed' })] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].markdownAction).toBe('No Markdown Needed')
  })

  it('rejects an invalid markdownAction', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ markdownAction: 'Invalid' })] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.markdownAction']).toBeDefined()
  })
})

// ─── Comment schema ─────────────────────────────────────────────────────────

describe('WriteOffItem — Comment schema validation', () => {
  it('accepts a valid comment', () => {
    const doc = new WriteOff(baseList({
      items: [baseItem({ comments: [baseComment()] })],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].comments).toHaveLength(1)
    expect(doc.items[0].comments[0].initials).toBe('JD')
    expect(doc.items[0].comments[0].author).toBe('John Doe')
    expect(doc.items[0].comments[0].text).toBe('Looks good')
  })

  it('defaults createdAt to a Date', () => {
    const doc = new WriteOff(baseList({
      items: [baseItem({ comments: [baseComment()] })],
    }))
    expect(doc.items[0].comments[0].createdAt).toBeInstanceOf(Date)
  })

  it('rejects a comment missing initials', () => {
    const { initials, ...rest } = baseComment()
    const doc = new WriteOff(baseList({
      items: [baseItem({ comments: [rest] })],
    }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.comments.0.initials']).toBeDefined()
  })

  it('rejects a comment missing author', () => {
    const { author, ...rest } = baseComment()
    const doc = new WriteOff(baseList({
      items: [baseItem({ comments: [rest] })],
    }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.comments.0.author']).toBeDefined()
  })

  it('rejects a comment missing text', () => {
    const { text, ...rest } = baseComment()
    const doc = new WriteOff(baseList({
      items: [baseItem({ comments: [rest] })],
    }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.comments.0.text']).toBeDefined()
  })

  it('accepts multiple comments on an item', () => {
    const doc = new WriteOff(baseList({
      items: [baseItem({
        comments: [
          baseComment({ text: 'First comment' }),
          baseComment({ initials: 'AB', author: 'Alice Bob', text: 'Second comment' }),
        ],
      })],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].comments).toHaveLength(2)
  })
})

// ─── WriteOffList with multiple items ───────────────────────────────────────

describe('WriteOffList — multiple items', () => {
  it('accepts multiple items in a list', () => {
    const doc = new WriteOff(baseList({
      items: [
        baseItem({ name: 'Product A', reason: 'Breakage' }),
        baseItem({ name: 'Product B', reason: 'Spoilage', qty: 3 }),
        baseItem({ name: 'Product C', reason: 'Expired', upc_barcode: '999888777666' }),
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items).toHaveLength(3)
  })

  it('rejects the list if any item is invalid', () => {
    const doc = new WriteOff(baseList({
      items: [
        baseItem({ name: 'Valid Item' }),
        baseItem({ name: '', reason: 'Damaged' }), // empty name still passes (not missing)
        { upc_barcode: '123', reason: 'Damaged', qty: 1 }, // missing name
      ],
    }))
    const err = doc.validateSync()
    expect(err?.errors['items.2.name']).toBeDefined()
  })

  it('accepts qty of exactly 1 (minimum)', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ qty: 1 })] }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('accepts qty greater than 1', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ qty: 50 })] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].qty).toBe(50)
  })

  it('rejects negative qty', () => {
    const doc = new WriteOff(baseList({ items: [baseItem({ qty: -1 })] }))
    const err = doc.validateSync()
    expect(err?.errors['items.0.qty']).toBeDefined()
  })
})
