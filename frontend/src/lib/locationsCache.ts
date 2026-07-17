// Shared offline cache for the site/location list. GET /api/locations
// requires no auth (see backend/routes/location.js), so this is prefetched
// eagerly on app boot — even on the login page — rather than waiting for an
// authenticated route to request it. Every site picker reads and writes the
// same key, so the moment any of them succeeds online, the whole app has an
// offline fallback for the next time any of them is rendered.
const CACHE_KEY = 'cachedLocations'

export function saveCachedLocations(locations: unknown[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(locations))
  } catch {
    // localStorage full/unavailable — non-fatal, just skip caching
  }
}

export function getCachedLocations<T = any>(): T[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Fire-and-forget: warms the cache as early as possible on every app load,
// regardless of auth state. A failure here (offline, or a first-ever load
// with nothing cached yet) is expected and silently ignored — readers just
// fall back to whatever was cached last time, or an empty list.
export function prefetchLocations(): void {
  fetch('/api/locations', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => saveCachedLocations(data))
    .catch(() => {})
}
