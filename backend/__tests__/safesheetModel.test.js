import { describe, it, expect } from 'vitest'
// Import the model directly — no DB connection required for instance method tests.
// Do NOT import config/db.js here; that would attempt to connect to MongoDB.
import Safesheet from '../models/Safesheet.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Safesheet document in memory (no DB write).
 * initialBalance defaults to 0.
 */
const makeSheet = (entries = [], initialBalance = 0) =>
  new Safesheet({ site: `test-site-${Date.now()}`, initialBalance, entries })

const makeEntry = (overrides = {}) => ({
  date: new Date('2026-03-10T12:00:00Z'), // noon UTC — stays on 2026-03-10 in any timezone ±11h
  description: '',
  cashIn: 0,
  cashExpenseOut: 0,
  cashDepositBank: 0,
  ...overrides,
})

// ─── getEntriesWithRunningBalance ─────────────────────────────────────────────

describe('Safesheet.getEntriesWithRunningBalance', () => {
  it('returns an empty array when there are no entries', () => {
    const sheet = makeSheet()
    expect(sheet.getEntriesWithRunningBalance()).toEqual([])
  })

  it('applies initialBalance as the starting point', () => {
    const sheet = makeSheet([makeEntry({ cashIn: 0 })], 500)
    const entries = sheet.getEntriesWithRunningBalance()
    expect(entries[0].cashOnHandSafe).toBe(500)
  })

  it('adds cashIn to the running balance', () => {
    const sheet = makeSheet([makeEntry({ cashIn: 200 })], 100)
    const entries = sheet.getEntriesWithRunningBalance()
    expect(entries[0].cashOnHandSafe).toBe(300)
  })

  it('subtracts cashExpenseOut from the running balance', () => {
    const sheet = makeSheet([makeEntry({ cashExpenseOut: 50 })], 200)
    const entries = sheet.getEntriesWithRunningBalance()
    expect(entries[0].cashOnHandSafe).toBe(150)
  })

  it('subtracts cashDepositBank from the running balance', () => {
    const sheet = makeSheet([makeEntry({ cashDepositBank: 80 })], 300)
    const entries = sheet.getEntriesWithRunningBalance()
    expect(entries[0].cashOnHandSafe).toBe(220)
  })

  it('chains running balance correctly across multiple entries', () => {
    const entries = [
      makeEntry({ cashIn: 500 }),
      makeEntry({ cashExpenseOut: 100 }),
      makeEntry({ cashDepositBank: 200 }),
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getEntriesWithRunningBalance()
    expect(result[0].cashOnHandSafe).toBe(500)
    expect(result[1].cashOnHandSafe).toBe(400)
    expect(result[2].cashOnHandSafe).toBe(200)
  })

  it('sorts cashIn before cashExpenseOut on the same day (type-rank order)', () => {
    // Both entries share the same date; cashExpenseOut should sort after cashIn
    const sameDate = new Date('2026-03-10T12:00:00Z')
    const entries = [
      makeEntry({ date: sameDate, cashExpenseOut: 50 }),  // would be rank 1
      makeEntry({ date: sameDate, cashIn: 200 }),         // would be rank 0 → sorted first
    ]
    const sheet = makeSheet(entries, 0)
    const result = sheet.getEntriesWithRunningBalance()
    // After sort: cashIn entry is first → balance goes 0+200=200, then 200-50=150
    expect(result[0].cashIn).toBe(200)
    expect(result[0].cashOnHandSafe).toBe(200)
    expect(result[1].cashExpenseOut).toBe(50)
    expect(result[1].cashOnHandSafe).toBe(150)
  })

  it('handles floating-point amounts correctly (uses integer cents internally)', () => {
    const sheet = makeSheet([
      makeEntry({ cashIn: 0.1 }),
      makeEntry({ cashIn: 0.2 }),
    ])
    const result = sheet.getEntriesWithRunningBalance()
    // 0.1 + 0.2 in raw floating point would be 0.30000000000000004
    expect(result[1].cashOnHandSafe).toBe(0.3)
  })
})

// ─── getEntriesWithAssignedDateGrouping ───────────────────────────────────────

describe('Safesheet.getEntriesWithAssignedDateGrouping', () => {
  it('returns entries sorted by assignedDate when present', () => {
    const entries = [
      makeEntry({ cashIn: 100, assignedDate: '2026-03-12' }),
      makeEntry({ cashIn: 200, assignedDate: '2026-03-10' }),
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getEntriesWithAssignedDateGrouping()
    // March 10 should come before March 12
    expect(result[0].cashIn).toBe(200)
    expect(result[1].cashIn).toBe(100)
  })

  it('falls back to the entry date field when assignedDate is absent', () => {
    const entries = [
      makeEntry({ cashIn: 50,  date: new Date('2026-03-12T12:00:00Z') }),
      makeEntry({ cashIn: 150, date: new Date('2026-03-10T12:00:00Z') }),
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getEntriesWithAssignedDateGrouping()
    // Earlier date sorts first
    expect(result[0].cashIn).toBe(150)
    expect(result[1].cashIn).toBe(50)
  })

  it('mixes assignedDate and date fallback correctly', () => {
    const entries = [
      makeEntry({ cashIn: 1, date: new Date('2026-03-15T12:00:00Z') }),  // no assignedDate → key = 2026-03-15
      makeEntry({ cashIn: 2, assignedDate: '2026-03-11' }),               // key = 2026-03-11
      makeEntry({ cashIn: 3, date: new Date('2026-03-09T12:00:00Z') }),  // no assignedDate → key = 2026-03-09
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getEntriesWithAssignedDateGrouping()
    expect(result.map((e) => e.cashIn)).toEqual([3, 2, 1])
  })

  it('assigns a running balance based on the sorted order', () => {
    const entries = [
      makeEntry({ cashIn: 100, assignedDate: '2026-03-12' }),
      makeEntry({ cashIn: 200, assignedDate: '2026-03-10' }),
    ]
    const sheet = makeSheet(entries, 0)
    const result = sheet.getEntriesWithAssignedDateGrouping()
    expect(result[0].cashOnHandSafe).toBe(200)   // first sorted entry
    expect(result[1].cashOnHandSafe).toBe(300)   // 200 + 100
  })
})

// ─── getDailyBalances ─────────────────────────────────────────────────────────

describe('Safesheet.getDailyBalances', () => {
  it('returns an empty array when no entries fall in the given range', () => {
    const sheet = makeSheet([makeEntry({ cashIn: 100, date: new Date('2026-03-01T00:00:00Z') })])
    const result = sheet.getDailyBalances('2026-03-10', '2026-03-10')
    expect(result).toEqual([])
  })

  it('returns one row per day with the end-of-day balance', () => {
    const entries = [
      makeEntry({ cashIn: 100, date: new Date('2026-03-10T08:00:00Z') }),
      makeEntry({ cashExpenseOut: 30, date: new Date('2026-03-10T09:00:00Z') }),
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getDailyBalances('2026-03-10', '2026-03-10')
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-10')
    expect(result[0].endOfDayBalance).toBe(70)  // 100 - 30
  })

  it('sums bankDepositTotal correctly for a single day', () => {
    const entries = [
      makeEntry({ cashDepositBank: 50, date: new Date('2026-03-10T08:00:00Z') }),
      makeEntry({ cashDepositBank: 80, date: new Date('2026-03-10T10:00:00Z') }),
    ]
    const sheet = makeSheet(entries, 200)
    const result = sheet.getDailyBalances('2026-03-10', '2026-03-10')
    expect(result[0].bankDepositTotal).toBe(130)  // 50 + 80
  })

  it('returns one row per day across multiple days', () => {
    const entries = [
      makeEntry({ cashIn: 100, date: new Date('2026-03-10T12:00:00Z') }),
      makeEntry({ cashIn: 200, date: new Date('2026-03-11T12:00:00Z') }),
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getDailyBalances('2026-03-10', '2026-03-11')
    expect(result).toHaveLength(2)
    expect(result[0].date).toBe('2026-03-10')
    expect(result[1].date).toBe('2026-03-11')
  })

  it('filters out entries outside the requested date range', () => {
    const entries = [
      makeEntry({ cashIn: 999, date: new Date('2026-02-01T12:00:00Z') }),  // before range
      makeEntry({ cashIn: 50,  date: new Date('2026-03-10T12:00:00Z') }),  // in range
      makeEntry({ cashIn: 999, date: new Date('2026-04-01T12:00:00Z') }),  // after range
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getDailyBalances('2026-03-10', '2026-03-10')
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-03-10')
  })

  it('returns rows sorted in ascending date order', () => {
    const entries = [
      makeEntry({ cashIn: 10, date: new Date('2026-03-12T12:00:00Z') }),
      makeEntry({ cashIn: 10, date: new Date('2026-03-10T12:00:00Z') }),
      makeEntry({ cashIn: 10, date: new Date('2026-03-11T12:00:00Z') }),
    ]
    const sheet = makeSheet(entries)
    const result = sheet.getDailyBalances('2026-03-10', '2026-03-12')
    expect(result.map((r) => r.date)).toEqual(['2026-03-10', '2026-03-11', '2026-03-12'])
  })
})
