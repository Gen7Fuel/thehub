// Shared offline cache for the full AR customer list (used for the
// customer-name autocomplete on the PO form, among others). Unlike
// locations, GET /api/ar-customers requires auth. It is loaded only when a
// feature that needs it (currently the PO form) opens, avoiding a misleading
// AR-customer access record on every login, and re-cached after that request.
const CACHE_KEY = 'po_cachedArCustomers'

export function saveCachedArCustomers(customers: unknown[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(customers))
  } catch {
    // localStorage full/unavailable — non-fatal, just skip caching
  }
}
export function getCachedArCustomers<T = any>(): T[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
