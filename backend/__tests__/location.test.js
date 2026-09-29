import { describe, it, expect } from 'vitest'
import Location from '../models/Location.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  type: 'store',
  stationName: 'Rankin',
  legalName: 'Rankin Fuel Co',
  INDNumber: 'IND-1',
  csoCode: 'CSO-1',
  timezone: 'America/Toronto',
  email: 'rankin@example.com',
  managerCode: 1234,
  province: 'Ontario',
  ...overrides,
})

// ─── Registers field ──────────────────────────────────────────────────────────

describe('Location schema — registers field', () => {
  it('passes validation with no registers configured (defaults to an empty array)', () => {
    const loc = new Location(base())
    expect(loc.validateSync()).toBeUndefined()
    expect(loc.registers).toEqual([])
  })

  it('accepts a list of registers, each requiring a number', () => {
    const loc = new Location(base({ registers: [{ number: '1' }, { number: '2' }] }))
    expect(loc.validateSync()).toBeUndefined()
    expect(loc.registers.map((r) => r.number)).toEqual(['1', '2'])
  })

  it('rejects a register sub-document missing its number', () => {
    const loc = new Location(base({ registers: [{}] }))
    const err = loc.validateSync()
    expect(err?.errors['registers.0.number']).toBeDefined()
  })
})
