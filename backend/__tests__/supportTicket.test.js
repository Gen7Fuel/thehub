import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import SupportTicket from '../models/Support.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  userId: new mongoose.Types.ObjectId(),
  text: 'The till is not balancing.',
  site: 'Rankin',
  ...overrides,
})

const baseMessage = (overrides = {}) => ({
  sender: new mongoose.Types.ObjectId(),
  text: 'Looking into it now.',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('SupportTicket — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new SupportTicket(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing userId', () => {
    const { userId, ...rest } = base()
    const err = new SupportTicket(rest).validateSync()
    expect(err?.errors.userId).toBeDefined()
  })

  it('rejects missing text', () => {
    const { text, ...rest } = base()
    const err = new SupportTicket(rest).validateSync()
    expect(err?.errors.text).toBeDefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = base()
    const err = new SupportTicket(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })
})

// ─── Priority enum ────────────────────────────────────────────────────────────

describe('SupportTicket — priority enum', () => {
  const validPriorities = ['low', 'medium', 'high', 'urgent']

  validPriorities.forEach((priority) => {
    it(`accepts priority "${priority}"`, () => {
      const doc = new SupportTicket(base({ priority }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.priority).toBe(priority)
    })
  })

  it('defaults priority to "medium"', () => {
    const doc = new SupportTicket(base())
    expect(doc.priority).toBe('medium')
  })

  it('rejects invalid priority', () => {
    const doc = new SupportTicket(base({ priority: 'critical' }))
    const err = doc.validateSync()
    expect(err?.errors.priority).toBeDefined()
  })
})

// ─── Status enum ─────────────────────────────────────────────────────────────

describe('SupportTicket — status enum', () => {
  const validStatuses = ['open', 'resolved', 'closed']

  validStatuses.forEach((status) => {
    it(`accepts status "${status}"`, () => {
      const doc = new SupportTicket(base({ status }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.status).toBe(status)
    })
  })

  it('defaults status to "open"', () => {
    const doc = new SupportTicket(base())
    expect(doc.status).toBe('open')
  })

  it('rejects invalid status', () => {
    const doc = new SupportTicket(base({ status: 'pending' }))
    const err = doc.validateSync()
    expect(err?.errors.status).toBeDefined()
  })
})

// ─── Defaults and optional fields ─────────────────────────────────────────

describe('SupportTicket — defaults and optional fields', () => {
  it('defaults images to an empty array', () => {
    const doc = new SupportTicket(base())
    expect(doc.images).toEqual([])
  })

  it('defaults messages to an empty array', () => {
    const doc = new SupportTicket(base())
    expect(doc.messages).toEqual([])
  })

  it('defaults createdAt to a Date', () => {
    const doc = new SupportTicket(base())
    expect(doc.createdAt).toBeInstanceOf(Date)
  })

  it('accepts optional images array', () => {
    const doc = new SupportTicket(base({ images: ['uuid-001.jpg', 'uuid-002.jpg'] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.images).toHaveLength(2)
  })
})

// ─── Nested message schema ─────────────────────────────────────────────────

describe('SupportTicket — nested message schema', () => {
  it('accepts a valid message', () => {
    const doc = new SupportTicket(base({ messages: [baseMessage()] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.messages).toHaveLength(1)
  })

  it('rejects a message with missing sender', () => {
    const { sender, ...rest } = baseMessage()
    const doc = new SupportTicket(base({ messages: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['messages.0.sender']).toBeDefined()
  })

  it('rejects a message with missing text', () => {
    const { text, ...rest } = baseMessage()
    const doc = new SupportTicket(base({ messages: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['messages.0.text']).toBeDefined()
  })

  it('defaults message createdAt to a Date', () => {
    const doc = new SupportTicket(base({ messages: [baseMessage()] }))
    expect(doc.messages[0].createdAt).toBeInstanceOf(Date)
  })

  it('accepts multiple messages', () => {
    const doc = new SupportTicket(base({
      messages: [
        baseMessage({ text: 'First reply' }),
        baseMessage({ text: 'Second reply' }),
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.messages).toHaveLength(2)
  })
})
