import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import SupportChat from '../models/SupportChat.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const base = (overrides = {}) => ({
  site: 'Rankin',
  initialMessage: 'Hi, I need help with my receipt.',
  customer: { id: new mongoose.Types.ObjectId() },
  ...overrides,
})

const baseMessage = (overrides = {}) => ({
  sender: new mongoose.Types.ObjectId(),
  text: 'How can I help you?',
  ...overrides,
})

// ─── Required field validation ────────────────────────────────────────────────

describe('SupportChat — required field validation', () => {
  it('passes with all required fields', () => {
    expect(new SupportChat(base()).validateSync()).toBeUndefined()
  })

  it('rejects missing site', () => {
    const { site, ...rest } = base()
    const err = new SupportChat(rest).validateSync()
    expect(err?.errors.site).toBeDefined()
  })

  it('rejects missing initialMessage', () => {
    const { initialMessage, ...rest } = base()
    const err = new SupportChat(rest).validateSync()
    expect(err?.errors.initialMessage).toBeDefined()
  })

  it('rejects missing customer.id', () => {
    const doc = new SupportChat({ ...base(), customer: {} })
    const err = doc.validateSync()
    expect(err?.errors['customer.id']).toBeDefined()
  })
})

// ─── Status enum ─────────────────────────────────────────────────────────────

describe('SupportChat — status enum', () => {
  const validStatuses = ['pending', 'accepted', 'expired', 'closed']

  validStatuses.forEach((status) => {
    it(`accepts status "${status}"`, () => {
      const doc = new SupportChat(base({ status }))
      expect(doc.validateSync()).toBeUndefined()
      expect(doc.status).toBe(status)
    })
  })

  it('defaults status to "pending"', () => {
    const doc = new SupportChat(base())
    expect(doc.status).toBe('pending')
  })

  it('rejects invalid status', () => {
    const doc = new SupportChat(base({ status: 'open' }))
    const err = doc.validateSync()
    expect(err?.errors.status).toBeDefined()
  })
})

// ─── Defaults and optional fields ─────────────────────────────────────────

describe('SupportChat — defaults and optional fields', () => {
  it('defaults messages to an empty array', () => {
    const doc = new SupportChat(base())
    expect(doc.messages).toEqual([])
  })

  it('defaults customer.name and customer.email to empty string', () => {
    const doc = new SupportChat(base())
    expect(doc.customer.name).toBe('')
    expect(doc.customer.email).toBe('')
  })

  it('leaves acceptedBy undefined when not set', () => {
    const doc = new SupportChat(base())
    expect(doc.acceptedBy?.id).toBeUndefined()
  })

  it('accepts acceptedBy with id and name', () => {
    const agentId = new mongoose.Types.ObjectId()
    const doc = new SupportChat(base({ acceptedBy: { id: agentId, name: 'Jane Support' } }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.acceptedBy.name).toBe('Jane Support')
  })

  it('accepts optional expiresAt as a Date', () => {
    const expiry = new Date(Date.now() + 5 * 60 * 1000)
    const doc = new SupportChat(base({ expiresAt: expiry }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.expiresAt).toEqual(expiry)
  })
})

// ─── Nested chat message schema ───────────────────────────────────────────────

describe('SupportChat — nested message schema', () => {
  it('accepts a valid chat message', () => {
    const doc = new SupportChat(base({ messages: [baseMessage()] }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.messages).toHaveLength(1)
  })

  it('rejects a message with missing sender', () => {
    const { sender, ...rest } = baseMessage()
    const doc = new SupportChat(base({ messages: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['messages.0.sender']).toBeDefined()
  })

  it('rejects a message with missing text', () => {
    const { text, ...rest } = baseMessage()
    const doc = new SupportChat(base({ messages: [rest] }))
    const err = doc.validateSync()
    expect(err?.errors['messages.0.text']).toBeDefined()
  })

  it('defaults message senderName to empty string', () => {
    const doc = new SupportChat(base({ messages: [baseMessage()] }))
    expect(doc.messages[0].senderName).toBe('')
  })

  it('defaults message createdAt to a Date', () => {
    const doc = new SupportChat(base({ messages: [baseMessage()] }))
    expect(doc.messages[0].createdAt).toBeInstanceOf(Date)
  })

  it('accepts multiple messages', () => {
    const doc = new SupportChat(base({
      messages: [
        baseMessage({ text: 'Hi there!' }),
        baseMessage({ text: 'I can help with that.' }),
      ],
    }))
    expect(doc.validateSync()).toBeUndefined()
    expect(doc.messages).toHaveLength(2)
  })
})
