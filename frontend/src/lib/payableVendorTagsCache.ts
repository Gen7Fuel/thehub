// Offline cache for the tagged payable vendor names that feed the vendor-name
// autocomplete on the payables form (GET /api/payables/vendor-tags). Read
// first so the suggestions work immediately, then refreshed from the network.
const CACHE_KEY = 'payables_cachedVendorTags'

export interface VendorTagOption {
  nameKey: string
  vendorName: string
  sageVendorId: string
  sageVendorName: string
}

export function saveCachedVendorTags(tags: Array<VendorTagOption>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(tags))
  } catch {
    // localStorage full/unavailable — non-fatal, just skip caching
  }
}

export function getCachedVendorTags(): Array<VendorTagOption> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as Array<VendorTagOption>) : []
  } catch {
    return []
  }
}

/**
 * Vendor names matching what the user typed: names starting with it first,
 * then names merely containing it, each group A–Z. Nothing is suggested for
 * an empty box, or when the only match is exactly what's already typed.
 */
export function suggestVendorTags(
  tags: Array<VendorTagOption>,
  typed: string,
): Array<VendorTagOption> {
  const q = typed.trim().replace(/\s+/g, ' ').toLowerCase()
  if (!q) return []
  const matches = tags.filter((t) => t.nameKey.includes(q))
  if (matches.length === 1 && matches[0].nameKey === q) return []
  const rank = (t: VendorTagOption) => (t.nameKey.startsWith(q) ? 0 : 1)
  return matches.sort(
    (a, b) => rank(a) - rank(b) || a.vendorName.localeCompare(b.vendorName),
  )
}
