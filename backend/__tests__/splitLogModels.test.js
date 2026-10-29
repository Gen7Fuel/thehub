import { describe, expect, it } from 'vitest'
import AccessLog from '../models/AccessLog.js'
import ChangeLog from '../models/ChangeLog.js'

const common = {
  eventId: 'event-1',
  action: 'update',
  resourceType: 'location',
  success: true,
  statusCode: 200,
}

describe('split logging models', () => {
  it('stores request outcomes in the accesslogs collection', () => {
    const log = new AccessLog({
      ...common,
      eventType: 'access',
      method: 'PUT',
      path: '/api/locations/1',
    })

    expect(log.validateSync()).toBeUndefined()
    expect(AccessLog.collection.collectionName).toBe('accesslogs')
  })

  it('stores durable diffs in the changelogs collection', () => {
    const log = new ChangeLog({
      ...common,
      eventType: 'change',
      changes: [{ operation: 'replace', path: 'name', before: 'Old', after: 'New' }],
      changeSummary: { added: 0, removed: 0, replaced: 1, total: 1 },
    })

    expect(log.validateSync()).toBeUndefined()
    expect(ChangeLog.collection.collectionName).toBe('changelogs')
  })

  it('does not allow read events in durable change logs', () => {
    const error = new ChangeLog({ ...common, action: 'read' }).validateSync()
    expect(error?.errors.action).toBeDefined()
  })

  it('preserves PostgreSQL primary keys for single and bulk changes', () => {
    const log = new ChangeLog({
      ...common,
      resourceType: 'cycle-count-item',
      resourceId: 451,
      resourceIds: [451, 452, '453'],
      resourceStore: 'postgresql',
    })

    expect(log.validateSync()).toBeUndefined()
    expect(log.resourceId).toBe(451)
    expect(log.resourceIds).toEqual([451, 452, '453'])
    expect(log.resourceStore).toBe('postgresql')
  })
})
