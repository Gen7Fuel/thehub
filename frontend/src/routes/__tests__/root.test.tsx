import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { mockPrefetchLocations } = vi.hoisted(() => ({
  mockPrefetchLocations: vi.fn(),
}))

vi.mock('@/lib/locationsCache', () => ({
  prefetchLocations: mockPrefetchLocations,
}))

vi.mock('@/components/custom/PwaInstallBanner', () => ({
  PwaInstallBanner: () => null,
}))

vi.mock('@tanstack/react-router-devtools', () => ({
  TanStackRouterDevtools: () => null,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Outlet: () => null,
  }
})

import { Route } from '../__root'

const RootComponent = Route.options.component as React.ComponentType

beforeEach(() => {
  vi.clearAllMocks()
})

describe('__root — offline site-list prefetch', () => {
  it('prefetches locations on mount, before/regardless of login (this component wraps every route including /login)', async () => {
    render(<RootComponent />)

    await waitFor(() => expect(mockPrefetchLocations).toHaveBeenCalled())
  })
})
