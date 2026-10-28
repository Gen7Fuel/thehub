import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { OrderRecCreate } from './OrderRecCreate'

const { navigate, auth } = vi.hoisted(() => ({
  navigate: vi.fn(),
  auth: { user: { id: 'store-user', location: 'Rankin', email: 'store@example.com', access: { orderRec: { value: true, scanToOrder: true } } } },
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('@/context/SiteContext', () => ({ useSite: () => ({ selectedSite: '' }) }))
vi.mock('@/components/custom/sitePicker', () => ({
  SitePicker: ({ value, onValueChange }: any) => <select aria-label="Store" value={value} onChange={e => onValueChange(e.target.value)}><option>Rankin</option><option>Other store</option></select>,
}))
vi.mock('@/components/custom/vendorPicker', () => ({
  VendorPicker: ({ value, setVendor, disabled }: any) => <select aria-label="Vendor" value={value} disabled={disabled} onChange={e => setVendor(e.target.value)}><option value="">Choose vendor</option><option value="vendor-1">Vendor A</option></select>,
}))

const item = { id: 7, gtin: '00012345678905', upc: '012345678905', itemName: 'Coffee',
  categoryNumber: '100', onHandQty: 12.5, packsPerCarton: 6, cartonsPerCase: 4, lastInventoryDate: '2026-10-26', imageUrl: null, active: true }
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response
const scan = (code = '012345678905', key = 'Enter') => {
  const textbox = screen.getByLabelText('UPC barcode')
  fireEvent.change(textbox, { target: { value: code } })
  fireEvent.keyDown(textbox, { key })
  // jsdom doesn't synthesize the browser's implicit form submission.
  if (key === 'Enter') fireEvent.submit(textbox.closest('form')!)
}
const loaded = () => waitFor(() => expect(screen.getByText('Coffee')).toBeInTheDocument(), { timeout: 5000 })

describe('Scan to Order', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    auth.user.access.orderRec = { value: true, scanToOrder: true }
    sessionStorage.clear()
    localStorage.setItem('token', 'test-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(item)))
  })

  it('blocks direct access without the scanner permission before mounting the editor', () => {
    auth.user.access.orderRec.scanToOrder = false
    render(<OrderRecCreate />)
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have access to Scan to Order.')
    expect(screen.queryByLabelText('UPC barcode')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
  })

  it('blocks access when the parent module is denied', () => {
    auth.user.access.orderRec.value = false
    render(<OrderRecCreate />)
    expect(screen.getByRole('alert')).toHaveTextContent(/do not have access/)
    expect(screen.queryByLabelText('UPC barcode')).not.toBeInTheDocument()
  })

  it('shows the scanner prompt only while the UPC textbox is focused', () => {
    render(<OrderRecCreate />)
    expect(screen.queryByText('Scan a barcode using the handheld scanner.')).not.toBeInTheDocument()
    const input = screen.getByLabelText('UPC barcode')
    fireEvent.focus(input)
    expect(screen.getByText('Scan a barcode using the handheld scanner.')).toBeInTheDocument()
    fireEvent.blur(input)
    expect(screen.queryByText('Scan a barcode using the handheld scanner.')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('inputmode', 'none')
  })

  it('adds inventory data, increments repeat scans, edits quantities, and removes rows', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    expect(screen.getByText('12.5')).toBeInTheDocument()
    expect(screen.getByText('24 units per case')).toBeInTheDocument()
    expect(screen.getByText(`Inventory as of ${new Date(item.lastInventoryDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}`)).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue(1)
    scan()
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(2))
    expect(screen.getAllByText('Coffee')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Increase Coffee'))
    expect(screen.getByRole('spinbutton')).toHaveValue(3)
    fireEvent.click(screen.getByLabelText('Decrease Coffee'))
    expect(screen.getByRole('spinbutton')).toHaveValue(2)
    fireEvent.click(screen.getByLabelText('Remove Coffee'))
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument()
  })

  it('accepts a scanner Tab terminator and keeps focus in the textbox', async () => {
    render(<OrderRecCreate />)
    const input = screen.getByLabelText('UPC barcode')
    input.focus()
    scan('012345678905', 'Tab')
    await loaded()
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')
  })

  it('queues quick scans while a lookup is still in progress', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    render(<OrderRecCreate />)
    scan()
    scan()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    resolve(response(item))
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(2))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('shows unknown barcode errors without adding a row', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ message: 'No item found for this barcode at this store.' }, 404))
    render(<OrderRecCreate />)
    scan()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/No item found/))
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it('blocks invalid input and zero quantities from being submitted', async () => {
    render(<OrderRecCreate />)
    scan('ABC123')
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/6 to 14 digits/)
    scan()
    await loaded()
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'vendor-1' } })
    fireEvent.click(screen.getByLabelText('Decrease Coffee'))
    expect(screen.getByRole('button', { name: 'Create order rec' })).toBeDisabled()
    expect(screen.getByLabelText('Decrease Coffee')).toBeDisabled()
    expect(screen.getByLabelText('Store')).toBeDisabled()
  })

  it('saves only item IDs and quantities, then opens the created order', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'vendor-1' } })
    vi.mocked(fetch).mockResolvedValueOnce(response({ _id: 'new-order' }, 201))
    fireEvent.click(screen.getByRole('button', { name: 'Create order rec' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/order-rec/$id', params: { id: 'new-order' } }))
    const [url, init] = vi.mocked(fetch).mock.calls[1]
    expect(url).toBe('/api/order-rec/scan')
    expect(init!.headers).toMatchObject({ 'X-Required-Permission': 'orderRec.scanToOrder' })
    expect(JSON.parse(init!.body as string)).toEqual({ site: 'Rankin', vendor: 'vendor-1', items: [{ id: 7, quantity: 1 }] })
  })

  it('keeps the draft after a failed save and restores it after remounting', async () => {
    const view = render(<OrderRecCreate />)
    scan()
    await loaded()
    fireEvent.change(screen.getByLabelText('Vendor'), { target: { value: 'vendor-1' } })
    vi.mocked(fetch).mockResolvedValueOnce(response({ message: 'Unable to create this order.' }, 500))
    fireEvent.click(screen.getByRole('button', { name: 'Create order rec' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Unable to create/))
    expect(screen.getByText('Coffee')).toBeInTheDocument()
    view.unmount()
    render(<OrderRecCreate />)
    expect(screen.getByText('Coffee')).toBeInTheDocument()
    expect(screen.getByLabelText('Vendor')).toHaveValue('vendor-1')
  })
})
