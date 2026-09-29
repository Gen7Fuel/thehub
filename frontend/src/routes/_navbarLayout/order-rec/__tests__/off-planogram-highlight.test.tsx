import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// Guards the `item.offPlanogram === true` contract on the order rec row.
//
// Strict equality matters because PUT /api/order-rec/:id replaces the whole
// categories array from the client, and the offline IndexedDB cache can hold
// documents written before offPlanogram existed. Those items arrive as
// `undefined`, and a truthiness check would still be correct — but a
// `!== false` check would light up every row on every legacy order rec.

const { mockGetOrderRecById, mockNavigate } = vi.hoisted(() => ({
  mockGetOrderRecById: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    createFileRoute: () => (config: any) => ({
      ...config,
      fullPath: '/_navbarLayout/order-rec/$id',
      useParams: () => ({ id: 'rec-1' }),
    }),
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/lib/orderRecIndexedDB', () => ({
  getOrderRecById: mockGetOrderRecById,
  saveOrderRec: vi.fn(),
  savePendingAction: vi.fn(),
  // Short-circuits the network refresh so the cached document is what renders.
  hasPendingActionsForId: vi.fn().mockResolvedValue(true),
  deletePendingActionsForId: vi.fn(),
}))

vi.mock('@/lib/network', () => ({ isActuallyOnline: vi.fn().mockResolvedValue(false) }))

vi.mock('axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), isAxiosError: vi.fn(() => false) },
}))

// `access.orderRec.id` specifically: the detail page's effect only fetches when
// that permission is present, and otherwise redirects to /no-access.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 't@e.com', access: { orderRec: { value: true, id: true } } },
  }),
}))

vi.mock('@/components/custom/OrderRecChat', () => ({ OrderRecChat: () => null }))
vi.mock('exceljs', () => ({ default: { Workbook: class {} } }))

import { Route as DetailRoute } from '../$id'

const OrderRecDetail = (DetailRoute as any).component as React.ComponentType

const recWith = (items: Array<any>) => ({
  _id: 'rec-1',
  id: 'rec-1',
  filename: 'OrderRec - Vendor A - 1',
  site: 'Silver Grizzly',
  vendor: 'vendor-1',
  currentStatus: 'Created',
  completed: false,
  categories: [{ number: '100', name: 'Chew', items, completed: false }],
  comments: [],
  statusHistory: [],
})

/** The <tr> that contains a given GTIN. */
const rowFor = (gtin: string) => screen.getByText(gtin).closest('tr')!

/**
 * Render the detail page and open the category. Item rows live inside a Radix
 * accordion that is collapsed on mount, so they aren't in the DOM until then.
 */
const renderAndExpand = async (items: Array<any>) => {
  mockGetOrderRecById.mockResolvedValue(recWith(items))

  render(
    <React.Suspense fallback={null}>
      <OrderRecDetail />
    </React.Suspense>,
  )

  const trigger = await screen.findByRole('button', { name: /Chew/ }, { timeout: 5000 })
  fireEvent.click(trigger)
  await waitFor(() => expect(screen.getByText(items[0].gtin)).toBeInTheDocument())
}

describe('order rec row — off-planogram highlight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('token', 'test-token')
  })

  it('highlights a row whose item is flagged off-planogram', async () => {
    await renderAndExpand([
      { gtin: '012345678901', itemName: 'Off Planogram Item', offPlanogram: true },
    ])

    expect(rowFor('012345678901').className).toContain('bg-red-50')
    expect(screen.getByText('OFF PLANOGRAM')).toBeInTheDocument()
  })

  it('leaves a row clean when the item is explicitly not flagged', async () => {
    await renderAndExpand([
      { gtin: '012345678901', itemName: 'Normal Item', offPlanogram: false },
    ])

    expect(rowFor('012345678901').className).not.toContain('bg-red-50')
    expect(screen.queryByText('OFF PLANOGRAM')).not.toBeInTheDocument()
  })

  // The stale-cache case: a document cached before offPlanogram existed.
  it('leaves a row clean when the field is missing entirely', async () => {
    await renderAndExpand([{ gtin: '012345678901', itemName: 'Legacy Item' }])

    expect(rowFor('012345678901').className).not.toContain('bg-red-50')
    expect(screen.queryByText('OFF PLANOGRAM')).not.toBeInTheDocument()
  })

  it('flags only the offending row when a category mixes both', async () => {
    await renderAndExpand([
      { gtin: '111111111111', itemName: 'On planogram', offPlanogram: false },
      { gtin: '222222222222', itemName: 'Off planogram', offPlanogram: true },
      { gtin: '333333333333', itemName: 'Legacy, no field' },
    ])

    expect(rowFor('111111111111').className).not.toContain('bg-red-50')
    expect(rowFor('222222222222').className).toContain('bg-red-50')
    expect(rowFor('333333333333').className).not.toContain('bg-red-50')
    expect(screen.getAllByText('OFF PLANOGRAM')).toHaveLength(1)
  })
})
