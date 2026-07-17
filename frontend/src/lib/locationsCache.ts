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
// fall back to whatever was cached last time, or an empty list. The 5s
// timeout matters even though this is fire-and-forget: without it, a
// reachable-but-not-actually-online connection (dead router, captive
// portal) can leave this fetch hanging indefinitely instead of failing,
// so it never gets around to warming the cache at all — see network.ts's
// isActuallyOnline() for the same pattern already used elsewhere here.
export function prefetchLocations(): void {
  fetch('/api/locations', {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data) => saveCachedLocations(data))
    .catch(() => {})
}
