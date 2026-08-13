import { describe, it, expect } from 'vitest'
import { parseEmailList, resolveIssueRecipients } from '../utils/auditIssueRecipients.js'

// ─── parseEmailList ─────────────────────────────────────────────────────────

describe('parseEmailList', () => {
  it('splits comma-separated emails and trims whitespace', () => {
    expect(parseEmailList('a@example.com, b@example.com ,c@example.com'))
      .toEqual(['a@example.com', 'b@example.com', 'c@example.com'])
  })

  it('returns a single-element array for one email', () => {
    expect(parseEmailList('a@example.com')).toEqual(['a@example.com'])
  })

  it('filters out empty entries from leading/trailing/double commas', () => {
    expect(parseEmailList(',a@example.com,,b@example.com,')).toEqual(['a@example.com', 'b@example.com'])
  })

  it('returns an empty array for empty string, undefined, or null', () => {
    expect(parseEmailList('')).toEqual([])
    expect(parseEmailList(undefined)).toEqual([])
    expect(parseEmailList(null)).toEqual([])
  })

  it('returns an empty array for non-string input', () => {
    expect(parseEmailList(42)).toEqual([])
  })
})

// ─── resolveIssueRecipients ─────────────────────────────────────────────────

describe('resolveIssueRecipients', () => {
  it('falls back to the option default TO/CC when there is no site override', () => {
    const option = { text: 'Daksh', email: 'daksh@example.com', cc: 'ana@example.com,michelle@example.com' }
    const { to, cc } = resolveIssueRecipients({ option, site: 'Rankin', location: null })
    expect(to).toEqual(['daksh@example.com'])
    expect(cc).toEqual(['ana@example.com', 'michelle@example.com'])
  })

  it('uses the site override TO/CC when present, overriding the default', () => {
    const option = {
      text: 'Daksh',
      email: 'daksh@example.com',
      cc: 'default-cc@example.com',
      siteOverrides: [{ site: 'Rankin', to: 'rankin-daksh@example.com', cc: 'rankin-cc@example.com' }],
    }
    const { to, cc } = resolveIssueRecipients({ option, site: 'Rankin', location: null })
    expect(to).toEqual(['rankin-daksh@example.com'])
    expect(cc).toEqual(['rankin-cc@example.com'])
  })

  it('falls back to default TO when the override only sets cc', () => {
    const option = {
      text: 'Daksh',
      email: 'daksh@example.com',
      cc: 'default-cc@example.com',
      siteOverrides: [{ site: 'Rankin', to: '', cc: 'rankin-cc@example.com' }],
    }
    const { to, cc } = resolveIssueRecipients({ option, site: 'Rankin', location: null })
    expect(to).toEqual(['daksh@example.com'])
    expect(cc).toEqual(['rankin-cc@example.com'])
  })

  it('ignores a site override for a different site', () => {
    const option = {
      text: 'Daksh',
      email: 'daksh@example.com',
      siteOverrides: [{ site: 'Couchiching', to: 'other@example.com' }],
    }
    const { to } = resolveIssueRecipients({ option, site: 'Rankin', location: null })
    expect(to).toEqual(['daksh@example.com'])
  })

  it('Station Manager with no override uses Location.managerEmails', () => {
    const option = { text: 'Station Manager', email: 'unused@example.com' }
    const location = { managerEmails: ['mgr1@example.com', 'mgr2@example.com'], email: 'store@example.com' }
    const { to } = resolveIssueRecipients({ option, site: 'Rankin', location })
    expect(to).toEqual(['mgr1@example.com', 'mgr2@example.com'])
  })

  it('Station Manager with no override falls back to Location.email when managerEmails is empty', () => {
    const option = { text: 'Station Manager' }
    const location = { managerEmails: [], email: 'store@example.com' }
    const { to } = resolveIssueRecipients({ option, site: 'Rankin', location })
    expect(to).toEqual(['store@example.com'])
  })

  it('Station Manager with no override and no managerEmails/location.email resolves to no TO recipients', () => {
    const option = { text: 'Station Manager' }
    const location = { managerEmails: [], email: undefined }
    const { to } = resolveIssueRecipients({ option, site: 'Rankin', location })
    expect(to).toEqual([])
  })

  it('Station Manager site override TO wins over Location.managerEmails', () => {
    const option = {
      text: 'Station Manager',
      siteOverrides: [{ site: 'Rankin', to: 'override-manager@example.com' }],
    }
    const location = { managerEmails: ['mgr1@example.com'], email: 'store@example.com' }
    const { to } = resolveIssueRecipients({ option, site: 'Rankin', location })
    expect(to).toEqual(['override-manager@example.com'])
  })

  it('Station Manager CC resolves the same way as any other option (no dynamic lookup)', () => {
    const option = {
      text: 'Station Manager',
      cc: 'default-cc@example.com',
      siteOverrides: [{ site: 'Rankin', cc: 'rankin-cc@example.com' }],
    }
    const location = { managerEmails: ['mgr1@example.com'] }
    const { cc } = resolveIssueRecipients({ option, site: 'Rankin', location })
    expect(cc).toEqual(['rankin-cc@example.com'])
  })

  it('returns empty to/cc arrays when the option has nothing configured', () => {
    const { to, cc } = resolveIssueRecipients({ option: { text: 'Nobody' }, site: 'Rankin', location: null })
    expect(to).toEqual([])
    expect(cc).toEqual([])
  })
})
