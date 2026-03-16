import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
// Import models directly — no DB connection required for schema validation tests.
// Do NOT import config/db.js here.
import AuditTemplate from '../models/audit/auditTemplate.js'
import AuditInstance from '../models/audit/auditInstance.js'
import AuditItem from '../models/audit/auditItem.js'
import SelectTemplate from '../models/audit/selectTemplate.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const baseTemplate = (overrides = {}) => ({
  name: 'Daily Checklist',
  ...overrides,
})

const baseInstance = (overrides = {}) => ({
  template: new mongoose.Types.ObjectId(),
  site: 'Rankin',
  frequency: 'daily',
  periodKey: '2026-03-13',
  type: 'store',
  ...overrides,
})

const baseItem = (overrides = {}) => ({
  instance: new mongoose.Types.ObjectId(),
  item: 'Check fuel pump',
  frequency: 'daily',
  ...overrides,
})

const baseSelectTemplate = (overrides = {}) => ({
  name: 'Category',
  ...overrides,
})

// ─── AuditTemplate schema ──────────────────────────────────────────────────────

describe('AuditTemplate schema — field validation', () => {
  it('passes with required name only', () => {
    expect(new AuditTemplate(baseTemplate()).validateSync()).toBeUndefined()
  })

  it('rejects missing name', () => {
    const err = new AuditTemplate({}).validateSync()
    expect(err?.errors.name).toBeDefined()
  })

  it('accepts optional description', () => {
    const doc = new AuditTemplate(baseTemplate({ description: 'Morning shift checklist' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.description).toBe('Morning shift checklist')
  })

  it('accepts items array with required item field', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{ item: 'Check pump', category: 'Fuel', frequency: 'daily' }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items).toHaveLength(1)
    expect(doc.items[0].item).toBe('Check pump')
    expect(doc.items[0].category).toBe('Fuel')
  })

  it('defaults item frequency to daily', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{ item: 'Check pump' }],
    }))
    expect(doc.items[0].frequency).toBe('daily')
  })

  it('rejects invalid frequency on item', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{ item: 'Check pump', frequency: 'hourly' }],
    }))
    expect(doc.validateSync()?.errors['items.0.frequency']).toBeDefined()
  })

  it('accepts all valid item frequency values', () => {
    for (const freq of ['daily', 'weekly', 'monthly']) {
      const doc = new AuditTemplate(baseTemplate({ items: [{ item: 'X', frequency: freq }] }))
      expect(doc.validateSync()).toBeUndefined()
    }
  })

  it('defaults item commentRequired to false', () => {
    const doc = new AuditTemplate(baseTemplate({ items: [{ item: 'Check pump' }] }))
    expect(doc.items[0].commentRequired).toBe(false)
  })

  it('accepts commentRequired: true on item', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{ item: 'Check pump', commentRequired: true }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].commentRequired).toBe(true)
  })

  it('accepts assignedSites within items', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{
        item: 'Check pump',
        assignedSites: [{ site: 'Rankin', assigned: true, issueRaised: false }],
      }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].assignedSites[0].site).toBe('Rankin')
    expect(doc.items[0].assignedSites[0].assigned).toBe(true)
  })

  it('defaults assignedSite assigned and issueRaised to false', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{ item: 'Check pump', assignedSites: [{ site: 'Rankin' }] }],
    }))
    expect(doc.items[0].assignedSites[0].assigned).toBe(false)
    expect(doc.items[0].assignedSites[0].issueRaised).toBe(false)
  })

  it('defaults assignedSite lastChecked to null', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{ item: 'Check pump', assignedSites: [{ site: 'Rankin' }] }],
    }))
    expect(doc.items[0].assignedSites[0].lastChecked).toBeNull()
  })

  it('accepts sites array', () => {
    const doc = new AuditTemplate(baseTemplate({ sites: ['Rankin', 'Couchiching'] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.sites).toEqual(['Rankin', 'Couchiching'])
  })

  it('accepts optional fields on items', () => {
    const doc = new AuditTemplate(baseTemplate({
      items: [{
        item: 'Check pump',
        statusTemplate: 'OK / Not OK',
        followUpTemplate: 'N/A',
        assignedTo: 'Manager',
        suppliesVendor: 'Acme',
      }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.items[0].suppliesVendor).toBe('Acme')
  })

  it('defaults createdAt to now', () => {
    const before = Date.now()
    const doc = new AuditTemplate(baseTemplate())
    expect(doc.createdAt.getTime()).toBeGreaterThanOrEqual(before)
  })
})

// ─── AuditInstance schema ──────────────────────────────────────────────────────

describe('AuditInstance schema — field validation', () => {
  it('passes with all required fields', () => {
    expect(new AuditInstance(baseInstance()).validateSync()).toBeUndefined()
  })

  it('rejects missing template', () => {
    const { template, ...rest } = baseInstance()
    expect(new AuditInstance(rest).validateSync()?.errors.template).toBeDefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = baseInstance()
    expect(new AuditInstance(rest).validateSync()?.errors.site).toBeDefined()
  })

  it('rejects missing frequency', () => {
    const { frequency, ...rest } = baseInstance()
    expect(new AuditInstance(rest).validateSync()?.errors.frequency).toBeDefined()
  })

  it('rejects invalid frequency', () => {
    expect(new AuditInstance(baseInstance({ frequency: 'yearly' })).validateSync()?.errors.frequency).toBeDefined()
  })

  it('accepts all valid frequency values', () => {
    for (const freq of ['daily', 'weekly', 'monthly']) {
      expect(new AuditInstance(baseInstance({ frequency: freq })).validateSync()).toBeUndefined()
    }
  })

  it('rejects missing periodKey', () => {
    const { periodKey, ...rest } = baseInstance()
    expect(new AuditInstance(rest).validateSync()?.errors.periodKey).toBeDefined()
  })

  it('defaults type to store when omitted', () => {
    const { type, ...rest } = baseInstance()
    const doc = new AuditInstance(rest)
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.type).toBe('store')
  })

  it('rejects invalid type', () => {
    expect(new AuditInstance(baseInstance({ type: 'manager' })).validateSync()?.errors.type).toBeDefined()
  })

  it('accepts type: store', () => {
    expect(new AuditInstance(baseInstance({ type: 'store' })).validateSync()).toBeUndefined()
  })

  it('accepts type: visitor', () => {
    expect(new AuditInstance(baseInstance({ type: 'visitor' })).validateSync()).toBeUndefined()
  })

  it('accepts weekly period key format', () => {
    const doc = new AuditInstance(baseInstance({ frequency: 'weekly', periodKey: '2026-W11' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('accepts monthly period key format', () => {
    const doc = new AuditInstance(baseInstance({ frequency: 'monthly', periodKey: '2026-03' }))
    expect(doc.validateSync()).toBeUndefined()
  })

  it('accepts optional completedBy and completedAt', () => {
    const doc = new AuditInstance(baseInstance({
      completedBy: new mongoose.Types.ObjectId(),
      completedAt: new Date('2026-03-13T14:00:00Z'),
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.completedAt).toBeInstanceOf(Date)
  })
})

// ─── AuditItem schema ──────────────────────────────────────────────────────────

describe('AuditItem schema — field validation', () => {
  it('passes with all required fields', () => {
    expect(new AuditItem(baseItem()).validateSync()).toBeUndefined()
  })

  it('rejects missing instance', () => {
    const { instance, ...rest } = baseItem()
    expect(new AuditItem(rest).validateSync()?.errors.instance).toBeDefined()
  })

  it('rejects missing item text', () => {
    const { item, ...rest } = baseItem()
    expect(new AuditItem(rest).validateSync()?.errors.item).toBeDefined()
  })

  it('rejects missing frequency', () => {
    const { frequency, ...rest } = baseItem()
    expect(new AuditItem(rest).validateSync()?.errors.frequency).toBeDefined()
  })

  it('rejects invalid frequency', () => {
    expect(new AuditItem(baseItem({ frequency: 'yearly' })).validateSync()?.errors.frequency).toBeDefined()
  })

  it('accepts all valid frequency values', () => {
    for (const freq of ['daily', 'weekly', 'monthly']) {
      expect(new AuditItem(baseItem({ frequency: freq })).validateSync()).toBeUndefined()
    }
  })

  it('defaults checked to false', () => {
    expect(new AuditItem(baseItem()).checked).toBe(false)
  })

  it('defaults checkedAt to null', () => {
    expect(new AuditItem(baseItem()).checkedAt).toBeNull()
  })

  it('defaults commentRequired to false', () => {
    expect(new AuditItem(baseItem()).commentRequired).toBe(false)
  })

  it('defaults orderCreated to false', () => {
    expect(new AuditItem(baseItem()).orderCreated).toBe(false)
  })

  it('accepts checked: true with checkedAt date', () => {
    const now = new Date()
    const doc = new AuditItem(baseItem({ checked: true, checkedAt: now }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.checked).toBe(true)
    expect(doc.checkedAt).toEqual(now)
  })

  it('accepts optional text fields', () => {
    const doc = new AuditItem(baseItem({
      category: 'Fuel',
      status: 'OK',
      followUp: 'N/A',
      assignedTo: 'Manager',
      comment: 'All clear',
      statusTemplate: 'OK / Not OK',
      followUpTemplate: 'N/A',
      suppliesVendor: 'Acme',
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.category).toBe('Fuel')
    expect(doc.comment).toBe('All clear')
  })

  it('accepts issue tracking fields', () => {
    const doc = new AuditItem(baseItem({
      issueRaised: true,
      currentIssueStatus: 'In Progress',
      issueStatus: [
        { status: 'Created', timestamp: new Date('2026-03-10T08:00:00Z') },
        { status: 'In Progress', timestamp: new Date('2026-03-11T10:00:00Z') },
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.issueRaised).toBe(true)
    expect(doc.currentIssueStatus).toBe('In Progress')
    expect(doc.issueStatus).toHaveLength(2)
    expect(doc.issueStatus[0].status).toBe('Created')
  })

  it('accepts photos as a string array', () => {
    const doc = new AuditItem(baseItem({ photos: ['uuid1.jpg', 'uuid2.png'] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.photos).toHaveLength(2)
    expect(doc.photos[0]).toBe('uuid1.jpg')
  })

  it('accepts requestOrder and orderCreated flags', () => {
    const doc = new AuditItem(baseItem({ requestOrder: true, orderCreated: true }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.requestOrder).toBe(true)
    expect(doc.orderCreated).toBe(true)
  })
})

// ─── SelectTemplate schema ─────────────────────────────────────────────────────

describe('SelectTemplate schema — field validation', () => {
  it('passes with required name only', () => {
    expect(new SelectTemplate(baseSelectTemplate()).validateSync()).toBeUndefined()
  })

  it('rejects missing name', () => {
    expect(new SelectTemplate({}).validateSync()?.errors.name).toBeDefined()
  })

  it('accepts optional description', () => {
    const doc = new SelectTemplate(baseSelectTemplate({ description: 'Checklist status options' }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.description).toBe('Checklist status options')
  })

  it('accepts options array with required text', () => {
    const doc = new SelectTemplate(baseSelectTemplate({
      options: [
        { text: 'Created' },
        { text: 'In Progress', email: 'manager@example.com' },
        { text: 'Resolved' },
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.options).toHaveLength(3)
    expect(doc.options[0].text).toBe('Created')
    expect(doc.options[1].email).toBe('manager@example.com')
  })

  it('rejects option with missing text', () => {
    const doc = new SelectTemplate(baseSelectTemplate({
      options: [{ email: 'someone@example.com' }],
    }))
    expect(doc.validateSync()?.errors['options.0.text']).toBeDefined()
  })

  it('accepts empty options array', () => {
    const doc = new SelectTemplate(baseSelectTemplate({ options: [] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.options).toHaveLength(0)
  })

  it('accepts option without email (email is optional)', () => {
    const doc = new SelectTemplate(baseSelectTemplate({
      options: [{ text: 'Resolved' }],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.options[0].email).toBeUndefined()
  })

  it('defaults createdAt to now', () => {
    const before = Date.now()
    const doc = new SelectTemplate(baseSelectTemplate())
    expect(doc.createdAt.getTime()).toBeGreaterThanOrEqual(before)
  })
})
