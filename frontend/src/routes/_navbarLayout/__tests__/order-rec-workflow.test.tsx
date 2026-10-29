import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { socket } = vi.hoisted(() => ({ socket: { on: vi.fn(), off: vi.fn() } }))
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  createFileRoute: () => (config: any) => config,
  useNavigate: () => vi.fn(),
}))
vi.mock('@/lib/websocket', () => ({ getSocket: () => socket }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { access: { orderRec: { value: true, workflow: true } } } }) }))
vi.mock('@/components/custom/vendorPicker', () => ({
  VendorPicker: ({ value, setVendor }: any) => <select aria-label="Pending vendor" value={value} onChange={event => setVendor(event.target.value)}><option value="">Select vendor</option><option value="vendor-1">Acme</option></select>,
}))
import { Route } from '../order-rec/workflow'
const Workflow = (Route as any).component as React.ComponentType

describe('pending vendors in Workflow', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  it('shows unassigned orders outside the vendor grid and moves them into the grid after assignment', async () => {
    const order = { _id: 'rec-1', source: 'scanner', vendor: '', site: 'Rankin', filename: 'OrderRec - Vendor pending', currentStatus: 'Created', createdAt: new Date().toISOString(), statusHistory: [], comments: [] }
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      let data: unknown = []
      if (url === '/api/vendors') data = [{ _id: 'vendor-1', name: 'Acme', location: 'Rankin', category: 'Convenience' }]
      if (url === '/api/locations') data = [{ _id: 'location-1', stationName: 'Rankin' }]
      if (url.startsWith('/api/order-rec/workflow')) data = [order]
      if (init?.method === 'PATCH') data = { ...order, vendor: 'vendor-1', filename: 'OrderRec - Acme' }
      return { ok: true, status: 200, json: async () => data } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<React.Suspense fallback={null}><Workflow /></React.Suspense>)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Awaiting vendor assignment' })).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.getByText('OrderRec - Vendor pending')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pending vendor'), { target: { value: 'vendor-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign vendor' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Awaiting vendor assignment' })).not.toBeInTheDocument())
    expect(screen.getByText('Status: Created')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/order-rec/rec-1/vendor', expect.objectContaining({ method: 'PATCH' }))
  }, 15000)
})
