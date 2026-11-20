import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FuelGradeCheckboxes } from '../FuelGradeCheckboxes'
import { FuelGradeLabel } from '../FuelGradeLabel'
import { sortByFuelGrade } from '@/lib/fuelGradeDisplay'
import { Route as StationRoute } from '@/routes/_navbarLayout/fuel-management/manage/locations/$id'
import { Route as VolumeRoute } from '@/routes/_navbarLayout/fuel-management/volume'

const { listGrades, createTank, getLocation, syncAllVolumes, getReconciliation } = vi.hoisted(() => ({
  listGrades: vi.fn(), createTank: vi.fn(), getLocation: vi.fn(), syncAllVolumes: vi.fn(), getReconciliation: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  createFileRoute: (fullPath: string) => (options: object) => ({
    options, fullPath, useParams: () => ({ id: 'station-1' }), useSearch: () => ({ site: 'Rankin' }),
  }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { access: { fuelManagement: { volume: { viewHistoricalSalesVolumeChart: true } } } } }),
}))
vi.mock('recharts', async (importOriginal) => ({
  ...await importOriginal<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  ComposedChart: ({ data }: { data: { salesVolume: number }[] }) => (
    <output aria-label="Chart sales">{data.map(day => day.salesVolume).join(', ')}</output>
  ),
}))
vi.mock('@/api/fuel-management/fuel-grades.service', () => ({
  fuelGradeOptionsQuery: { queryKey: ['fuel-grades', 'options'], queryFn: listGrades },
}))
vi.mock('@/api/fuel-management/fuel-racks.service', () => ({ fuelRacksService: { list: async () => [] } }))
vi.mock('@/api/fuel-management/fuel-carriers.service', () => ({ fuelCarriersService: { list: async () => [] } }))
vi.mock('@/api/fuel-management/fuel-station-tanks.service', () => ({
  fuelStationTanksService: {
    getLocation,
    createTank,
    syncAllVolumes,
    getReconciliation,
  },
}))

const catalog = [
  { key: 'Regular', name: 'Unleaded', shortName: 'RUL', color: '#22c55e', active: true },
  { key: 'E15', name: 'Summer Blend', shortName: 'E15', color: '#475569', active: true },
  { key: 'Diesel', name: 'Diesel', shortName: 'ULSD', color: '#fbbf24', active: true },
  { key: 'Premium', name: 'Premium', shortName: 'PUL', color: '#ef4444', active: false },
]
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

function renderWithQueries(component: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  listGrades.mockResolvedValue(catalog)
  createTank.mockResolvedValue({})
  getLocation.mockResolvedValue({ location: { stationName: 'Rankin' }, tanks: [] })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true })
})

afterEach(() => {
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

it('uses catalog short names and colors, with a shared Regular and E15 tank label', () => {
  render(
    <>
      <FuelGradeLabel grade="Regular" grades={catalog} tank />
      <FuelGradeLabel grade="Regular" grades={catalog} />
      <FuelGradeLabel grade="E15" grades={catalog} />
      <FuelGradeLabel grade="Premium" grades={catalog} tank />
      <FuelGradeLabel grade="Legacy Grade" grades={catalog} tank />
    </>,
  )

  expect(screen.getByText('RUL | E15')).toHaveStyle({ backgroundColor: '#22c55e', color: '#000000' })
  expect(screen.getByText('RUL')).toHaveStyle({ backgroundColor: '#22c55e' })
  expect(screen.getByText('E15')).toHaveStyle({ backgroundColor: '#475569', color: '#ffffff' })
  expect(screen.getByText('PUL')).toHaveStyle({ backgroundColor: '#ef4444' })
  expect(screen.getByText('Legacy Grade')).toBeInTheDocument()
})

it('sorts displayed grades by catalog order and retains unknown and archived grades', () => {
  const items = [{ grade: 'Legacy Grade' }, { grade: 'Premium' }, { grade: 'Regular' }]
  expect(sortByFuelGrade(items, catalog).map(item => item.grade)).toEqual(['Regular', 'Premium', 'Legacy Grade'])
  expect(items[0].grade).toBe('Legacy Grade')
})

it('shows permitted active badge choices in catalog order and keeps archived assignments removable', async () => {
  const onChange = vi.fn()
  renderWithQueries(<FuelGradeCheckboxes
    allowedKeys={['E15', 'Regular', 'Premium']}
    selected={['Premium']}
    onChange={onChange}
  />)

  const regular = await screen.findByRole('checkbox', { name: 'Unleaded' })
  const e15 = screen.getByRole('checkbox', { name: 'Summer Blend' })
  const archived = screen.getByRole('checkbox', { name: 'Premium Archived' })
  expect(screen.getAllByRole('checkbox')).toEqual([regular, e15, archived])
  expect(archived).toBeChecked()

  fireEvent.click(e15)
  expect(onChange).toHaveBeenLastCalledWith(['Premium', 'E15'])
  fireEvent.click(archived)
  expect(onChange).toHaveBeenLastCalledWith([])
})

it('uses the active catalog for a new tank and never offers E15', async () => {
  const Station = StationRoute.options.component!
  renderWithQueries(<Station />)

  const newTank = await screen.findByRole('button', { name: 'New Tank' })
  await waitFor(() => expect(newTank).toBeEnabled())
  fireEvent.click(newTank)
  const dialog = await screen.findByRole('dialog', { name: 'New Tank' })
  expect(within(dialog).getByRole('button', { name: 'Add Tank' })).toBeDisabled()

  fireEvent.keyDown(within(dialog).getByRole('combobox'), { key: 'ArrowDown' })
  const regular = await screen.findByRole('option', { name: 'Unleaded' })
  expect(screen.queryByRole('option', { name: 'Summer Blend' })).not.toBeInTheDocument()
  expect(screen.queryByRole('option', { name: 'Premium' })).not.toBeInTheDocument()
  fireEvent.keyDown(regular, { key: 'Enter' })
  const addTank = await within(dialog).findByRole('button', { name: 'Add Tank' })
  expect(addTank).toBeEnabled()
  fireEvent.click(addTank)

  await waitFor(() => expect(createTank).toHaveBeenCalledWith(expect.objectContaining({ grade: 'Regular' }), 'Rankin'))
})

it('uses the custom grade color for both the tank liquid and its label', async () => {
  getLocation.mockResolvedValue({
    location: { stationName: 'Rankin' },
    tanks: [{ _id: 'tank-2', tankNo: 2, grade: 'Dyed Premium', tankCapacity: 25000, maxVolumeCapacity: 23750, minVolumeCapacity: 5000 }],
  })
  listGrades.mockResolvedValue([
    ...catalog, { key: 'Dyed Premium', name: 'Dyed Premium', shortName: 'PULD', color: '#c6395c', active: true },
  ])

  const Station = StationRoute.options.component!
  const { container } = renderWithQueries(<Station />)

  await waitFor(() => {
    const liquid = container.querySelector<HTMLElement>('[data-slot="tank-liquid"]')
    expect(liquid?.style.background).toBe('linear-gradient(180deg, #c6395c 0%, #c6395ccc 100%)')
    expect(screen.getByRole('combobox', { name: 'Tank #2 fuel grade' })).toHaveStyle({
      backgroundColor: '#c6395c', color: '#ffffff',
    })
  })
})

it('uses the physical tank grade for the Tank Volume label and liquid color', async () => {
  const baseTank = {
    stationName: 'Rankin', tankCapacity: 25000, maxVolumeCapacity: 23750, minVolumeCapacity: 5000,
    currentVolume: 15000, lastUpdatedVolumeReadingDateTime: '2026-11-20 08:00',
  }
  syncAllVolumes.mockResolvedValue([
    { ...baseTank, _id: 'tank-1', tankNo: 1, grade: 'Regular' },
    { ...baseTank, _id: 'tank-2', tankNo: 2, grade: 'Dyed Premium' },
  ])
  listGrades.mockResolvedValue([
    { ...catalog[0], color: '#067647' },
    ...catalog.slice(1),
    { key: 'Dyed Premium', name: 'Dyed Premium', shortName: 'PULD', color: '#c6395c', active: true },
  ])

  const Volume = VolumeRoute.options.component!
  const { container } = renderWithQueries(<Volume />)

  await waitFor(() => {
    expect(screen.getByText('RUL | E15')).toHaveStyle({ backgroundColor: '#067647' })
    expect(screen.getByText('PULD')).toHaveStyle({ backgroundColor: '#c6395c' })
    const fills = [...container.querySelectorAll<HTMLElement>('[data-slot="tank-liquid"]')]
    expect(fills.map(fill => fill.style.background)).toEqual([
      'linear-gradient(180deg, #067647 0%, #067647cc 100%)',
      'linear-gradient(180deg, #c6395c 0%, #c6395ccc 100%)',
    ])
  })
})

it('filters Tank Volume history by all grades recorded in the station history', async () => {
  syncAllVolumes.mockResolvedValue([{
    _id: 'tank-1', stationName: 'Rankin', stationId: { _id: 'station-1' }, grade: 'Regular', tankNo: 1,
    tankCapacity: 25000, maxVolumeCapacity: 23750, minVolumeCapacity: 5000, currentVolume: 15000,
  }])
  getReconciliation.mockResolvedValue([
    { date: '2026-11-19', grades: [{ grade: 'Regular', salesVolume: 50, physicalDraw: 51 }] },
    { date: '2026-11-18', grades: [
      { grade: 'Regular', salesVolume: 60, physicalDraw: 61 },
      { grade: 'Dyed Premium', salesVolume: 70, physicalDraw: 71 },
    ] },
  ])
  listGrades.mockResolvedValue([
    ...catalog, { key: 'Dyed Premium', name: 'Dyed Premium', shortName: 'PULD', color: '#c6395c', active: false },
  ])

  const Volume = VolumeRoute.options.component!
  renderWithQueries(<Volume />)

  fireEvent.click(await screen.findByRole('button', { name: 'View History' }))
  const filters = await screen.findByRole('group', { name: 'Fuel grade' })
  const regular = within(filters).getByRole('button', { name: 'RUL | E15' })
  const dyedPremium = within(filters).getByRole('button', { name: 'PULD' })
  expect(within(filters).getAllByRole('button')).toEqual([regular, dyedPremium])
  expect(regular).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Chart sales')).toHaveTextContent('50, 60')

  fireEvent.click(dyedPremium)
  expect(dyedPremium).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Chart sales')).toHaveTextContent('0, 70')
  expect(getReconciliation).toHaveBeenCalledExactlyOnceWith('station-1')
})
