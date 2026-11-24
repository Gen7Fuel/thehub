import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EditMetaDialog } from '../workspace'

const { listSuppliers, updateOrder } = vi.hoisted(() => ({
  listSuppliers: vi.fn(),
  updateOrder: vi.fn(),
}))

vi.mock('@/api/fuel-management/fuel-suppliers.service', () => ({
  fuelSuppliersService: { list: listSuppliers },
}))
vi.mock('@/api/fuel-management/fuel-orders.service', () => ({
  fuelOrdersService: { update: updateOrder },
}))

const supplierA = { _id: 'a', supplierName: 'Supplier A', supplierBadges: [
  { badgeNumber: 'A-default', badgeName: 'Default', isDefault: true },
  { badgeNumber: 'A-saved', badgeName: 'Assigned' },
] }
const supplierB = { _id: 'b', supplierName: 'Supplier B', supplierBadges: [
  { badgeNumber: 'B-default', badgeName: 'Default', isDefault: true },
] }
const supplierC = { _id: 'c', supplierName: 'Supplier C', supplierBadges: [
  { badgeNumber: 'C-default', badgeName: 'Default', isDefault: true },
] }
const racks = [
  { _id: 'rack-1', rackName: 'Rack One', rackLocation: 'Toronto', defaultSupplier: supplierB },
  { _id: 'rack-2', rackName: 'Rack Two', rackLocation: 'London', defaultSupplier: supplierC },
]
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

beforeEach(() => {
  listSuppliers.mockReset()
  listSuppliers.mockImplementation(async (rackId: string) =>
    rackId === 'rack-1' ? [supplierA, supplierB] : [supplierC])
  updateOrder.mockReset().mockResolvedValue({})
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true })
})

afterEach(() => {
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

function renderDialog(badgeNo = 'A-saved') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EditMetaDialog isOpen racks={racks} onOpenChange={vi.fn()} onUpdateSuccess={vi.fn()}
        order={{ _id: 'order-1', rack: racks[0], supplier: supplierA, badgeNo }} />
    </QueryClientProvider>,
  )
}

async function chooseOption(label: string, option: RegExp) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), { key: 'ArrowDown' })
  fireEvent.keyDown(await screen.findByRole('option', { name: option }), { key: 'Enter' })
}

it('preserves the saved non-default supplier and badge when loading rack options', async () => {
  renderDialog()
  const save = screen.getByRole('button', { name: 'Save Changes' })
  await waitFor(() => expect(save).toBeEnabled())
  expect(screen.getByRole('combobox', { name: 'Fuel Rack' })).toHaveTextContent('Rack One')
  expect(screen.getByRole('combobox', { name: 'Supplier' })).toHaveTextContent('Supplier A')
  expect(screen.getByRole('combobox', { name: 'Badge Number' })).toHaveTextContent('A-saved')

  fireEvent.click(save)
  await waitFor(() => expect(updateOrder).toHaveBeenCalledWith(
    'order-1', { rack: 'rack-1', supplier: 'a', badgeNo: 'A-saved' },
    expect.any(String), 'fuelManagement.workspace.editOrderMetadata',
  ))
})

it('updates dependent options when the user changes the supplier or rack', async () => {
  renderDialog()
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Supplier' })).toBeEnabled())
  await chooseOption('Supplier', /Supplier B/)
  expect(screen.getByRole('combobox', { name: 'Badge Number' })).toHaveTextContent('B-default')

  await chooseOption('Fuel Rack', /Rack Two/)
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Supplier' })).toHaveTextContent('Supplier C'))
  expect(screen.getByRole('combobox', { name: 'Badge Number' })).toHaveTextContent('C-default')
})

it('shows a saved badge that is no longer available and requires a valid replacement', async () => {
  renderDialog('Retired badge')
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Badge Number' })).toBeEnabled())
  expect(screen.getByRole('combobox', { name: 'Badge Number' })).toHaveTextContent('Retired badge')
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  await chooseOption('Badge Number', /A-default/)
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
})
