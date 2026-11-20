import { locationsService } from '@/api/locations/locations.service'

// Shared offline cache for the site/location list. GET /api/locations
// requires no auth (see backend/routes/location.js), so this is prefetched
// eagerly on app boot — even on the login page — rather than waiting for an
// authenticated route to request it. Every site picker reads and writes the
// same key, so the moment any of them succeeds online, the whole app has an
// offline fallback for the next time any of them is rendered.
const CACHE_KEY = 'cachedLocations'
let locationPrefetchInFlight: Promise<unknown> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function projectCachedLocations(locations: unknown[]) {
  return locations.flatMap((location) => {
    if (!isRecord(location)) return []
    const { _id, stationName, csoCode, timezone, registers } = location
    if (typeof _id !== 'string' || typeof stationName !== 'string') return []

    return [{
      _id,
      stationName,
      csoCode: typeof csoCode === 'string' ? csoCode : undefined,
      timezone: typeof timezone === 'string' ? timezone : undefined,
      registers: Array.isArray(registers)
        ? registers.flatMap((register) => {
            if (!isRecord(register) || typeof register.number !== 'string') return []
            return [{
              _id: typeof register._id === 'string' ? register._id : undefined,
              number: register.number,
            }]
          })
        : undefined,
    }]
  })
}

function writeCache(serialized: string): void {
  try {
    localStorage.setItem(CACHE_KEY, serialized)
  } catch {
    // localStorage full/unavailable — non-fatal, just skip caching
  }
}

export function saveCachedLocations(locations: unknown[]): void {
  writeCache(JSON.stringify(projectCachedLocations(locations)))
}

export function getCachedLocations<T = any>(): T[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw === null) return []

    const parsed = JSON.parse(raw)
    const locations = Array.isArray(parsed) ? projectCachedLocations(parsed) : []
    const serialized = JSON.stringify(locations)
    if (serialized !== raw) writeCache(serialized)
    return locations as T[]
  } catch {
    writeCache('[]')
    return []
  }
}

// Canonical loader for all location pickers. It preserves the existing
// offline cache and bounded-request behaviour; React Query deduplicates the
// LocationPicker consumers that share its `locations` query key.
export function loadLocations<T = unknown>(auth = true): Promise<T[]> {
  const request = locationsService.list({
      auth,
      signal: AbortSignal.timeout(5000),
    })
    .then((data) => {
      saveCachedLocations(data)
      return data as T[]
    })
    .catch((error) => {
      const cached = getCachedLocations<T>()
      if (cached.length > 0) return cached
      throw error
    })

  return request
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
  if (locationPrefetchInFlight) return

  // Scrub previously persisted documents even if the new fetch stalls or fails.
  getCachedLocations()
  locationPrefetchInFlight = loadLocations(false)
    .catch(() => {})
    .finally(() => {
      locationPrefetchInFlight = null
    })
}
