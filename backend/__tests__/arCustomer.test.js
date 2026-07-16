import { describe, it, expect } from 'vitest'
import ArCustomer from '../models/ArCustomer.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  customerId: 'CUST-001',
  name: 'Acme Trucking',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('ArCustomer — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new ArCustomer(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing customerId', () => {
    const { customerId, ...rest } = base()
    const err = new ArCustomer(rest).validateSync()
    expect(err?.errors.customerId).toBeDefined()
  })

  it('rejects missing name', () => {
    const { name, ...rest } = base()
    const err = new ArCustomer(rest).validateSync()
    expect(err?.errors.name).toBeDefined()
  })
})

// ─── fleetCardNumber ───────────────────────────────────────────────────────────

describe('ArCustomer — fleetCardNumber', () => {
  it('is optional', () => {
    const doc = new ArCustomer(base())
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.fleetCardNumber).toBeUndefined()
  })

  it('accepts a fleet card number and trims it', () => {
    const doc = new ArCustomer(base({ fleetCardNumber: '  7776890000001234  ' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.fleetCardNumber).toBe('7776890000001234')
  })
})

// ─── quickSelectSites ──────────────────────────────────────────────────────────

describe('ArCustomer — quickSelectSites', () => {
  it('defaults to an empty array', () => {
    const doc = new ArCustomer(base())
    expect(doc.quickSelectSites).toEqual([])
  })

  it('accepts multiple per-site entries with independent order values', () => {
    const doc = new ArCustomer(base({
      quickSelectSites: [
        { stationName: 'Rankin', order: 0 },
        { stationName: 'Couchiching', order: 2 },
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.quickSelectSites).toHaveLength(2)
    expect(doc.quickSelectSites[0].stationName).toBe('Rankin')
    expect(doc.quickSelectSites[0].order).toBe(0)
    expect(doc.quickSelectSites[1].stationName).toBe('Couchiching')
    expect(doc.quickSelectSites[1].order).toBe(2)
  })

  it('defaults order to 0 when omitted', () => {
    const doc = new ArCustomer(base({ quickSelectSites: [{ stationName: 'Rankin' }] }))
    expect(doc.quickSelectSites[0].order).toBe(0)
  })

  it('rejects a quickSelectSites entry missing stationName', () => {
    const doc = new ArCustomer(base({ quickSelectSites: [{ order: 0 }] }))
    const err = doc.validateSync()
    expect(err?.errors['quickSelectSites.0.stationName']).toBeDefined()
  })

  it('defaults label to an empty string when omitted', () => {
    const doc = new ArCustomer(base({ quickSelectSites: [{ stationName: 'Walpole', order: 0 }] }))
    expect(doc.quickSelectSites[0].label).toBe('')
  })

  it('accepts a custom label and trims it', () => {
    const doc = new ArCustomer(base({
      quickSelectSites: [{ stationName: 'Walpole', order: 0, label: '  Three Fires  ' }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.quickSelectSites[0].label).toBe('Three Fires')
  })

  it('supports independent labels per site entry', () => {
    const doc = new ArCustomer(base({
      quickSelectSites: [
        { stationName: 'Walpole', order: 0, label: 'Three Fires' },
        { stationName: 'Rankin', order: 0 },
      ],
    }))
    expect(doc.quickSelectSites[0].label).toBe('Three Fires')
    expect(doc.quickSelectSites[1].label).toBe('')
  })

  // These use the async .validate() (not .validateSync()) because the
  // per-entry site <- stationName sync runs in a pre('validate') hook that
  // only fires under the async validate path.
  it('syncs site from stationName per entry after async validate()', async () => {
    const doc = new ArCustomer(base({ quickSelectSites: [{ stationName: 'Rankin', order: 0 }] }))
    await doc.validate()
    expect(doc.quickSelectSites[0].site).toBe('Rankin')
  })

  it('syncs site independently per entry for multiple sites after async validate()', async () => {
    const doc = new ArCustomer(base({
      quickSelectSites: [
        { stationName: 'Rankin', order: 0 },
        { stationName: 'Couchiching', order: 2 },
      ],
    }))
    await doc.validate()
    expect(doc.quickSelectSites[0].site).toBe('Rankin')
    expect(doc.quickSelectSites[1].site).toBe('Couchiching')
  })

  // Mirrors the shared attachSiteAlias helper's isModified()-based override
  // protection: an explicitly-different site set alongside stationName in
  // the same write survives validate() rather than being clobbered back.
  it('preserves an explicitly different site value set alongside stationName', async () => {
    const doc = new ArCustomer(base({
      quickSelectSites: [{ stationName: 'Rankin', site: 'OtherSite', order: 0 }],
    }))
    await doc.validate()
    expect(doc.quickSelectSites[0].site).toBe('OtherSite')
  })
})

// ─── Defaults (existing fields, unaffected by the new fields) ─────────────────

describe('ArCustomer — existing field defaults', () => {
  it('accepts a fully populated customer', () => {
    const doc = new ArCustomer(base({
      creditLimit: 5000,
      phone: '555-1234',
      email: 'ap@acme.com',
      notes: 'Net 30',
      fleetCardNumber: '1234567890123456',
      quickSelectSites: [{ stationName: 'Rankin', order: 0 }],
    }))
    expect(doc.validateSync()).toBeUndefined()
  })
})
