import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const enqueueActionLog = vi.fn().mockResolvedValue(undefined)
const { default: actionAccessLogger } = await import('../middleware/actionAccessLogger.js')

function request(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  return {
    get: (name) => normalized[name.toLowerCase()],
    headers: normalized,
    method: 'GET',
    originalUrl: '/api/permissions?unused=true',
    requestId: 'request-1',
    ip: '127.0.0.1',
    user: {
      _id: '689ca072bd477b17a279045c',
      email: 'admin@example.com',
      role: { role_name: 'Administrator' },
      stationName: 'Rankin',
    },
  }
}

function response(statusCode) {
  const res = new EventEmitter()
  res.statusCode = statusCode
  return res
}

const actionHeaders = {
  'X-Action-Type': 'read',
  'X-Action-Resource': 'permission',
  'X-Action-Source': 'settings.permissions',
  'X-Action-Message': 'Permission modules viewed in Settings',
}

describe('actionAccessLogger', () => {
  beforeEach(() => enqueueActionLog.mockClear())

  it('queues the actual backend response status after the response finishes', async () => {
    const req = request(actionHeaders)
    const res = response(403)
    const next = vi.fn()

    actionAccessLogger({ enqueueActionLog })(req, res, next)
    res.emit('finish')
    await Promise.resolve()

    expect(next).toHaveBeenCalledOnce()
    expect(enqueueActionLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'access',
      action: 'read',
      resourceType: 'permission',
      statusCode: 403,
      success: false,
      message: 'Permission modules viewed in Settings',
      path: '/api/permissions',
    }))
  })

  it('does not log unannotated requests', () => {
    const res = response(200)
    actionAccessLogger({ enqueueActionLog })(request(), res, vi.fn())
    res.emit('finish')
    expect(enqueueActionLog).not.toHaveBeenCalled()
  })
})
