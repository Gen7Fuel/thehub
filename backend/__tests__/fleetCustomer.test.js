import { describe, it, expect } from 'vitest'
// Import models directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import FleetCustomer from '../models/FleetCustomer.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseCustomer = (overrides = {}) => ({
  name: 'Apex Logistics Ltd.',
  email: 'apex@example.com',
  ...overrides,
})

// ─── FleetCustomer schema — required fields ────────────────────────────────────

describe('FleetCustomer schema — required fields', () => {
  it('passes validation with only name + email', () => {
    expect(new FleetCustomer(baseCustomer()).validateSync()).toBeUndefined()
  })

  it('rejects a missing name', () => {
    const { name, ...rest } = baseCustomer()
    const err = new FleetCustomer(rest).validateSync()
    expect(err?.errors.name).toBeDefined()
  })

  it('rejects a missing email', () => {
    const { email, ...rest } = baseCustomer()
    const err = new FleetCustomer(rest).validateSync()
    expect(err?.errors.email).toBeDefined()
  })
})

// ─── FleetCustomer schema — optional credential fields ────────────────────────

describe('FleetCustomer schema — optional credential fields', () => {
  it('passes validation when username and password are both omitted', () => {
    expect(new FleetCustomer(baseCustomer()).validateSync()).toBeUndefined()
  })

  it('passes validation when username and password are both provided', () => {
    const doc = new FleetCustomer(baseCustomer({ username: 'apex_user', password: 's3cr3t' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('passes validation when only username is provided (password is optional)', () => {
    const doc = new FleetCustomer(baseCustomer({ username: 'apex_user' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('stores username as lowercase', () => {
    const doc = new FleetCustomer(baseCustomer({ username: 'APEX_USER' }))
    expect(doc.username).toBe('apex_user')
  })

  it('trims whitespace from username', () => {
    const doc = new FleetCustomer(baseCustomer({ username: '  apex_user  ' }))
    expect(doc.username).toBe('apex_user')
  })
})

// ─── FleetCustomer schema — defaults ──────────────────────────────────────────

describe('FleetCustomer schema — defaults', () => {
  it('isActive defaults to true when not provided', () => {
    const doc = new FleetCustomer(baseCustomer())
    expect(doc.isActive).toBe(true)
  })
})
