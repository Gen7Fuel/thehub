import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
// Import the model directly — no DB connection required.
// Do NOT import config/db.js here.
import Transaction from '../models/Transactions.js'

// ─── Schema validation ────────────────────────────────────────────────────────

describe('Transaction schema — field validation', () => {
  /** Minimal valid PO transaction */
  const base = () => ({
    source: 'PO',
    date: new Date('2026-01-15T12:00:00Z'),
    stationName: 'Rankin',
    customerName: 'Jane Doe',
    quantity: 50,
    amount: 100.0,
    productCode: 'UNL',
  })

  it('passes validation with all required fields present', () => {
    expect(new Transaction(base()).validateSync()).toBeUndefined()
  })

  it('accepts Kardpoll as a valid source', () => {
    expect(new Transaction({ ...base(), source: 'Kardpoll' }).validateSync()).toBeUndefined()
  })

  it('rejects an unrecognised source value', () => {
    const err = new Transaction({ ...base(), source: 'MANUAL' }).validateSync()
    expect(err?.errors.source).toBeDefined()
  })

  it('rejects a missing customerName', () => {
    const { customerName, ...rest } = base()
    const err = new Transaction(rest).validateSync()
    expect(err?.errors.customerName).toBeDefined()
  })

  it('defaults quantity to 0 when absent (non-fuel POs)', () => {
    const { quantity, ...rest } = base()
    const trx = new Transaction(rest)
    expect(trx.validateSync()).toBeUndefined()
    expect(trx.quantity).toBe(0)
  })

  it('rejects a missing amount', () => {
    const { amount, ...rest } = base()
    const err = new Transaction(rest).validateSync()
    expect(err?.errors.amount).toBeDefined()
  })

  it('defaults productCode to empty string when absent (non-fuel POs)', () => {
    const { productCode, ...rest } = base()
    const trx = new Transaction(rest)
    expect(trx.validateSync()).toBeUndefined()
    expect(trx.productCode).toBe('')
  })

  it('allows fleetCardNumber to be absent', () => {
    // base() has no fleetCardNumber — should still pass
    expect(new Transaction(base()).validateSync()).toBeUndefined()
  })

  it('allows optional signature and receipt fields', () => {
    const trx = new Transaction({
      ...base(),
      signature: 'data:image/png;base64,abc',
      receipt: 'receipt-file.jpg',
    })
    expect(trx.validateSync()).toBeUndefined()
  })

  it('stores a poNumber string value', () => {
    const trx = new Transaction({ ...base(), poNumber: '10001' })
    expect(trx.poNumber).toBe('10001')
  })

  it('defaults purchaseType to fuel and itemsDescription to empty string', () => {
    const trx = new Transaction(base())
    expect(trx.purchaseType).toBe('fuel')
    expect(trx.itemsDescription).toBe('')
  })

  it('accepts non-fuel purchaseType with an itemsDescription', () => {
    const trx = new Transaction({ ...base(), purchaseType: 'non-fuel', itemsDescription: 'Motor oil, filters' })
    expect(trx.validateSync()).toBeUndefined()
    expect(trx.purchaseType).toBe('non-fuel')
    expect(trx.itemsDescription).toBe('Motor oil, filters')
  })

  it('rejects an unrecognised purchaseType value', () => {
    const err = new Transaction({ ...base(), purchaseType: 'other' }).validateSync()
    expect(err?.errors.purchaseType).toBeDefined()
  })
})

// ─── site alias sync ──────────────────────────────────────────────────────
// Uses the async .validate() (not .validateSync()) because attachSiteAlias's
// pre('validate') hook that syncs site <- stationName only fires under the
// async validate path.

describe('Transaction — site alias sync', () => {
  /** Minimal valid PO transaction */
  const base = () => ({
    source: 'PO',
    date: new Date('2026-01-15T12:00:00Z'),
    stationName: 'Rankin',
    customerName: 'Jane Doe',
    quantity: 50,
    amount: 100.0,
    productCode: 'UNL',
  })

  it('syncs site from stationName after async validate()', async () => {
    const doc = new Transaction(base())
    await doc.validate()
    expect(doc.site).toBe('Rankin')
  })

  it('preserves an explicitly different site value set alongside stationName', async () => {
    const doc = new Transaction({ ...base(), site: 'OtherSite' })
    await doc.validate()
    expect(doc.site).toBe('OtherSite')
  })
})

// ─── dateStr field ────────────────────────────────────────────────────────

describe('Transaction schema — dateStr field', () => {
  const base = () => ({
    source: 'PO',
    date: new Date('2026-01-15T12:00:00Z'),
    stationName: 'Rankin',
    customerName: 'Jane Doe',
    quantity: 50,
    amount: 100.0,
    productCode: 'UNL',
  })

  it('accepts a plain "yyyy-mm-dd" date string', () => {
    const doc = new Transaction({ ...base(), dateStr: '2026-01-15' })
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.dateStr).toBe('2026-01-15')
  })

  it('allows dateStr to be absent', () => {
    const doc = new Transaction(base())
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.dateStr).toBeUndefined()
  })

  it('stores dateStr as an unstructured string (no format enforcement)', () => {
    const doc = new Transaction({ ...base(), dateStr: 'not-a-real-date' })
    expect(doc.validateSync()).toBeUndefined()
  })

  it('still requires date and allows a missing dateStr on Kardpoll docs', () => {
    const doc = new Transaction({ ...base(), source: 'Kardpoll' })
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.dateStr).toBeUndefined()
  })

  it('still rejects a missing date, regardless of dateStr', () => {
    const { date, ...rest } = base()
    const err = new Transaction({ ...rest, dateStr: '2026-01-15' }).validateSync()
    expect(err?.errors.date).toBeDefined()
  })
})

// ─── soft delete fields ────────────────────────────────────────────────────

describe('Transaction schema — soft delete fields', () => {
  const base = () => ({
    source: 'PO',
    date: new Date('2026-01-15T12:00:00Z'),
    stationName: 'Rankin',
    customerName: 'Jane Doe',
    quantity: 50,
    amount: 100.0,
    productCode: 'UNL',
  })

  it('defaults deletedAt and deletedBy to null', () => {
    const doc = new Transaction(base())
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.deletedAt).toBeNull()
    expect(doc.deletedBy).toBeNull()
  })

  it('accepts a deletedAt date and deletedBy ObjectId', () => {
    const deletedBy = new mongoose.Types.ObjectId()
    const doc = new Transaction({ ...base(), deletedAt: new Date('2026-02-01T00:00:00Z'), deletedBy })
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.deletedAt).toBeInstanceOf(Date)
    expect(doc.deletedBy.toString()).toBe(deletedBy.toString())
  })
})

