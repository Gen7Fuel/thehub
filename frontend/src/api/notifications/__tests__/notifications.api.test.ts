import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { notificationsService } from '../notifications.service'

describe('Notifications API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.values(mocks).forEach((mock) => mock.mockResolvedValue({ data: {} }))
  })

  it('keeps shell polling header-free for application-request classification', async () => {
    await notificationsService.pollInbox()
    await notificationsService.pollUnreadCount()
    await notificationsService.pollUnreadSummary()
    await notificationsService.dismissSummary()
    for (const call of [...mocks.get.mock.calls, ...mocks.post.mock.calls]) {
      expect(call.at(-1).headers).toEqual({})
    }
  })

  it('annotates deliberate inbox, sent, and detail reads', async () => {
    await notificationsService.listInbox()
    await notificationsService.listSent()
    await notificationsService.get('notification-1', 'Fuel update')
    expect(mocks.get.mock.calls[0][1].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'notification',
      'X-Action-Message': 'Notification inbox viewed',
    }))
    expect(mocks.get.mock.calls[2][1].headers['X-Action-Message']).toContain('Fuel update')
  })

  it('records readable notification and template mutation intent', async () => {
    await notificationsService.send({ subject: 'Policy update', recipientIds: ['1', '2'], bccUserIds: ['2', '3'] })
    await notificationsService.saveTemplate({ _id: 'template-1', name: 'Policy' })
    await notificationsService.deleteTemplate('template-1', 'Policy')
    expect(mocks.post.mock.calls[0][2].headers['X-Action-Message']).toContain('3 recipients')
    expect(mocks.post.mock.calls[1][2].headers['X-Action-Type']).toBe('update')
    expect(mocks.delete.mock.calls[0][1].headers['X-Action-Message']).toContain('Policy')
  })

  it('prevents active Notification pages from reintroducing direct API calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const frontendSrc = path.resolve(testDir, '../../..')
    const files = [
      'routes/_navbarLayout/notification/index.tsx',
      'routes/_navbarLayout/notification/create.tsx',
      'routes/_navbarLayout/notification/template/list.tsx',
      'routes/_navbarLayout/notification/template/index.tsx',
      'routes/_navbarLayout/notification-old.tsx',
    ]
    for (const relative of files) {
      const source = fs.readFileSync(path.join(frontendSrc, relative), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source).not.toMatch(/(?:axios\.(?:get|post|put|patch|delete)|fetch)\s*\(/)
      expect(source).not.toMatch(/["'`]\/api\//)
    }
  })
})
