import { ErrorComponent, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { PwaInstallBanner } from '@/components/custom/PwaInstallBanner'
import { Button } from '@/components/ui/button'
import { WifiOff } from 'lucide-react'

// Matches the "couldn't fetch a lazy-loaded route chunk" error across
// browsers (Chrome: "Failed to fetch dynamically imported module", Firefox:
// "error loading dynamically imported module", Safari has its own wording).
// This specifically happens when navigating to a route whose code-split
// chunk was never loaded into this tab and the device is offline (or the
// service worker hasn't finished precaching it yet) — a distinct, recoverable
// situation from an actual application bug, so it gets its own message
// instead of the default dev-style "Something went wrong!" stack trace.
const isChunkLoadError = (error: unknown) =>
  /dynamically imported module|loading chunk|importing a module script failed/i.test(
    error instanceof Error ? error.message : String(error)
  )

function RootErrorComponent({ error }: { error: Error }) {
  if (isChunkLoadError(error)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <WifiOff className="h-10 w-10 text-slate-400" />
        <h1 className="text-lg font-bold">This page hasn't loaded yet</h1>
        <p className="max-w-sm text-sm text-slate-600">
          You're offline and this part of the app hasn't been downloaded to this device yet.
          Reconnect to the internet, then try again.
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    )
  }

  return <ErrorComponent error={error} />
}

export const Route = createRootRoute({
  component: () => (
    <>
      <PwaInstallBanner />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  errorComponent: RootErrorComponent,
})
