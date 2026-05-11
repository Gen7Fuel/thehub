import { describe, it, expect, vi, beforeEach } from 'vitest'
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

  it('rejects a missing quantity', () => {
    const { quantity, ...rest } = base()
    const err = new Transaction(rest).validateSync()
    expect(err?.errors.quantity).toBeDefined()
  })

  it('rejects a missing amount', () => {
    const { amount, ...rest } = base()
    const err = new Transaction(rest).validateSync()
    expect(err?.errors.amount).toBeDefined()
  })

  it('rejects a missing productCode', () => {
    const { productCode, ...rest } = base()
    const err = new Transaction(rest).validateSync()
    expect(err?.errors.productCode).toBeDefined()
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
})

// ─── Transaction.getNextPoNumberForSite ───────────────────────────────────────

describe('Transaction.getNextPoNumberForSite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Stubs the findOne → sort → select → lean chain that
   * getNextPoNumberForSite relies on.
   */
  const stubFindOne = (record) =>
    vi.spyOn(Transaction, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(record),
    })

  it('returns "10000" when no prior PO exists', async () => {
    stubFindOne(null)
    expect(await Transaction.getNextPoNumberForSite('Rankin')).toBe('10000')
  })

  it('increments the last valid PO number by one', async () => {
    stubFindOne({ poNumber: '10004' })
    expect(await Transaction.getNextPoNumberForSite('Rankin')).toBe('10005')
  })

  it('handles large PO numbers correctly', async () => {
    stubFindOne({ poNumber: '19999' })
    expect(await Transaction.getNextPoNumberForSite('Rankin')).toBe('20000')
  })

  it('falls back to "10000" when last poNumber is non-numeric', async () => {
    stubFindOne({ poNumber: 'ABC' })
    expect(await Transaction.getNextPoNumberForSite('Rankin')).toBe('10000')
  })

  it('falls back to "10000" when last poNumber is below the 10000 floor', async () => {
    stubFindOne({ poNumber: '0042' })
    expect(await Transaction.getNextPoNumberForSite('Rankin')).toBe('10000')
  })

  it('queries only source=PO records for the provided station', async () => {
    const spy = stubFindOne(null)
    await Transaction.getNextPoNumberForSite('Rankin')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'PO', stationName: 'Rankin' })
    )
  })

  it('throws when stationName is empty', async () => {
    await expect(Transaction.getNextPoNumberForSite('')).rejects.toThrow(
      'stationName is required'
    )
  })
})
