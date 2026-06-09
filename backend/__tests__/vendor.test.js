import { describe, it, expect } from 'vitest'
import Vendor from '../models/Vendor.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  name: 'Pepsi Beverages',
  location: 'Rankin',
  ...overrides,
})

const baseSupply = (overrides = {}) => ({
  name: 'Pepsi 355ml',
  vin: 'VIN-001',
  upc: '012345678901',
  size: '355ml',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('Vendor — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new Vendor(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing name', () => {
    const { name, ...rest } = base()
    const err = new Vendor(rest).validateSync()
    expect(err?.errors.name).toBeDefined()
  })

  it('rejects missing location', () => {
    const { location, ...rest } = base()
    const err = new Vendor(rest).validateSync()
    expect(err?.errors.location).toBeDefined()
  })
})

// ─── Order placement method enum ──────────────────────────────────────────────

describe('Vendor — order_placement_method enum', () => {
  const validMethods = ['Email', 'Template', 'Web Portal', 'Telephone']

  validMethods.forEach((method) => {
    it(`accepts order_placement_method "${method}"`, () => {
      const doc = new Vendor(base({ order_placement_method: method }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.order_placement_method).toBe(method)
    })
  })

  it('defaults order_placement_method to "Email"', () => {
    const doc = new Vendor(base())
    expect(doc.order_placement_method).toBe('Email')
  })

  it('rejects invalid order_placement_method', () => {
    const doc = new Vendor(base({ order_placement_method: 'Fax' }))
    const err = doc.validateSync()
    expect(err?.errors.order_placement_method).toBeDefined()
  })
})

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('Vendor — defaults', () => {
  it('defaults email_order to false', () => {
    const doc = new Vendor(base())
    expect(doc.email_order).toBe(false)
  })

  it('defaults station_supplies to an empty array', () => {
    const doc = new Vendor(base())
    expect(doc.station_supplies).toEqual([])
  })

  it('defaults leadTime to null', () => {
    const doc = new Vendor(base())
    expect(doc.leadTime).toBeNull()
  })
})

// ─── Station supplies nested schema ───────────────────────────────────────────

describe('Vendor — station_supplies nested schema', () => {
  it('passes with a valid station supply', () => {
    const doc = new Vendor(base({ station_supplies: [baseSupply()] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.station_supplies).toHaveLength(1)
  })

  it('rejects supply missing name', () => {
    const { name, ...rest } = baseSupply()
    const doc = new Vendor(base({ station_supplies: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['station_supplies.0.name']).toBeDefined()
  })

  it('rejects supply missing vin', () => {
    const { vin, ...rest } = baseSupply()
    const doc = new Vendor(base({ station_supplies: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['station_supplies.0.vin']).toBeDefined()
  })

  it('rejects supply missing upc', () => {
    const { upc, ...rest } = baseSupply()
    const doc = new Vendor(base({ station_supplies: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['station_supplies.0.upc']).toBeDefined()
  })

  it('rejects supply missing size', () => {
    const { size, ...rest } = baseSupply()
    const doc = new Vendor(base({ station_supplies: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['station_supplies.0.size']).toBeDefined()
  })

  it('accepts multiple station supplies', () => {
    const doc = new Vendor(base({
      station_supplies: [
        baseSupply({ name: 'Pepsi 355ml', vin: 'V1' }),
        baseSupply({ name: 'Pepsi 591ml', vin: 'V2', upc: '012345678902' }),
        baseSupply({ name: 'Diet Pepsi 355ml', vin: 'V3', upc: '012345678903' }),
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.station_supplies).toHaveLength(3)
  })
})

// ─── Optional fields ──────────────────────────────────────────────────────────

describe('Vendor — optional fields', () => {
  it('accepts optional category', () => {
    const doc = new Vendor(base({ category: 'Convenience' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.category).toBe('Convenience')
  })

  it('accepts optional email', () => {
    const doc = new Vendor(base({ email: 'orders@pepsi.com' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.email).toBe('orders@pepsi.com')
  })

  it('accepts optional vendor_order_frequency', () => {
    const doc = new Vendor(base({ vendor_order_frequency: 2 }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.vendor_order_frequency).toBe(2)
  })

  it('accepts optional leadTime', () => {
    const doc = new Vendor(base({ leadTime: 3 }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.leadTime).toBe(3)
  })

  it('accepts optional notes', () => {
    const doc = new Vendor(base({ notes: 'Deliveries on Tuesdays only.' }))
    expect(doc.validateSync()).toBeUndefined()
  })
})
