import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import BulletinPost from '../models/BulletinPost.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  site: 'Rankin',
  text: 'Reminder: fire drill on Friday at 2pm.',
  author: { id: new mongoose.Types.ObjectId() },
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('BulletinPost — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new BulletinPost(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = base()
    const err = new BulletinPost(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects missing text', () => {
    const { text, ...rest } = base()
    const err = new BulletinPost(rest).validateSync()
    expect(err?.errors.text).toBeDefined()
  })

  it('rejects missing author.id', () => {
    const doc = new BulletinPost({ ...base(), author: {} })
    const err = doc.validateSync()
    expect(err?.errors['author.id']).toBeDefined()
  })
})

// ─── Text max-length ───────────────────────────────────────────────────────────

describe('BulletinPost — text max-length', () => {
  it('accepts text of exactly 2000 characters', () => {
    const doc = new BulletinPost(base({ text: 'A'.repeat(2000) }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('rejects text over 2000 characters', () => {
    const doc = new BulletinPost(base({ text: 'A'.repeat(2001) }))
    const err = doc.validateSync()
    expect(err?.errors.text).toBeDefined()
  })
})

// ─── Author defaults ───────────────────────────────────────────────────────────

describe('BulletinPost — author nested defaults', () => {
  it('defaults author.firstName to empty string', () => {
    const doc = new BulletinPost(base())
    expect(doc.author.firstName).toBe('')
  })

  it('defaults author.lastName to empty string', () => {
    const doc = new BulletinPost(base())
    expect(doc.author.lastName).toBe('')
  })

  it('stores author firstName and lastName', () => {
    const id = new mongoose.Types.ObjectId()
    const doc = new BulletinPost(base({ author: { id, firstName: 'Jane', lastName: 'Smith' } }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.author.firstName).toBe('Jane')
    expect(doc.author.lastName).toBe('Smith')
  })
})
