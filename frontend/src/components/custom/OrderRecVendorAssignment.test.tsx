import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrderRecVendorAssignment } from './OrderRecVendorAssignment'

const { auth } = vi.hoisted(() => ({ auth: { user: { access: { orderRec: { value: true, workflow: true } } } } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/components/custom/vendorPicker', () => ({
  VendorPicker: ({ value, setVendor, location, disabled }: any) => (
    <select aria-label={`Vendor for ${location}`} value={value} disabled={disabled} onChange={event => setVendor(event.target.value)}>
      <option value="">Choose vendor</option><option value="vendor-1">Acme</option>
    </select>
  ),
}))
const order = { _id: 'order-1', source: 'scanner', vendor: '', site: 'Rankin' }
describe('pending vendor assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.user.access.orderRec = { value: true, workflow: true }
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(cleanup)

  it('shows store users a pending message without a vendor selector', () => {
    auth.user.access.orderRec.workflow = false
    render(<OrderRecVendorAssignment orderRec={order} onAssigned={vi.fn()} />)
    expect(screen.getByText('Vendor pending')).toBeInTheDocument()
    expect(screen.getByText('Head office will select the vendor for this order.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('lets head office assign a vendor and returns the updated order', async () => {
    const onAssigned = vi.fn()
    const updated = { ...order, vendor: 'vendor-1', filename: 'OrderRec - Acme' }
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => updated } as Response)
    render(<OrderRecVendorAssignment orderRec={order} onAssigned={onAssigned} />)
    expect(screen.getByRole('button', { name: 'Assign vendor' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Vendor for Rankin'), { target: { value: 'vendor-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign vendor' }))
    await waitFor(() => expect(onAssigned).toHaveBeenCalledWith(updated))
    expect(fetch).toHaveBeenCalledWith('/api/order-rec/order-1/vendor', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ vendor: 'vendor-1' }), headers: expect.objectContaining({ 'X-Required-Permission': 'orderRec.workflow' }) }))
  })
  it('keeps the assignment pending and displays server validation errors', async () => {
    const onAssigned = vi.fn()
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ message: 'Select a vendor for this store.' }) } as Response)
    render(<OrderRecVendorAssignment orderRec={order} onAssigned={onAssigned} />)
    fireEvent.change(screen.getByLabelText('Vendor for Rankin'), { target: { value: 'vendor-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign vendor' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Select a vendor for this store.'))
    expect(onAssigned).not.toHaveBeenCalled()
  })
  it('renders no assignment control for already assigned or uploaded orders', () => {
    const view = render(<OrderRecVendorAssignment orderRec={{ ...order, vendor: 'vendor-1' }} onAssigned={vi.fn()} />)
    expect(screen.queryByText('Vendor pending')).not.toBeInTheDocument()
    view.rerender(<OrderRecVendorAssignment orderRec={{ ...order, source: 'upload' }} onAssigned={vi.fn()} />)
    expect(screen.queryByText('Vendor pending')).not.toBeInTheDocument()
  })
})
