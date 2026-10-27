import { describe, expect, it } from 'vitest'
import { requestConfig } from '../request-context'

describe('requestConfig', () => {
  it('adds permission and human-readable action context headers', () => {
    const config = requestConfig({
      permission: 'settings',
      actionContext: {
        action: 'read',
        resourceType: 'permission',
        source: 'settings.permissions',
        message: 'Permission modules viewed in Settings',
      },
    })

    expect(config.headers).toMatchObject({
      'X-Required-Permission': 'settings',
      'X-Action-Type': 'read',
      'X-Action-Resource': 'permission',
      'X-Action-Source': 'settings.permissions',
      'X-Action-Message': 'Permission modules viewed in Settings',
    })
  })

  it('removes line breaks and limits action messages', () => {
    const config = requestConfig({
      actionContext: {
        action: 'update',
        resourceType: 'permission',
        source: 'settings.permissions',
        message: `Updated\r\n${'x'.repeat(600)}`,
      },
    })

    const headers = config.headers as Record<string, string>
    expect(headers['X-Action-Message']).not.toMatch(/[\r\n]/)
    expect(headers['X-Action-Message']).toHaveLength(500)
  })
})
