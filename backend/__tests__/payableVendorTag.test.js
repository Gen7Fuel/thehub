import { describe, it, expect } from 'vitest'
import PayableVendorTag from '../models/PayableVendorTag.js'

describe('PayableVendorTag.normalizeName', () => {
  it('ignores case, outer whitespace and repeated spaces', () => {
    expect(PayableVendorTag.normalizeName('  Global   Payments ')).toBe('global payments')
    expect(PayableVendorTag.normalizeName('GLOBAL PAYMENTS')).toBe(PayableVendorTag.normalizeName('global payments'))
  })

  it('handles empty input', () => {
    expect(PayableVendorTag.normalizeName(undefined)).toBe('')
  })
})

describe('PayableVendorTag schema', () => {
  const base = () => ({ nameKey: 'global payments', vendorName: 'Global Payments', sageVendorId: 'V00041', sageVendorName: 'Global Payments' })

  it('accepts a complete tag', () => {
    expect(new PayableVendorTag(base()).validateSync()).toBeUndefined()
  })

  it.each(['nameKey', 'vendorName', 'sageVendorId', 'sageVendorName'])('requires %s', (field) => {
    const doc = new PayableVendorTag({ ...base(), [field]: undefined })
    expect(doc.validateSync()?.errors[field]).toBeDefined()
  })
})
