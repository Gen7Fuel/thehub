import { describe, it, expect } from 'vitest'
import Fleet from '../models/Fleet.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  fleetCardNumber: 'FC-001-RANKIN',
  customerName: 'John Smith Trucking',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('Fleet — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new Fleet(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing fleetCardNumber', () => {
    const { fleetCardNumber, ...rest } = base()
    const err = new Fleet(rest).validateSync()
    expect(err?.errors.fleetCardNumber).toBeDefined()
  })

  it('rejects missing customerName', () => {
    const { customerName, ...rest } = base()
    const err = new Fleet(rest).validateSync()
    expect(err?.errors.customerName).toBeDefined()
  })
})

// ─── Status enum ─────────────────────────────────────────────────────────────

describe('Fleet — status enum', () => {
  const validStatuses = ['active', 'inactive', 'lost', 'stolen', 'cancelled']

  validStatuses.forEach((status) => {
    it(`accepts status "${status}"`, () => {
      const doc = new Fleet(base({ status }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.status).toBe(status)
    })
  })

  it('defaults status to "active"', () => {
    const doc = new Fleet(base())
    expect(doc.status).toBe('active')
  })

  it('rejects invalid status', () => {
    const doc = new Fleet(base({ status: 'suspended' }))
    const err = doc.validateSync()
    expect(err?.errors.status).toBeDefined()
  })
})

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('Fleet — defaults', () => {
  it('defaults numberPlate to empty string', () => {
    const doc = new Fleet(base())
    expect(doc.numberPlate).toBe('')
  })

  it('defaults notes to empty string', () => {
    const doc = new Fleet(base())
    expect(doc.notes).toBe('')
  })

  it('defaults site to empty string', () => {
    const doc = new Fleet(base())
    expect(doc.site).toBe('')
  })
})

// ─── Optional fields ──────────────────────────────────────────────────────────

describe('Fleet — optional fields', () => {
  it('accepts optional driverName', () => {
    const doc = new Fleet(base({ driverName: 'Bob Driver' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.driverName).toBe('Bob Driver')
  })

  it('accepts optional customerId', () => {
    const doc = new Fleet(base({ customerId: 'CUST-001' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.customerId).toBe('CUST-001')
  })

  it('accepts optional vehicleMakeModel', () => {
    const doc = new Fleet(base({ vehicleMakeModel: 'Ford F-150 2022' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.vehicleMakeModel).toBe('Ford F-150 2022')
  })

  it('accepts optional customerEmail', () => {
    const doc = new Fleet(base({ customerEmail: 'john@trucking.com' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.customerEmail).toBe('john@trucking.com')
  })

  it('accepts optional base64 signature', () => {
    const doc = new Fleet(base({ signature: 'data:image/png;base64,abc123==' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('accepts full populated fleet card', () => {
    const doc = new Fleet(base({
      driverName: 'Alice Doe',
      customerId: 'CUST-42',
      vehicleMakeModel: 'Chevy Silverado',
      customerEmail: 'alice@example.com',
      status: 'inactive',
      numberPlate: 'ABC-1234',
      notes: 'Card reported missing',
      site: 'Rankin',
    }))
    expect(doc.validateSync()).toBeUndefined()
  })
})
