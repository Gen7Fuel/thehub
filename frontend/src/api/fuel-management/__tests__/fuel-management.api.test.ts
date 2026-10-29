import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
}))

vi.mock('@/api/core/clients', () => ({ apiClient: mocks }))

import { fuelCarriersService } from '../fuel-carriers.service'
import { buildFuelOrderAccessGroupId, fuelOrdersService } from '../fuel-orders.service'
import { fuelRacksService } from '../fuel-racks.service'
import { fuelSalesService } from '../fuel-sales.service'
import { fuelStationTanksService } from '../fuel-station-tanks.service'
import { fuelStatisticsService } from '../fuel-statistics.service'
import { fuelSuppliersService } from '../fuel-suppliers.service'

describe('Fuel Management API contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const mock of Object.values(mocks)) mock.mockResolvedValue({ data: {} })
  })

  it('annotates shared resource reads with the page-specific purpose', async () => {
    await fuelRacksService.list('fuel-management.create-order', 'Fuel rack options viewed while creating an order')
    await fuelSuppliersService.list('rack-7', 'fuel-management.workspace', 'Suppliers viewed for the selected rack')
    await fuelCarriersService.list('fuel-management.manage.stations', 'Carriers viewed while editing a station')

    expect(mocks.get.mock.calls[0]).toEqual(['/fuel-racks', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Required-Permission': 'fuelManagement.manage',
        'X-Action-Source': 'fuel-management.create-order',
        'X-Action-Message': 'Fuel rack options viewed while creating an order',
      }),
    })])
    expect(mocks.get.mock.calls[1][1]).toEqual(expect.objectContaining({ params: { associatedRack: 'rack-7' } }))
    expect(mocks.get.mock.calls[2][1].headers['X-Action-Resource']).toBe('fuel-carrier')
  })

  it('covers carrier, rack, and supplier mutations with resource metadata', async () => {
    await fuelCarriersService.create({ carrierName: 'North Trucking' }, 'North Trucking')
    await fuelRacksService.update('rack-1', { rackName: 'Sarnia' }, 'Sarnia')
    await fuelSuppliersService.remove('supplier-1', 'Imperial')

    expect(mocks.post).toHaveBeenCalledWith('/fuel-carriers', expect.anything(), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Type': 'create', 'X-Action-Source': 'fuel-management.manage.carriers' }),
    }))
    expect(mocks.put).toHaveBeenCalledWith('/fuel-racks/rack-1', expect.anything(), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Type': 'update', 'X-Action-Resource': 'fuel-rack' }),
    }))
    expect(mocks.delete).toHaveBeenCalledWith('/fuel-suppliers/supplier-1', expect.objectContaining({
      headers: expect.objectContaining({ 'X-Action-Type': 'delete', 'X-Action-Message': 'Fuel supplier deletion requested for Imperial' }),
    }))
  })

  it('distinguishes workspace, pipeline, create-order, and volume requests', async () => {
    await fuelOrdersService.listWorkspace('station-1', '2026-10-29', 'fuel-management.order-pipeline')
    await fuelOrdersService.create({ orders: [{ poNumber: 'PO1' }] }, 1)
    await fuelStationTanksService.getStationProjection('station-1', '2026-10-29', 'fuel-management.workspace')
    await fuelStationTanksService.manualUpdate('tank-1', { volume: 1200 }, 'Tank #1')

    expect(mocks.get.mock.calls[0][1]).toEqual(expect.objectContaining({
      params: { stationId: 'station-1', date: '2026-10-29' },
      headers: expect.objectContaining({
        'X-Required-Permission': 'fuelManagement.workspace',
        'X-Action-Source': 'fuel-management.order-pipeline',
      }),
    }))
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'fuelManagement.createOrder',
      'X-Action-Type': 'create',
    }))
    expect(mocks.get.mock.calls[1][1].headers['X-Action-Source']).toBe('fuel-management.workspace')
    expect(mocks.patch.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'fuelManagement.volume.addPhysicalReading',
      'X-Action-Message': 'Manual fuel volume reading submitted for Tank #1',
    }))
  })

  it('annotates sales synchronization and statistics payloads', async () => {
    await fuelSalesService.sync('station-1', 'Rankin')
    await fuelStatisticsService.pipelineSummary(['station-1', 'station-2'], '2026-09-01', '2026-10-01')

    expect(mocks.post.mock.calls[0][0]).toBe('/fuel-sales/sync/station-1')
    expect(mocks.post.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Action-Type': 'update',
      'X-Action-Message': 'Live fuel sales synchronization requested for Rankin',
    }))
    expect(mocks.post.mock.calls[1]).toEqual([
      '/fuel-statistics/pipeline-summary',
      { stationIds: ['station-1', 'station-2'], fromMonth: '2026-09-01', toMonth: '2026-10-01' },
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Action-Source': 'fuel-management.statistics' }) }),
    ])
  })

  it('reuses tank volume resources for the Fuel Dip Readings page', async () => {
    await fuelStationTanksService.syncAllVolumes(
      'fuel-dip-readings',
      'Fuel dip readings loaded for Rankin',
      'fuelDipReadings.addNewReadings',
    )
    await fuelStationTanksService.manualUpdate(
      'tank-1',
      { volume: 8000, manualDate: '2026-10-29', manualTime: '15:45' },
      'Tank #1 (Regular) at Rankin',
      'fuel-dip-readings',
      'fuelDipReadings.addNewReadings',
    )

    expect(mocks.get.mock.calls[0]).toEqual([
      '/fuel-station-tanks/sync-all-volumes',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Required-Permission': 'fuelDipReadings.addNewReadings',
          'X-Action-Source': 'fuel-dip-readings',
          'X-Action-Message': 'Fuel dip readings loaded for Rankin',
        }),
      }),
    ])
    expect(mocks.patch.mock.calls[0][2].headers).toEqual(expect.objectContaining({
      'X-Required-Permission': 'fuelDipReadings.addNewReadings',
      'X-Action-Source': 'fuel-dip-readings',
      'X-Action-Message': 'Manual fuel volume reading submitted for Tank #1 (Regular) at Rankin',
    }))
  })

  it('keeps retain and order edits on the centralized fuel-orders resource', async () => {
    await fuelOrdersService.getRetainPoNumber('order-1', 'station-2', '2026-10-30')
    await fuelOrdersService.update('order-1', { currentStatus: 'Delivered' }, 'Status update', 'fuelManagement.workspace.updateOrderStatus')
    await fuelOrdersService.retain({ stationId: 'station-2' }, 'order-1')

    expect(mocks.get.mock.calls[0][0]).toBe('/fuel-orders/retain-po-number')
    expect(mocks.put.mock.calls[0][0]).toBe('/fuel-orders/order-1')
    expect(mocks.put.mock.calls[0][2].headers['X-Required-Permission']).toBe('fuelManagement.workspace.updateOrderStatus')
    expect(mocks.post.mock.calls[0][0]).toBe('/fuel-orders/retain')
  })

  it('groups multi-station order reads under one selection-level access record', async () => {
    const groupId = buildFuelOrderAccessGroupId(
      'fuel-management.workspace',
      '2026-10-29',
      ['station-b', 'station-a'],
    )
    const accessContext = {
      groupId,
      message: 'Fuel orders viewed for Rankin, Sarnia on 2026-10-29',
    }

    await fuelOrdersService.listWorkspace('station-a', '2026-10-29', 'fuel-management.workspace', accessContext)
    await fuelOrdersService.listWorkspace('station-b', '2026-10-29', 'fuel-management.workspace', accessContext)

    expect(buildFuelOrderAccessGroupId('fuel-management.workspace', '2026-10-29', ['station-a', 'station-b']))
      .toBe(groupId)
    for (const [, config] of mocks.get.mock.calls) {
      expect(config.headers).toEqual(expect.objectContaining({
        'X-Action-Group-Id': groupId,
        'X-Action-Message': accessContext.message,
      }))
    }
  })

  it('groups multi-station tank projections with readable site names', async () => {
    const accessContext = {
      groupId: buildFuelOrderAccessGroupId(
        'fuel-management.workspace',
        '2026-10-29',
        ['station-a', 'station-b'],
      ),
      message: 'Fuel tank projections viewed for Rankin, Sarnia on 2026-10-29',
    }

    await fuelStationTanksService.getStationProjection(
      'station-a',
      '2026-10-29',
      'fuel-management.workspace',
      'fuelManagement.workspace',
      accessContext,
    )
    await fuelStationTanksService.getStationProjection(
      'station-b',
      '2026-10-29',
      'fuel-management.workspace',
      'fuelManagement.workspace',
      accessContext,
    )

    for (const [, config] of mocks.get.mock.calls) {
      expect(config.headers).toEqual(expect.objectContaining({
        'X-Action-Group-Id': accessContext.groupId,
        'X-Action-Resource': 'fuel-station-tank',
        'X-Action-Message': accessContext.message,
      }))
    }
  })

  it('prevents Fuel Management pages from reintroducing direct HTTP calls', () => {
    const testDir = path.dirname(fileURLToPath(import.meta.url))
    const routeRoot = path.resolve(testDir, '../../../routes/_navbarLayout/fuel-management')
    const files: string[] = []
    const visit = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name)
        if (entry.isDirectory()) visit(fullPath)
        else if (entry.name.endsWith('.tsx')) files.push(fullPath)
      }
    }
    visit(routeRoot)
    files.push(path.resolve(routeRoot, '../fuel-dip-readings.tsx'))

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(source, path.relative(routeRoot, file)).not.toMatch(/axios\.(get|post|put|patch|delete)\s*\(/)
      expect(source, path.relative(routeRoot, file)).not.toMatch(/\bfetch\s*\(/)
    }
  })

  it('never sends frontend-only .value permission paths to the backend', async () => {
    await fuelOrdersService.listWorkspace('station-1', '2026-10-29')
    await fuelStationTanksService.listLocations('fuel-management.workspace', 'Stations viewed')
    await fuelStationTanksService.getStationProjection('station-1', '2026-10-29', 'fuel-management.workspace')
    await fuelSalesService.sync('station-1', 'Rankin')

    const requestConfigs = [
      ...mocks.get.mock.calls.map((call) => call[1]),
      ...mocks.post.mock.calls.map((call) => call[2]),
    ]
    for (const config of requestConfigs) {
      expect(config.headers['X-Required-Permission']).not.toMatch(/\.value$/)
    }
    expect(requestConfigs.map((config) => config.headers['X-Required-Permission']))
      .toEqual(['fuelManagement.workspace', 'fuelManagement.workspace', 'fuelManagement.workspace', 'fuelManagement.workspace'])
  })
})
