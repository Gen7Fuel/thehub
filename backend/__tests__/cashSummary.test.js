import { describe, it, expect } from 'vitest'
// Import models directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import CashSummaryModule from '../models/CashSummaryNew.js'

const { CashSummary, CashSummaryReport } = CashSummaryModule

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseShift = (overrides = {}) => ({
  site: 'Rankin',
  shift_number: 'SFT-001',
  date: new Date('2026-03-10T00:00:00Z'),
  ...overrides,
})

const baseReport = (overrides = {}) => ({
  site: 'Rankin',
  date: new Date('2026-03-10T00:00:00Z'),
  ...overrides,
})

// ─── CashSummary schema ────────────────────────────────────────────────────────

describe('CashSummary schema — field validation', () => {
  it('passes validation with all required fields present', () => {
    expect(new CashSummary(baseShift()).validateSync()).toBeUndefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = baseShift()
    const err = new CashSummary(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing shift_number', () => {
    const { shift_number, ...rest } = baseShift()
    const err = new CashSummary(rest).validateSync()
    expect(err?.errors.shift_number).toBeDefined()
  })

  it('rejects a missing date', () => {
    const { date, ...rest } = baseShift()
    const err = new CashSummary(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('accepts optional numeric fields when provided', () => {
    const doc = new CashSummary(baseShift({
      canadian_cash_collected: 500,
      item_sales: 250,
      cash_back: 20,
      loyalty: 10,
      cpl_bulloch: 5,
      exempted_tax: 15,
      payouts: 30,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.canadian_cash_collected).toBe(500)
    expect(doc.item_sales).toBe(250)
    expect(doc.cash_back).toBe(20)
  })

  it('leaves optional fields undefined when not provided', () => {
    const doc = new CashSummary(baseShift())
    expect(doc.canadian_cash_collected).toBeUndefined()
    expect(doc.item_sales).toBeUndefined()
    expect(doc.cash_back).toBeUndefined()
    expect(doc.fuelSales).toBeUndefined()
    expect(doc.totalSales).toBeUndefined()
  })

  it('accepts SFT parsed fields', () => {
    const doc = new CashSummary(baseShift({
      fuelSales: 1500,
      totalSales: 2000,
      grandTotal: 1980,
      missedCpl: 3,
      safedropsCount: 2,
      safedropsAmount: 400,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.fuelSales).toBe(1500)
    expect(doc.grandTotal).toBe(1980)
    expect(doc.missedCpl).toBe(3)
  })

  it('accepts lottery/DataWave fields', () => {
    const doc = new CashSummary(baseShift({
      lottoPayout: 50,
      onlineLottoTotal: 200,
      instantLottTotal: 150,
      dataWave: 75,
      feeDataWave: 5,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.lottoPayout).toBe(50)
    expect(doc.dataWave).toBe(75)
  })

  it('accepts voided transaction fields', () => {
    const doc = new CashSummary(baseShift({
      voidedTransactionsAmount: 120,
      voidedTransactionsCount: 3,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.voidedTransactionsCount).toBe(3)
  })

  it('stores stationStart and stationEnd as strings', () => {
    const doc = new CashSummary(baseShift({
      stationStart: '2026-03-10 08:00',
      stationEnd: '2026-03-10 16:00',
    }))
    expect(doc.stationStart).toBe('2026-03-10 08:00')
    expect(doc.stationEnd).toBe('2026-03-10 16:00')
  })
})

// ─── CashSummaryReport schema ──────────────────────────────────────────────────

describe('CashSummaryReport schema — field validation', () => {
  it('passes validation with all required fields present', () => {
    expect(new CashSummaryReport(baseReport()).validateSync()).toBeUndefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = baseReport()
    const err = new CashSummaryReport(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing date', () => {
    const { date, ...rest } = baseReport()
    const err = new CashSummaryReport(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('defaults notes to empty string', () => {
    const doc = new CashSummaryReport(baseReport())
    expect(doc.notes).toBe('')
  })

  it('defaults submitted to false', () => {
    const doc = new CashSummaryReport(baseReport())
    expect(doc.submitted).toBe(false)
  })

  it('accepts an optional notes value', () => {
    const doc = new CashSummaryReport(baseReport({ notes: 'Safe drop at 2pm' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.notes).toBe('Safe drop at 2pm')
  })

  it('accepts submitted: true', () => {
    const doc = new CashSummaryReport(baseReport({ submitted: true }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.submitted).toBe(true)
  })

  it('accepts optional adjustment fields', () => {
    const doc = new CashSummaryReport(baseReport({
      unsettledPrepays: 120,
      handheldDebit: 50,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.unsettledPrepays).toBe(120)
    expect(doc.handheldDebit).toBe(50)
  })

  it('leaves optional adjustment fields undefined when not provided', () => {
    const doc = new CashSummaryReport(baseReport())
    expect(doc.unsettledPrepays).toBeUndefined()
    expect(doc.handheldDebit).toBeUndefined()
    expect(doc.submittedAt).toBeUndefined()
  })
})
