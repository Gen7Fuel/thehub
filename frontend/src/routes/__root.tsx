import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { PwaInstallBanner } from '@/components/custom/PwaInstallBanner'

export const Route = createRootRoute({
  component: () => (
    <>
      <PwaInstallBanner />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
