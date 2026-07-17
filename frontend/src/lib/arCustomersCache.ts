// Shared offline cache for the full AR customer list (used for the
// customer-name autocomplete on the PO form, among others). Unlike
// locations, GET /api/ar-customers requires auth, so it can't be prefetched
// pre-login like locationsCache.ts — instead it's prefetched as soon as
// AuthContext resolves a valid user (fresh login, or an app boot that finds
// an already-valid token — see the effect in context/AuthContext.tsx), and
// re-cached on every subsequent successful fetch from wherever the list is
// consumed (e.g. po/index.tsx).
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

// Fire-and-forget: warms the cache as soon as a valid auth token exists. A
// failure here (offline, or a first-ever load with nothing cached yet) is
// expected and silently ignored — readers just fall back to whatever was
// cached last time, or an empty list.
export function prefetchArCustomers(): void {
  const token = localStorage.getItem('token')
  if (!token) return // not logged in yet — nothing to authenticate the request with

  fetch('/api/ar-customers', {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => saveCachedArCustomers(data))
    .catch(() => {})
}
