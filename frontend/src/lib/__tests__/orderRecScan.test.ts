import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }))
vi.mock('axios', () => ({ default: { get: mockGet } }))

import {
  buildMissingItemMessage,
  findItemByScan,
  lookupItemName,
  parseCount,
  scanDigits,
  toGtin14,
} from '../orderRecScan'

const categories = [
  { items: [{ gtin: '00049000028911' }, { gtin: ' 0 0 6 1 ' }] },
  { items: [{ gtin: '00012345678905' }] },
]

describe('toGtin14 / scanDigits', () => {
  it('pads a UPC-A or EAN-13 to 14 digits and strips non-digits', () => {
    expect(toGtin14('049000028911')).toBe('00049000028911')
    expect(toGtin14('0049000028911')).toBe('00049000028911')
    expect(toGtin14('00049000028911')).toBe('00049000028911')
    expect(scanDigits('0490-0002 8911')).toBe('049000028911')
    expect(toGtin14('')).toBe('')
  })
})

describe('findItemByScan', () => {
  it('matches a 12-, 13- or 14-digit form of the same code', () => {
    expect(findItemByScan(categories, '049000028911')).toEqual({ catIdx: 0, itemIdx: 0 })
    expect(findItemByScan(categories, '0049000028911')).toEqual({ catIdx: 0, itemIdx: 0 })
    expect(findItemByScan(categories, '012345678905')).toEqual({ catIdx: 1, itemIdx: 0 })
  })

  it('returns null for an unknown, empty or non-numeric code', () => {
    expect(findItemByScan(categories, '999999999999')).toBeNull()
    expect(findItemByScan(categories, '')).toBeNull()
    expect(findItemByScan(categories, '0000')).toBeNull()
    expect(findItemByScan(undefined, '049000028911')).toBeNull()
  })
})

describe('parseCount', () => {
  it('accepts whole numbers including 0 and rejects the rest', () => {
    expect(parseCount('12')).toBe(12)
    expect(parseCount(' 0 ')).toBe(0)
    expect(parseCount('')).toBeNull()
    expect(parseCount('-1')).toBeNull()
    expect(parseCount('1.5')).toBeNull()
    expect(parseCount('12a')).toBeNull()
  })
})

describe('buildMissingItemMessage', () => {
  it('includes the name when known', () => {
    expect(buildMissingItemMessage({ name: 'Coke 591ml', gtin: '00049000028911', count: 12 })).toBe(
      'Not on this order rec: Coke 591ml, GTIN 00049000028911, count: 12',
    )
  })

  it('leaves the name out when unknown', () => {
    expect(buildMissingItemMessage({ name: null, gtin: '00049000028911', count: 0 })).toBe(
      'Not on this order rec: GTIN 00049000028911, count: 0',
    )
  })
})

describe('lookupItemName', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('returns the name from the first form that is found', async () => {
    mockGet.mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce({ data: { name: ' Coke 591ml ' } })
    await expect(lookupItemName('0049000028911', 'Charlies')).resolves.toBe('Coke 591ml')
    expect(mockGet.mock.calls[0][1].params).toEqual({ upc_barcode: '0049000028911', site: 'Charlies' })
    expect(mockGet.mock.calls[1][1].params).toEqual({ upc_barcode: '49000028911', site: 'Charlies' })
  })

  it('returns null when nothing is found or there is no site', async () => {
    mockGet.mockImplementation(async () => { throw new Error('403') })
    await expect(lookupItemName('0049000028911', 'Charlies')).resolves.toBeNull()
    await expect(lookupItemName('0049000028911', undefined)).resolves.toBeNull()
  })
})
