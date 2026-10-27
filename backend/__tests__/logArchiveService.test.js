import { describe, expect, it } from 'vitest'

const {
  getArchiveCutoff,
  normalizeTypes,
  utcDatePath,
} = await import('../cron_jobs/logArchiveService.js')

describe('log archive UTC retention boundaries', () => {
  it('keeps October 25 and 26 when the job runs October 27 with two safe days', () => {
    expect(getArchiveCutoff(new Date('2026-10-27T01:00:00.000Z'), 2).toISOString())
      .toBe('2026-10-25T00:00:00.000Z')
  })

  it('keeps October 24 through 26 when configured with three safe days', () => {
    expect(getArchiveCutoff(new Date('2026-10-27T01:00:00.000Z'), 3).toISOString())
      .toBe('2026-10-24T00:00:00.000Z')
  })

  it('builds storage dates exclusively from UTC values', () => {
    expect(utcDatePath(new Date('2026-10-24T23:59:59.999Z'))).toEqual({
      year: '2026',
      month: '10',
      day: '24',
      label: '2026-10-24',
    })
  })

  it('defaults to both collections and rejects unknown collection types', () => {
    expect(normalizeTypes()).toEqual(['access', 'change'])
    expect(normalizeTypes(['change', 'change'])).toEqual(['change'])
    expect(() => normalizeTypes(['action'])).toThrow('Unknown log archive type: action')
  })
})
