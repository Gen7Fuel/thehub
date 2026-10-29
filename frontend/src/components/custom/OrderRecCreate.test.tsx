import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
}
const scannerKeys = (target: HTMLElement, code = '012345678905', terminator?: string) => {
  for (const key of code) fireEvent.keyDown(target, { key })
  if (terminator) fireEvent.keyDown(target, { key: terminator })
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
  afterEach(() => cleanup())

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
    expect(screen.getByText('Handheld scanner ready. You can keep editing quantities.')).toBeInTheDocument()
    expect(input).toHaveAttribute('inputmode', 'none')
  })

  it('adds inventory data, increments repeat scans, edits quantities, and removes rows', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    expect(screen.getByText('12.5')).toBeInTheDocument()
    expect(screen.getByText('24 units per case')).toBeInTheDocument()
    expect(screen.getByText(`Inventory as of ${new Date(item.lastInventoryDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}`)).toBeInTheDocument()
    expect(screen.getByRole('spinbutton')).toHaveValue('1')
    scan()
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue('2'))
    expect(screen.getAllByText('Coffee')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Increase Coffee'))
    expect(screen.getByRole('spinbutton')).toHaveValue('3')
    fireEvent.click(screen.getByLabelText('Decrease Coffee'))
    expect(screen.getByRole('spinbutton')).toHaveValue('2')
    fireEvent.click(screen.getByLabelText('Remove Coffee'))
    expect(screen.queryByText('Coffee')).not.toBeInTheDocument()
  })

  it('puts the latest scan first and highlights it, including repeat scans', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    vi.mocked(fetch).mockResolvedValueOnce(response({ ...item, id: 8, itemName: 'Tea', upc: '012345678906' }))
    scan('012345678906')
    await waitFor(() => expect(screen.getByText('Tea')).toBeInTheDocument())
    const list = screen.getByRole('list', { name: 'Items to order' })
    let rows = within(list).getAllByRole('listitem')
    expect(within(rows[0]).getByRole('heading')).toHaveTextContent('Tea')
    expect(within(rows[0]).getByText('Last scanned')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('Last scanned')).not.toBeInTheDocument()

    scan()
    await waitFor(() => expect(within(within(list).getAllByRole('listitem')[0]).getByRole('heading')).toHaveTextContent('Coffee'))
    rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByRole('spinbutton')).toHaveValue('2')
    expect(within(rows[0]).getByText('Last scanned')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('heading')).toHaveTextContent('Tea')
    expect(within(rows[1]).queryByText('Last scanned')).not.toBeInTheDocument()
  })

  it('accepts a scanner Tab terminator and keeps focus in the textbox', async () => {
    render(<OrderRecCreate />)
    const input = screen.getByLabelText('UPC barcode')
    input.focus()
    scan('012345678905', 'Tab')
    await loaded()
    expect(input).toHaveFocus()
    expect(input).toHaveValue('012345678905')
  })

  it('queues quick scans while a lookup is still in progress', async () => {
    let resolve!: (value: Response) => void
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(done => { resolve = done }))
    render(<OrderRecCreate />)
    scan()
    scan()
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    resolve(response(item))
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue('2'))
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

  it.each(['Enter', 'Tab'])('automatically adds a scan ending in %s without focusing UPC', async terminator => {
    render(<OrderRecCreate />)
    scannerKeys(document.body, '012345678905', terminator)
    await loaded()
    expect(screen.getByLabelText('UPC barcode')).toHaveValue('012345678905')
    expect(screen.getByLabelText('UPC barcode')).not.toHaveFocus()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('automatically adds a scan without an Enter or Tab suffix', async () => {
    render(<OrderRecCreate />)
    scannerKeys(document.body)
    await loaded()
    expect(screen.getByLabelText('UPC barcode')).toHaveValue('012345678905')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('scans while editing a quantity without inserting barcode digits into it', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    fireEvent.click(screen.getByLabelText('Increase Coffee'))
    const quantity = screen.getByRole('spinbutton') as HTMLInputElement
    quantity.focus()
    quantity.select()
    vi.mocked(fetch).mockResolvedValueOnce(response({ ...item, id: 8, itemName: 'Tea', upc: '012345678906' }))
    scannerKeys(quantity, '012345678906', 'Enter')
    await waitFor(() => expect(screen.getByText('Tea')).toBeInTheDocument())
    expect(quantity).toHaveValue('2')
    expect(quantity).toHaveFocus()
    expect(screen.getByLabelText('UPC barcode')).toHaveValue('012345678906')
  })

  it('allows ordinary keyboard quantity editing, caret insertion, and arrow keys', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    const quantity = screen.getByRole('spinbutton') as HTMLInputElement
    const user = userEvent.setup({ delay: 100 })
    quantity.focus()
    quantity.select()
    await user.keyboard('42')
    await waitFor(() => expect(quantity).toHaveValue('42'))
    quantity.setSelectionRange(1, 1)
    await user.keyboard('3')
    await waitFor(() => expect(quantity).toHaveValue('432'))
    await user.keyboard('{ArrowUp}')
    expect(quantity).toHaveValue('433')
    await user.keyboard('{ArrowDown}')
    expect(quantity).toHaveValue('432')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('accepts a barcode pasted by a scanner while a quantity has focus', async () => {
    render(<OrderRecCreate />)
    scan()
    await loaded()
    const quantity = screen.getByRole('spinbutton')
    quantity.focus()
    fireEvent.paste(quantity, { clipboardData: { getData: () => '012345678905' } })
    await waitFor(() => expect(quantity).toHaveValue('2'))
    expect(quantity).toHaveFocus()
  })

  it('keeps consecutive rapid scans in order and does not add twice for a trailing Enter', async () => {
    render(<OrderRecCreate />)
    scannerKeys(document.body, '012345678905', 'Enter')
    fireEvent.keyDown(document.body, { key: 'Enter' })
    scannerKeys(document.body, '012345678905', 'Tab')
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue('2'))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('removes scanner listeners on leaving the page', async () => {
    const view = render(<OrderRecCreate />)
    view.unmount()
    scannerKeys(document.body, '012345678905', 'Enter')
    expect(fetch).not.toHaveBeenCalled()
  })
})
