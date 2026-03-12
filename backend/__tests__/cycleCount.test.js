import { describe, it, expect } from 'vitest'
// Import the model directly — no DB connection required.
// Do NOT import config/db.js here.
import CycleCount from '../models/CycleCount.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal valid CycleCount document (in-memory, no DB write). */
const base = (overrides = {}) =>
  new CycleCount({ site: 'Rankin', name: 'Milk 1L', ...overrides })

const makeItem = (overrides = {}) => ({
  _id: `item-${Math.random()}`,
  name: 'Item',
  updatedAt: new Date('2026-03-10T12:00:00Z'),
  categoryNumber: 100,
  ...overrides,
})

// ─── Schema validation ────────────────────────────────────────────────────────

describe('CycleCount schema — field validation', () => {
  it('passes validation with all required fields present', () => {
    expect(base().validateSync()).toBeUndefined()
  })

  it('rejects a missing site', () => {
    const err = new CycleCount({ name: 'Milk 1L' }).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing name', () => {
    const err = new CycleCount({ site: 'Rankin' }).validateSync()
    expect(err?.errors.name).toBeDefined()
  })

  it('defaults active to true', () => {
    expect(base().active).toBe(true)
  })

  it('defaults inventoryExists to true', () => {
    expect(base().inventoryExists).toBe(true)
  })

  it('defaults foh to 0', () => {
    expect(base().foh).toBe(0)
  })

  it('defaults boh to 0', () => {
    expect(base().boh).toBe(0)
  })

  it('defaults flagged to false', () => {
    expect(base().flagged).toBe(false)
  })

  it('defaults comments to empty array', () => {
    expect(base().comments).toEqual([])
  })

  it('stores optional fields when provided', () => {
    const doc = base({ upc: '012345678901', gtin: '00012345678905', grade: 'A' })
    expect(doc.upc).toBe('012345678901')
    expect(doc.gtin).toBe('00012345678905')
    expect(doc.grade).toBe('A')
  })
})

// ─── CommentSchema validation ─────────────────────────────────────────────────

describe('CycleCount schema — comment validation', () => {
  it('rejects a comment with missing initials', () => {
    const doc = base({ comments: [{ initials: '', author: 'john@example.com', text: 'Check shelf' }] })
    const err = doc.validateSync()
    expect(err?.errors['comments.0.initials']).toBeDefined()
  })

  it('rejects a comment with missing author', () => {
    const doc = base({ comments: [{ initials: 'JD', author: '', text: 'Check shelf' }] })
    const err = doc.validateSync()
    expect(err?.errors['comments.0.author']).toBeDefined()
  })

  it('rejects a comment with missing text', () => {
    const doc = base({ comments: [{ initials: 'JD', author: 'john@example.com', text: '' }] })
    const err = doc.validateSync()
    expect(err?.errors['comments.0.text']).toBeDefined()
  })

  it('accepts a valid comment', () => {
    const doc = base({
      comments: [{ initials: 'JD', author: 'john@example.com', text: 'Check shelf' }],
    })
    expect(doc.validateSync()).toBeUndefined()
  })
})

// ─── sortItems static method ──────────────────────────────────────────────────

describe('CycleCount.sortItems', () => {
  it('sorts by updatedAt ascending (oldest first)', () => {
    const items = [
      makeItem({ name: 'B', updatedAt: new Date('2026-03-12T00:00:00Z') }),
      makeItem({ name: 'A', updatedAt: new Date('2026-03-10T00:00:00Z') }),
    ]
    const sorted = CycleCount.sortItems(items)
    expect(sorted[0].name).toBe('A')
    expect(sorted[1].name).toBe('B')
  })

  it('sorts by categoryNumber numerically when updatedAt is equal', () => {
    const sameDate = new Date('2026-03-10T12:00:00Z')
    const items = [
      makeItem({ name: 'X', updatedAt: sameDate, categoryNumber: 200 }),
      makeItem({ name: 'Y', updatedAt: sameDate, categoryNumber: 100 }),
    ]
    const sorted = CycleCount.sortItems(items)
    expect(sorted[0].categoryNumber).toBe(100)
    expect(sorted[1].categoryNumber).toBe(200)
  })

  it('sorts by name alphabetically when updatedAt and categoryNumber are equal', () => {
    const sameDate = new Date('2026-03-10T12:00:00Z')
    const items = [
      makeItem({ name: 'Zebra', updatedAt: sameDate, categoryNumber: 100 }),
      makeItem({ name: 'Apple', updatedAt: sameDate, categoryNumber: 100 }),
    ]
    const sorted = CycleCount.sortItems(items)
    expect(sorted[0].name).toBe('Apple')
    expect(sorted[1].name).toBe('Zebra')
  })

  it('places items with no categoryNumber after those with one', () => {
    const sameDate = new Date('2026-03-10T12:00:00Z')
    const items = [
      makeItem({ name: 'NoCat', updatedAt: sameDate, categoryNumber: undefined }),
      makeItem({ name: 'HasCat', updatedAt: sameDate, categoryNumber: 50 }),
    ]
    const sorted = CycleCount.sortItems(items)
    expect(sorted[0].name).toBe('HasCat')
    expect(sorted[1].name).toBe('NoCat')
  })

  it('returns an empty array when given an empty array', () => {
    expect(CycleCount.sortItems([])).toEqual([])
  })
})

// ─── sortFlaggedItems static method ──────────────────────────────────────────

describe('CycleCount.sortFlaggedItems', () => {
  it('sorts by flaggedAt ascending (oldest first)', () => {
    const items = [
      makeItem({ name: 'Recent', flaggedAt: new Date('2026-03-12T00:00:00Z') }),
      makeItem({ name: 'Old',    flaggedAt: new Date('2026-03-01T00:00:00Z') }),
    ]
    const sorted = CycleCount.sortFlaggedItems(items)
    expect(sorted[0].name).toBe('Old')
    expect(sorted[1].name).toBe('Recent')
  })

  it('treats items without flaggedAt as oldest (epoch)', () => {
    const items = [
      makeItem({ name: 'WithFlag',    flaggedAt: new Date('2026-03-10T00:00:00Z') }),
      makeItem({ name: 'WithoutFlag', flaggedAt: undefined }),
    ]
    const sorted = CycleCount.sortFlaggedItems(items)
    expect(sorted[0].name).toBe('WithoutFlag')
    expect(sorted[1].name).toBe('WithFlag')
  })

  it('returns an empty array when given an empty array', () => {
    expect(CycleCount.sortFlaggedItems([])).toEqual([])
  })
})
