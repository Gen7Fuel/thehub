import { describe, expect, it } from 'vitest'
import { suggestVendorTags } from '../payableVendorTagsCache'
import type { VendorTagOption } from '../payableVendorTagsCache'

const tag = (vendorName: string, id: string): VendorTagOption => ({
  nameKey: vendorName.toLowerCase(),
  vendorName,
  sageVendorId: id,
  sageVendorName: vendorName,
})

const tags = [
  tag('Waste Management', 'V00059'),
  tag('Bell Canada', 'V00023'),
  tag('Canada Post', 'V00028'),
  tag('Global Payments', 'V00041'),
  tag('Bell Business Internet', 'V00024'),
]

describe('suggestVendorTags', () => {
  it('suggests nothing for an empty box', () => {
    expect(suggestVendorTags(tags, '   ')).toEqual([])
  })

  it('matches anywhere in the name, ignoring case', () => {
    expect(suggestVendorTags(tags, 'GLOBAL').map((t) => t.vendorName)).toEqual(['Global Payments'])
  })

  it('lists names that start with the text before names that merely contain it', () => {
    expect(suggestVendorTags(tags, 'canada').map((t) => t.vendorName)).toEqual(['Canada Post', 'Bell Canada'])
  })

  it('sorts each group A-Z', () => {
    expect(suggestVendorTags(tags, 'bell').map((t) => t.vendorName)).toEqual(['Bell Business Internet', 'Bell Canada'])
  })

  it('stays quiet when the only match is exactly what is typed', () => {
    expect(suggestVendorTags(tags, 'global payments')).toEqual([])
  })
})
