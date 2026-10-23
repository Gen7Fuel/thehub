import { describe, expect, it } from 'vitest'
import ActionLog from '../models/ActionLog.js'

const baseLog = (overrides = {}) => ({
  eventId: 'event-1',
  eventType: 'access',
  action: 'read',
  resourceType: 'permission',
  success: true,
  statusCode: 200,
  message: 'Permission modules viewed in Settings',
  source: 'settings.permissions',
  method: 'GET',
  path: '/api/permissions',
  ...overrides,
})

describe('ActionLog schema', () => {
  it('accepts an access log with frontend purpose and backend response metadata', () => {
    expect(new ActionLog(baseLog()).validateSync()).toBeUndefined()
  })

  it('defaults legacy and route-level records to change events', () => {
    const log = new ActionLog(baseLog({ eventId: undefined, eventType: undefined }))
    expect(log.validateSync()).toBeUndefined()
    expect(log.eventType).toBe('change')
  })

  it('rejects unsupported event types', () => {
    const error = new ActionLog(baseLog({ eventType: 'request' })).validateSync()
    expect(error?.errors.eventType).toBeDefined()
  })
})
