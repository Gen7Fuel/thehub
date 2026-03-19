import { describe, it, expect } from 'vitest'
// Import models directly — no DB connection required for schema validation tests.
import CashRecModule from '../models/CashRec.js'

const { KardpollReport, BankStatement } = CashRecModule

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseKardpoll = (overrides = {}) => ({
  litresSold: 100,
  sales: 500.00,
  ar: 200.00,
  date: '2026-03-15',
  site: 'Rankin',
  ...overrides,
})

const baseBankStatement = (overrides = {}) => ({
  site: 'Rankin',
  date: '2026-03-15',
  ...overrides,
})

const baseMiscEntry = (overrides = {}) => ({
  date: '2026-03-15',
  description: 'Service Fee',
  amount: 25.00,
  ...overrides,
})

// ─── KardpollReport schema ─────────────────────────────────────────────────────

describe('KardpollReport schema — required field validation', () => {
  it('passes validation with all required fields', () => {
    expect(new KardpollReport(baseKardpoll()).validateSync()).toBeUndefined()
  })

  it('rejects a missing litresSold', () => {
    const { litresSold, ...rest } = baseKardpoll()
    const err = new KardpollReport(rest).validateSync()
    expect(err?.errors.litresSold).toBeDefined()
  })

  it('rejects a missing sales', () => {
    const { sales, ...rest } = baseKardpoll()
    const err = new KardpollReport(rest).validateSync()
    expect(err?.errors.sales).toBeDefined()
  })

  it('rejects a missing ar', () => {
    const { ar, ...rest } = baseKardpoll()
    const err = new KardpollReport(rest).validateSync()
    expect(err?.errors.ar).toBeDefined()
  })

  it('rejects a missing date', () => {
    const { date, ...rest } = baseKardpoll()
    const err = new KardpollReport(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = baseKardpoll()
    const err = new KardpollReport(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })
})

describe('KardpollReport schema — ar_rows', () => {
  it('defaults ar_rows to an empty array', () => {
    const doc = new KardpollReport(baseKardpoll())
    expect(doc.ar_rows).toEqual([])
  })

  it('accepts a valid ar_rows entry', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [{
        customer: 'ACME Corp',
        card: '123456789012',
        amount: 100,
        quantity: 50,
        price_per_litre: 1.50,
      }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.ar_rows).toHaveLength(1)
    expect(doc.ar_rows[0].customer).toBe('ACME Corp')
    expect(doc.ar_rows[0].card).toBe('123456789012')
  })

  it('accepts multiple ar_rows entries', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [
        { customer: 'ACME Corp', card: '123456789012', amount: 100, quantity: 50, price_per_litre: 1.50 },
        { customer: 'Beta Ltd', card: '987654321098', amount: 200, quantity: 80, price_per_litre: 1.60 },
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.ar_rows).toHaveLength(2)
  })

  it('rejects an ArRow missing customer', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [{ card: '123456789012', amount: 100, quantity: 50, price_per_litre: 1.50 }],
    }))
    const err = doc.validateSync()
    expect(err?.errors['ar_rows.0.customer']).toBeDefined()
  })

  it('rejects an ArRow missing card', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [{ customer: 'ACME', amount: 100, quantity: 50, price_per_litre: 1.50 }],
    }))
    const err = doc.validateSync()
    expect(err?.errors['ar_rows.0.card']).toBeDefined()
  })

  it('rejects an ArRow missing amount', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [{ customer: 'ACME', card: '123456789012', quantity: 50, price_per_litre: 1.50 }],
    }))
    const err = doc.validateSync()
    expect(err?.errors['ar_rows.0.amount']).toBeDefined()
  })

  it('rejects an ArRow missing quantity', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [{ customer: 'ACME', card: '123456789012', amount: 100, price_per_litre: 1.50 }],
    }))
    const err = doc.validateSync()
    expect(err?.errors['ar_rows.0.quantity']).toBeDefined()
  })

  it('rejects an ArRow missing price_per_litre', () => {
    const doc = new KardpollReport(baseKardpoll({
      ar_rows: [{ customer: 'ACME', card: '123456789012', amount: 100, quantity: 50 }],
    }))
    const err = doc.validateSync()
    expect(err?.errors['ar_rows.0.price_per_litre']).toBeDefined()
  })
})

describe('KardpollReport.fromParsed — static factory', () => {
  it('passes a YYYY-MM-DD date string through unchanged', () => {
    const doc = KardpollReport.fromParsed(baseKardpoll({ date: '2026-03-15' }))
    expect(doc.date).toBe('2026-03-15')
  })

  it('converts a UTC Date object to YYYY-MM-DD string', () => {
    const doc = KardpollReport.fromParsed(baseKardpoll({ date: new Date('2026-03-15T00:00:00Z') }))
    expect(doc.date).toBe('2026-03-15')
  })

  it('returns undefined date for an unparseable string', () => {
    const doc = KardpollReport.fromParsed(baseKardpoll({ date: 'not-a-date' }))
    expect(doc.date).toBeUndefined()
  })

  it('returns undefined date when date is omitted', () => {
    const { date, ...rest } = baseKardpoll()
    const doc = KardpollReport.fromParsed(rest)
    expect(doc.date).toBeUndefined()
  })

  it('preserves all numeric fields', () => {
    const doc = KardpollReport.fromParsed(baseKardpoll({ litresSold: 123.45, sales: 678.90, ar: 100.00 }))
    expect(doc.litresSold).toBe(123.45)
    expect(doc.sales).toBe(678.90)
    expect(doc.ar).toBe(100.00)
  })

  it('defaults ar_rows to empty array when not provided', () => {
    const doc = KardpollReport.fromParsed(baseKardpoll())
    expect(doc.ar_rows).toEqual([])
  })

  it('passes ar_rows through when provided', () => {
    const ar_rows = [{ customer: 'X', card: '123456789012', amount: 50, quantity: 20, price_per_litre: 1.25 }]
    const doc = KardpollReport.fromParsed(baseKardpoll({ ar_rows }))
    expect(doc.ar_rows).toHaveLength(1)
    expect(doc.ar_rows[0].customer).toBe('X')
  })
})

// ─── BankStatement schema ──────────────────────────────────────────────────────

describe('BankStatement schema — required field validation', () => {
  it('passes validation with only the required fields', () => {
    expect(new BankStatement(baseBankStatement()).validateSync()).toBeUndefined()
  })

  it('rejects a missing site', () => {
    const { site, ...rest } = baseBankStatement()
    const err = new BankStatement(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects a missing date', () => {
    const { date, ...rest } = baseBankStatement()
    const err = new BankStatement(rest).validateSync()
    expect(err?.errors.date).toBeDefined()
  })
})

describe('BankStatement schema — optional fields and defaults', () => {
  it('defaults miscDebits to an empty array', () => {
    expect(new BankStatement(baseBankStatement()).miscDebits).toEqual([])
  })

  it('defaults miscCredits to an empty array', () => {
    expect(new BankStatement(baseBankStatement()).miscCredits).toEqual([])
  })

  it('defaults gblDebits to an empty array', () => {
    expect(new BankStatement(baseBankStatement()).gblDebits).toEqual([])
  })

  it('defaults gblCredits to an empty array', () => {
    expect(new BankStatement(baseBankStatement()).gblCredits).toEqual([])
  })

  it('leaves numeric fields undefined when not provided', () => {
    const doc = new BankStatement(baseBankStatement())
    expect(doc.balanceForward).toBeUndefined()
    expect(doc.nightDeposit).toBeUndefined()
    expect(doc.transferTo).toBeUndefined()
    expect(doc.endingBalance).toBeUndefined()
    expect(doc.merchantFees).toBeUndefined()
  })

  it('accepts all optional numeric fields', () => {
    const doc = new BankStatement(baseBankStatement({
      balanceForward: 1000,
      nightDeposit: 500,
      transferTo: 200,
      endingBalance: 1300,
      merchantFees: 12.50,
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.balanceForward).toBe(1000)
    expect(doc.nightDeposit).toBe(500)
    expect(doc.transferTo).toBe(200)
    expect(doc.endingBalance).toBe(1300)
    expect(doc.merchantFees).toBe(12.50)
  })

  it('accepts a populated miscDebits array', () => {
    const doc = new BankStatement(baseBankStatement({
      miscDebits: [baseMiscEntry()],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.miscDebits).toHaveLength(1)
    expect(doc.miscDebits[0].description).toBe('Service Fee')
    expect(doc.miscDebits[0].amount).toBe(25)
  })

  it('accepts populated GBL debit and credit arrays', () => {
    const doc = new BankStatement(baseBankStatement({
      gblDebits: [baseMiscEntry({ description: 'GBL Fuel Charge' })],
      gblCredits: [baseMiscEntry({ description: 'GBL Credit Adj', amount: 15 })],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.gblDebits).toHaveLength(1)
    expect(doc.gblCredits).toHaveLength(1)
  })

  it('rejects a miscDebit entry missing its required date', () => {
    const { date, ...noDate } = baseMiscEntry()
    const doc = new BankStatement(baseBankStatement({ miscDebits: [noDate] }))
    const err = doc.validateSync()
    expect(err?.errors['miscDebits.0.date']).toBeDefined()
  })

  it('rejects a miscDebit entry missing its required description', () => {
    const { description, ...noDesc } = baseMiscEntry()
    const doc = new BankStatement(baseBankStatement({ miscDebits: [noDesc] }))
    const err = doc.validateSync()
    expect(err?.errors['miscDebits.0.description']).toBeDefined()
  })

  it('rejects a miscDebit entry missing its required amount', () => {
    const { amount, ...noAmount } = baseMiscEntry()
    const doc = new BankStatement(baseBankStatement({ miscDebits: [noAmount] }))
    const err = doc.validateSync()
    expect(err?.errors['miscDebits.0.amount']).toBeDefined()
  })
})

describe('BankStatement.fromParsed — static factory', () => {
  it('normalizes a YYYY-MM-DD date string', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15' })
    expect(doc.date).toBe('2026-03-15')
  })

  it('converts a UTC Date object to YYYY-MM-DD string', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: new Date('2026-03-15T00:00:00Z') })
    expect(doc.date).toBe('2026-03-15')
  })

  it('returns undefined date for an invalid date input', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: 'bad-date' })
    expect(doc.date).toBeUndefined()
  })

  it('normalizes a miscDebits array and parses amounts', () => {
    const doc = BankStatement.fromParsed({
      site: 'Rankin',
      date: '2026-03-15',
      miscDebits: [{ date: '2026-03-15', description: 'Fee', amount: 25 }],
    })
    expect(doc.miscDebits).toHaveLength(1)
    expect(doc.miscDebits[0].amount).toBe(25)
    expect(doc.miscDebits[0].description).toBe('Fee')
  })

  it('converts a non-array miscDebits to an empty array', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15', miscDebits: 'invalid' })
    expect(doc.miscDebits).toEqual([])
  })

  it('converts a non-array miscCredits to an empty array', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15', miscCredits: null })
    expect(doc.miscCredits).toEqual([])
  })

  it('converts a non-array gblDebits to an empty array', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15', gblDebits: undefined })
    expect(doc.gblDebits).toEqual([])
  })

  it('stores a numeric merchantFees value', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15', merchantFees: 12.50 })
    expect(doc.merchantFees).toBe(12.50)
  })

  it('stores merchantFees of 0', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15', merchantFees: 0 })
    expect(doc.merchantFees).toBe(0)
  })

  it('leaves merchantFees undefined for a non-numeric value', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15', merchantFees: 'abc' })
    expect(doc.merchantFees).toBeUndefined()
  })

  it('leaves merchantFees undefined when omitted', () => {
    const doc = BankStatement.fromParsed({ site: 'Rankin', date: '2026-03-15' })
    expect(doc.merchantFees).toBeUndefined()
  })

  it('normalizes nested miscDebit dates to YYYY-MM-DD', () => {
    const doc = BankStatement.fromParsed({
      site: 'Rankin',
      date: '2026-03-15',
      miscDebits: [{ date: new Date('2026-03-15T00:00:00Z'), description: 'Fee', amount: 10 }],
    })
    expect(doc.miscDebits[0].date).toBe('2026-03-15')
  })

  it('coerces non-numeric amounts in miscDebits to 0', () => {
    const doc = BankStatement.fromParsed({
      site: 'Rankin',
      date: '2026-03-15',
      miscDebits: [{ date: '2026-03-15', description: 'Fee', amount: 'not-a-number' }],
    })
    expect(doc.miscDebits[0].amount).toBe(0)
  })

  it('handles all four debit/credit array types in one call', () => {
    const entry = { date: '2026-03-15', description: 'Entry', amount: 10 }
    const doc = BankStatement.fromParsed({
      site: 'Rankin',
      date: '2026-03-15',
      miscDebits: [entry],
      miscCredits: [entry],
      gblDebits: [entry],
      gblCredits: [entry],
    })
    expect(doc.miscDebits).toHaveLength(1)
    expect(doc.miscCredits).toHaveLength(1)
    expect(doc.gblDebits).toHaveLength(1)
    expect(doc.gblCredits).toHaveLength(1)
  })
})
