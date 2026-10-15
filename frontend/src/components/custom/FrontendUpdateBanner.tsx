import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

type VersionInfo = { version?: string }

const CHECK_INTERVAL_MS = 5 * 60 * 1000

async function readVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?check=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as VersionInfo
    return typeof data.version === 'string' ? data.version : null
  } catch {
    return null
  }
}

export function FrontendUpdateBanner() {
  const { user } = useAuth()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const currentVersion = useRef<string | null>(null)

  const checkForUpdate = useCallback(async () => {
    const version = await readVersion()
    if (!version) return
    if (currentVersion.current === null) {
      currentVersion.current = version
      return
    }
    if (version !== currentVersion.current) setUpdateAvailable(true)
  }, [])

  useEffect(() => {
    void checkForUpdate()

    const intervalId = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [checkForUpdate])

  // A user may leave the login screen open while a deployment happens. Check
  // immediately after login so they do not need to wait for the five-minute
  // polling interval (or manually reload the login page).
  useEffect(() => {
    if (user) void checkForUpdate()
  }, [user, checkForUpdate])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      await registration?.update()

      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        await new Promise<void>((resolve) => {
          const onControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
            resolve()
          }
          navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true })
          window.setTimeout(resolve, 1500)
        })
      }

      // A precached app shell can survive a normal reload, including on an
      // installed mobile PWA. Remove the old worker and its caches before
      // navigating so this action is equivalent to a reliable hard refresh.
      const registrations = await navigator.serviceWorker?.getRegistrations()
      await Promise.all(registrations?.map((item) => item.unregister()) ?? [])
      if ('caches' in window) {
        const cacheNames = await window.caches.keys()
        await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)))
      }

      window.location.replace(`${window.location.pathname}${window.location.search ? `${window.location.search}&` : '?'}update=${Date.now()}`)
    } finally {
      setRefreshing(false)
    }
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-blue-700 px-4 py-2 text-sm text-white shadow-md">
      <span className="text-center">
        A new Hub update is available. Please save your work before refreshing.
      </span>
      <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
        <RefreshCw className={refreshing ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
        {refreshing ? 'Updating…' : 'Refresh now'}
      </Button>
      <Button aria-label="Dismiss update" size="icon" variant="ghost" className="text-white hover:bg-blue-600" onClick={() => setUpdateAvailable(false)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
