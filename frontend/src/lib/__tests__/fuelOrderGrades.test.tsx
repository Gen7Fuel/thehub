import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { POPreviewDocument } from '@/components/custom/fuelPoPDF'
import { getOrderGradeItems, getOrderTankGrade } from '../fuelOrderGrades'

vi.mock('@react-pdf/renderer', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return { Document: Container, Page: Container, View: Container, Text: Container, Image: () => null, StyleSheet: { create: (styles: object) => styles } }
})

const catalog = [
  { key: 'Dyed Premium', name: 'Premium Blend', shortName: 'PULD', color: '#c6395c', active: true },
  { key: 'E15', name: 'E15', shortName: 'E15', color: '#475569', active: true },
  { key: 'Regular', name: 'Regular', shortName: 'UNL', color: '#22c55e', active: true },
  { key: 'Diesel', name: 'Diesel', shortName: 'ULSD', color: '#fbbf24', active: false },
]
const rackGrades = ['Regular', 'E15', 'Dyed Premium', 'Diesel']

it('uses active catalog order and independent grade eligibility for each station and badge', () => {
  const stationOne = ['Regular', 'Dyed Premium', 'Diesel']
  const stationTwo = ['Regular', 'Diesel']
  const primaryBadgeGrades = ['Regular', 'Dyed Premium', 'Diesel']
  const secondaryBadgeGrades = ['E15']

  expect(getOrderGradeItems(catalog, stationOne, rackGrades, primaryBadgeGrades, [
    { grade: 'Regular', ltrs: 1000 }, { grade: 'Diesel', ltrs: 5000 },
  ])).toEqual([{ grade: 'Dyed Premium', ltrs: 0 }, { grade: 'Regular', ltrs: 1000 }])
  expect(getOrderGradeItems(catalog, stationTwo, rackGrades, primaryBadgeGrades, [])).toEqual([{ grade: 'Regular', ltrs: 0 }])
  expect(getOrderGradeItems(catalog, stationOne, rackGrades, secondaryBadgeGrades, [{ grade: 'E15', ltrs: 3000 }]))
    .toEqual([{ grade: 'E15', ltrs: 3000 }])
  expect(getOrderGradeItems(catalog, stationTwo, rackGrades, secondaryBadgeGrades, [])).toEqual([{ grade: 'E15', ltrs: 0 }])
})

it('requires a Regular tank for E15 and keeps E15 as the order key', () => {
  expect(getOrderTankGrade('E15')).toBe('Regular')
  expect(getOrderGradeItems(catalog, ['E15'], rackGrades, ['E15'], [])).toEqual([])
  expect(getOrderGradeItems(catalog, ['Regular'], ['Regular'], ['E15'], [])).toEqual([])
})

it('formats both standard and custom grades using catalog names on the Create Order PDF', () => {
  render(<POPreviewDocument grades={catalog} selectedStation={{ fuelCustomerName: 'Station One' }} data={{
    poNumber: 'PO-1', badgeNo: 'badge-1', deliveryDate: '2026-11-20', startTime: '08:00', endTime: '12:00',
    items: [{ grade: 'Dyed Premium', ltrs: 1250 }, { grade: 'E15', ltrs: 2500 }, { grade: 'Regular', ltrs: 1000 }],
  }} />)

  expect(screen.getByText('PULD (Premium Blend)')).toBeInTheDocument()
  expect(screen.getByText('UNL (Regular)')).toBeInTheDocument()
  expect(screen.getByText((1250).toLocaleString())).toBeInTheDocument()
  expect(screen.getByText('E15')).toBeInTheDocument()
  expect(screen.queryByText('ULSD (Diesel)')).not.toBeInTheDocument()
})
