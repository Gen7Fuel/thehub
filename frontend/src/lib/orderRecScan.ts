// Helpers for the order rec barcode scanner: matching a scanned code to an item
// and building the message sent for an item that isn't on the order rec.

import axios from 'axios'

export interface ScanItemRef {
  catIdx: number
  itemIdx: number
}

/** Digits only; scanners and spreadsheets sometimes add spaces or dashes. */
export const scanDigits = (raw: unknown): string => String(raw ?? '').replace(/\D/g, '')

const stripLeadingZeros = (digits: string) => digits.replace(/^0+/, '')

/**
 * The code as a 14-digit GTIN. A UPC-A (12) or EAN-13 is the same number with
 * leading zeros, which is how the order rec stores it.
 */
export function toGtin14(raw: unknown): string {
  const digits = scanDigits(raw)
  return digits.length > 0 && digits.length < 14 ? digits.padStart(14, '0') : digits
}

/**
 * The item a scanned code belongs to. Compared without leading zeros so a
 * 12-digit UPC-A, a 13-digit EAN and a 14-digit GTIN of the same product match.
 */
export function findItemByScan(
  categories: ReadonlyArray<{ items?: ReadonlyArray<{ gtin?: unknown }> }> | null | undefined,
  raw: unknown,
): ScanItemRef | null {
  const wanted = stripLeadingZeros(scanDigits(raw))
  if (!wanted) return null
  for (let catIdx = 0; catIdx < (categories?.length ?? 0); catIdx++) {
    const items = categories![catIdx].items ?? []
    for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
      if (stripLeadingZeros(scanDigits(items[itemIdx].gtin)) === wanted) return { catIdx, itemIdx }
    }
  }
  return null
}

/** A whole number, 0 or more. Anything else is null. */
export function parseCount(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isSafeInteger(n) ? n : null
}

export function buildMissingItemMessage({
  name,
  gtin,
  count,
}: {
  name?: string | null
  gtin: string
  count: number
}): string {
  const label = name?.trim() ? `${name.trim()}, ` : ''
  return `Not on this order rec: ${label}GTIN ${gtin}, count: ${count}`
}

/**
 * The item's name from the cycle count item list, or null when it can't be
 * found (not there, no permission, offline). The code is tried as scanned and
 * without leading zeros, since the stored UPC isn't always 14 digits.
 */
export async function lookupItemName(code: string, site: string | undefined): Promise<string | null> {
  if (!site) return null
  const digits = scanDigits(code)
  const candidates = [...new Set([digits, stripLeadingZeros(digits)])].filter(Boolean)
  for (const upc of candidates) {
    try {
      const res = await axios.get('/api/cycle-count/lookup', {
        params: { upc_barcode: upc, site },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'cycleCount.lookup',
        },
      })
      const name = res.data?.name
      if (typeof name === 'string' && name.trim()) return name.trim()
    } catch {
      // Not found, forbidden or offline: try the next form, then give up.
    }
  }
  return null
}
