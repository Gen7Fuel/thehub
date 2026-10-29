import { describe, expect, it } from 'vitest'
import clientIp from '../utils/clientIp.js'

const { getClientIp, normalizeClientIp } = clientIp

describe('client IP resolution', () => {
  it('normalizes IPv4-mapped IPv6 addresses', () => {
    expect(normalizeClientIp('::ffff:203.0.113.42')).toBe('203.0.113.42')
  })

  it('uses the address already resolved by Express', () => {
    const req = {
      ip: '198.51.100.18',
      headers: { 'x-forwarded-for': '192.0.2.99' },
      socket: { remoteAddress: '172.22.0.8' },
    }

    expect(getClientIp(req)).toBe('198.51.100.18')
  })

  it('falls back to the socket address when no resolved IP is available', () => {
    expect(getClientIp({ socket: { remoteAddress: '::ffff:172.22.0.8' } })).toBe('172.22.0.8')
  })
})
