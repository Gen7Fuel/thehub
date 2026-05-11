import { describe, it, expect } from 'vitest'
// Import the model directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import Payable from '../models/Payables.js'
import mongoose from 'mongoose'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fakeObjectId = () => new mongoose.Types.ObjectId()

/** Minimal valid Payable document (in-memory, no DB write). */
const base = (overrides = {}) => ({
  vendorName: 'Shell Canada',
  site: fakeObjectId(),
  paymentMethod: 'safe',
  amount: 150.0,
  ...overrides,
})

// ─── Schema validation ────────────────────────────────────────────────────────

describe('Payable schema — field validation', () => {
  it('passes validation with all required fields present', () => {
    expect(new Payable(base()).validateSync()).toBeUndefined()
  })

  it('rejects a missing vendorName', () => {
    const { vendorName, ...rest } = base()
    const err = new Payable(rest).validateSync()
    expect(err?.errors.vendorName).toBeDefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = base()
    const err = new Payable(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing paymentMethod', () => {
    const { paymentMethod, ...rest } = base()
    const err = new Payable(rest).validateSync()
    expect(err?.errors.paymentMethod).toBeDefined()
  })

  it('rejects a missing amount', () => {
    const { amount, ...rest } = base()
    const err = new Payable(rest).validateSync()
    expect(err?.errors.amount).toBeDefined()
  })

  it('rejects a negative amount', () => {
    const err = new Payable(base({ amount: -1 })).validateSync()
    expect(err?.errors.amount).toBeDefined()
  })

  it('accepts zero as a valid amount', () => {
    expect(new Payable(base({ amount: 0 })).validateSync()).toBeUndefined()
  })

  it('rejects an unrecognised paymentMethod', () => {
    const err = new Payable(base({ paymentMethod: 'bitcoin' })).validateSync()
    expect(err?.errors.paymentMethod).toBeDefined()
  })

  it('accepts all valid paymentMethod enum values', () => {
    const validMethods = ['safe', 'till', 'cheque', 'on_account', 'other']
    for (const method of validMethods) {
      expect(new Payable(base({ paymentMethod: method })).validateSync()).toBeUndefined()
    }
  })

  it('allows notes to be absent (defaults to empty string)', () => {
    const doc = new Payable(base())
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.notes).toBe('')
  })

  it('allows images to be absent (defaults to empty array)', () => {
    const doc = new Payable(base())
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.images).toEqual([])
  })

  it('stores images when provided', () => {
    const doc = new Payable(base({ images: ['img1.jpg', 'img2.jpg'] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.images).toHaveLength(2)
  })

  it('trims leading/trailing whitespace from vendorName', () => {
    const doc = new Payable(base({ vendorName: '  Shell Canada  ' }))
    expect(doc.vendorName).toBe('Shell Canada')
  })

  it('stores paymentMethod in lowercase', () => {
    // The schema has lowercase: true — Mongoose applies it before validation
    const doc = new Payable(base({ paymentMethod: 'SAFE' }))
    expect(doc.paymentMethod).toBe('safe')
  })
})
