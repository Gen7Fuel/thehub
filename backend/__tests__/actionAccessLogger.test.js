import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const enqueueAccessLog = vi.fn().mockResolvedValue(undefined)
const { default: actionAccessLogger } = await import('../middleware/actionAccessLogger.js')

function request(headers = {}, overrides = {}) {
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
    ...overrides,
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
  beforeEach(() => enqueueAccessLog.mockClear())

  it('queues the actual backend response status after the response finishes', async () => {
    const req = request(actionHeaders)
    const res = response(403)
    const next = vi.fn()

    actionAccessLogger({ enqueueAccessLog })(req, res, next)
    res.emit('finish')
    await Promise.resolve()

    expect(next).toHaveBeenCalledOnce()
    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'access',
      action: 'read',
      resourceType: 'permission',
      statusCode: 403,
      success: false,
      message: 'Permission modules viewed in Settings',
      path: '/api/permissions',
    }))
  })

  it('preserves an explicit logout action for session termination requests', async () => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({
      'X-Action-Type': 'logout',
      'X-Action-Resource': 'user',
      'X-Action-Source': 'navbar.session',
      'X-Action-Message': 'User logout requested from the navigation bar',
    }, {
      method: 'POST',
      originalUrl: '/api/auth/logout',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'logout',
      source: 'navbar.session',
      resourceType: 'user',
    }))
  })

  it('forwards successful read group IDs for queue-level deduplication', async () => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({
      ...actionHeaders,
      'X-Action-Group-Id': 'fuel-management.workspace.2026-10-29.abc123',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      accessGroupId: 'fuel-management.workspace.2026-10-29.abc123',
    }))
  })

  it.each([401, 403, 500])('never groups failed access attempts with status %s', async (statusCode) => {
    const res = response(statusCode)
    actionAccessLogger({ enqueueAccessLog })(request({
      ...actionHeaders,
      'X-Action-Group-Id': 'fuel-management.workspace.2026-10-29.abc123',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      statusCode,
      accessGroupId: undefined,
    }))
  })

  it('uses the client address resolved by Express instead of parsing a spoofable header', async () => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({
      'X-Forwarded-For': '192.0.2.99',
    }, {
      ip: '198.51.100.18',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      ip: '198.51.100.18',
    }))
  })

  it('uses method and path defaults for unannotated requests', async () => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request(), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'read',
      source: 'unknown',
      resourceType: 'permissions',
      message: 'User accessed /api/permissions',
      path: '/api/permissions',
    }))
  })

  it.each([
    '/api/locations',
    '/api/notification',
    '/api/notification/unread-count',
    '/api/notification/unread-summary',
  ])('uses application wording for the bootstrap GET %s', async (originalUrl) => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({}, { originalUrl }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      message: `Application request: GET ${originalUrl}`,
      path: originalUrl,
    }))
  })

  it('uses user-access wording for ordinary unannotated business routes', async () => {
    const res = response(304)
    actionAccessLogger({ enqueueAccessLog })(request({}, {
      originalUrl: '/api/audit/open-issues',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      message: 'User accessed /api/audit/open-issues',
      statusCode: 304,
      success: true,
    }))
  })

  it.each([
    '/api/health',
    '/api/maintenance',
    '/api/fuel-pricing/prices-ticker',
    '/api/fuel-pricing/check-pending-verification',
  ])('does not log a successful system poll to %s', async (originalUrl) => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({}, { originalUrl }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).not.toHaveBeenCalled()
  })

  it.each([401, 403, 500])('keeps failed system polls with status %s', async (statusCode) => {
    const res = response(statusCode)
    actionAccessLogger({ enqueueAccessLog })(
      request({}, { originalUrl: '/api/fuel-pricing/prices-ticker' }),
      res,
      vi.fn(),
    )
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      statusCode,
      success: false,
      source: 'unknown',
      path: '/api/fuel-pricing/prices-ticker',
    }))
  })

  it('continues logging maintenance mutations', async () => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({}, {
      method: 'POST',
      originalUrl: '/api/maintenance',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      method: 'POST',
      path: '/api/maintenance',
    }))
  })

  it.each([
    ['POST', 'create'],
    ['PUT', 'update'],
    ['PATCH', 'update'],
    ['DELETE', 'delete'],
  ])('maps %s requests to the %s action when the header is missing', async (method, action) => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({}, { method }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({ action }))
  })

  it('does not create access records for unsupported methods such as OPTIONS', () => {
    const res = response(204)
    actionAccessLogger({ enqueueAccessLog })(request({}, { method: 'OPTIONS' }), res, vi.fn())
    res.emit('finish')

    expect(enqueueAccessLog).not.toHaveBeenCalled()
  })

  it('falls back only for invalid fields and preserves valid context fields', async () => {
    const res = response(200)
    actionAccessLogger({ enqueueAccessLog })(request({
      'X-Action-Type': 'not-an-action',
      'X-Action-Resource': 'location',
      'X-Action-Source': 'invalid source',
      'X-Action-Message': 'Site picker opened from Desk',
    }), res, vi.fn())
    res.emit('finish')
    await Promise.resolve()

    expect(enqueueAccessLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'read',
      resourceType: 'location',
      source: 'unknown',
      message: 'Site picker opened from Desk',
    }))
  })
})
