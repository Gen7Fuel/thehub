import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import { createServer } from 'node:http'
import knex from 'knex'
import { createOrderRecScanRouter } from '../routes/orderRecScanRoutes.js'
import { validateBarcode, validateScanLines, buildScanCategories, requireStoreAccess, lookupScanItem, ensureVendorAssigned } from '../services/orderRecScanner.js'

const permissionMap = new Map([['orderRec', 42], ['orderRec.scanToOrder', 43]])
const user = () => ({ stationName: 'Rankin', email: 'store@example.com', role: { permissionsArray: [{ permId: 42, value: true }, { permId: 43, value: true }] } })
const row = { id: 7, gtin: '00012345678905', upc: '12345678905', upc_barcode: '012345678905',
  description: 'Coffee', category_id: 100, on_hand_qty: '12.5000', pk_in_crt: 6, crt_in_case: 4, active: true, last_inv_date: '2026-10-26' }

describe('scanned order validation', () => {
  it('binds store and normalized barcode parameters across all three code columns', async () => {
    const db = knex({ client: 'pg' })
    let query
    db.client.runner = builder => ({ run: async () => { query = builder.toSQL(); return [row] } })
    expect(await lookupScanItem(db, 'location-1', '00012345678905')).toMatchObject({ id: 7 })
    expect(query.sql).toContain('ltrim(upc_barcode')
    expect(query.sql).toContain('ltrim(upc,')
    expect(query.sql).toContain('ltrim(gtin,')
    expect(query.bindings).toEqual(['location-1', '12345678905', '12345678905', '12345678905', 2])
    await db.destroy()
  })
  it.each(['012345678905', '00012345678905', ' 012345678905 '])('normalizes %s without dropping the check digit', code => {
    expect(validateBarcode(code)).toBe('12345678905')
  })
  it.each(['123', '00000000', '123456789012345', 'ABC012345678905', ['012345678905'], null])('rejects malformed barcode %s', code => {
    expect(() => validateBarcode(code)).toThrow()
  })
  it.each([[], [{ id: 7, quantity: 0 }], [{ id: 7, quantity: 1.5 }], [{ id: '7', quantity: 1 }],
    [{ id: 7, quantity: 100000 }], [{ id: 7, quantity: 1 }, { id: 7, quantity: 2 }]])('rejects invalid lines %j', lines => {
    expect(() => validateScanLines(lines)).toThrow()
  })
  it('builds case quantities and inventory snapshots from server rows', () => {
    const [category] = buildScanCategories([row], [{ id: 7, quantity: 3 }])
    expect(category.number).toBe('100')
    expect(category.items[0]).toMatchObject({ itemName: 'Coffee', onHandQty: 12.5, casesToOrder: 3, unitInCase: 24, itemsToOrder: 72, inventoryUpdatedAt: '2026-10-26' })
  })
  it('preserves unavailable inventory and does not invent packing data', () => {
    const [category] = buildScanCategories([{ ...row, on_hand_qty: null, pk_in_crt: null }], [{ id: 7, quantity: 2 }])
    expect(category.items[0]).toMatchObject({ onHandQty: null, casesToOrder: 2, unitInCase: 0 })
  })
  it('rejects items removed from the store and duplicate canonical codes', () => {
    expect(() => buildScanCategories([], [{ id: 7, quantity: 1 }])).toThrow(/no longer/)
    expect(() => buildScanCategories([row, { ...row, id: 8 }], [{ id: 7, quantity: 1 }, { id: 8, quantity: 1 }])).toThrow(/duplicate/)
  })
  it('honors user overrides and site access', () => {
    expect(() => requireStoreAccess({ ...user(), customPermissionsArray: [{ permId: 42, value: false }] }, 'Rankin', permissionMap)).toThrow(/Access denied/)
    expect(() => requireStoreAccess(user(), 'Other store', permissionMap)).toThrow(/site/)
    expect(() => requireStoreAccess({ ...user(), site_access: { 'Other store': true } }, 'Other store', permissionMap)).not.toThrow()
  })
  it('requires the dedicated permission even with access to the parent module', () => {
    const parentOnly = { ...user(), role: { permissionsArray: [{ permId: 42, value: true }] } }
    expect(() => requireStoreAccess(parentOnly, 'Rankin', permissionMap)).toThrow(/orderRec.scanToOrder/)
    expect(() => requireStoreAccess(user(), 'Rankin', new Map([['orderRec', 42]]))).toThrow(/orderRec.scanToOrder/)
  })
  it('honors an explicit scanner deny or grant over the role default', () => {
    expect(() => requireStoreAccess({ ...user(), customPermissionsArray: [{ permId: 43, value: false }] }, 'Rankin', permissionMap)).toThrow(/orderRec.scanToOrder/)
    const granted = { ...user(), role: { permissionsArray: [{ permId: 42, value: true }, { permId: 43, value: false }] }, customPermissionsArray: [{ permId: 43, value: true }] }
    expect(() => requireStoreAccess(granted, 'Rankin', permissionMap)).not.toThrow()
  })
})

describe('scan endpoints (HTTP, isolated database dependencies)', () => {
  let server, baseUrl, currentUser, rows, location, lookupFailed, db, createOrderRec
  beforeEach(async () => {
    currentUser = user()
    rows = [row]
    location = { _id: 'location-1' }
    lookupFailed = false
    db = vi.fn(() => {
      const builder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn(function (callback) {
          callback.call({ whereRaw: vi.fn().mockReturnThis(), orWhereRaw: vi.fn().mockReturnThis() })
          return this
        }),
        whereIn: vi.fn().mockReturnThis(),
        select: vi.fn(() => ({
          limit: async () => { if (lookupFailed) throw new Error('DB unavailable'); return rows },
          then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
        })),
      }
      return builder
    })
    createOrderRec = vi.fn((req, res) => res.status(201).json({ _id: 'order-1', ...req.body }))
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => { req.user = currentUser; next() })
    app.use('/api/order-rec/scan', createOrderRecScanRouter({
      getPg: () => db,
      Location: { findOne: () => ({ lean: async () => location }) },
      getPermissionMap: () => permissionMap,
      createOrderRec,
    }))
    server = createServer(app)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}/api/order-rec/scan`
  })
  afterEach(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const payload = () => ({ site: 'Rankin', items: [{ id: 7, quantity: 2 }] })
  const post = (body) => fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  it('returns the selected store inventory and scopes the query to its location ID', async () => {
    const response = await fetch(`${baseUrl}/item?site=Rankin&upc=012345678905`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: 7, itemName: 'Coffee', onHandQty: 12.5 })
    expect(db.mock.results[0].value.where).toHaveBeenCalledWith({ site: 'location-1' })
  })
  it('returns 404 for an unknown barcode and 409 for an ambiguous barcode', async () => {
    rows = []
    expect((await fetch(`${baseUrl}/item?site=Rankin&upc=012345678905`)).status).toBe(404)
    rows = [row, { ...row, id: 8 }]
    expect((await fetch(`${baseUrl}/item?site=Rankin&upc=012345678905`)).status).toBe(409)
  })
  it('fails lookup without claiming missing inventory when the database is unavailable', async () => {
    lookupFailed = true
    const response = await fetch(`${baseUrl}/item?site=Rankin&upc=012345678905`)
    expect(response.status).toBe(500)
    expect((await response.json()).message).toMatch(/try again/)
  })
  it('requires authentication, order rec permission, and store access without trusting a header', async () => {
    currentUser = null
    expect((await post(payload())).status).toBe(401)
    currentUser = { ...user(), role: { permissionsArray: [] } }
    expect((await post(payload())).status).toBe(403)
    currentUser = { ...user(), stationName: 'Other store' }
    expect((await post(payload())).status).toBe(403)
    expect(db).not.toHaveBeenCalled()
  })
  it('denies both scanner endpoints when only the parent module is granted', async () => {
    currentUser = { ...user(), role: { permissionsArray: [{ permId: 42, value: true }] } }
    const lookup = await fetch(`${baseUrl}/item?site=Rankin&upc=012345678905`, { headers: { 'X-Required-Permission': 'orderRec' } })
    expect(lookup.status).toBe(403)
    expect((await lookup.json()).message).toContain('orderRec.scanToOrder')
    expect((await post(payload())).status).toBe(403)
    expect(db).not.toHaveBeenCalled()
    expect(createOrderRec).not.toHaveBeenCalled()
  })
  it('creates an order through the existing workflow with canonical data and authenticated email', async () => {
    const response = await post({ ...payload(), email: 'spoof@example.com', categories: [{ number: '999' }], onHandQty: 999 })
    expect(response.status).toBe(201)
    const order = await response.json()
    expect(order).toMatchObject({ source: 'scanner', vendor: '', email: 'store@example.com', categories: [{ number: '100', items: [{ onHandQty: 12.5, casesToOrder: 2 }] }] })
    expect(createOrderRec.mock.calls[0][0].orderRecSource).toBe('scanner')
    expect(createOrderRec).toHaveBeenCalledOnce()
    expect(db.mock.results[0].value.whereIn).toHaveBeenCalledWith('id', [7])
  })
  it('leaves vendor pending even if a store submits one', async () => {
    const response = await post({ ...payload(), vendor: '507f1f77bcf86cd799439011' })
    expect(response.status).toBe(201)
    expect((await response.json()).vendor).toBe('')
  })
  it('rejects removed items', async () => {
    rows = []
    expect((await post(payload())).status).toBe(409)
    expect(createOrderRec).not.toHaveBeenCalled()
  })
})

describe('pending vendor placement guard', () => {
  it.each([{ status: 'Placed' }, { status: 'Delivered' }, { status: 'Invoice Received' }, { orderPlaced: true }, { delivered: true }])('blocks fulfillment %j before vendor assignment', updates => {
    expect(() => ensureVendorAssigned({ source: 'scanner', vendor: '' }, updates)).toThrow(/assign a vendor/)
  })
  it('allows review completion before assignment and placement after assignment', () => {
    expect(() => ensureVendorAssigned({ source: 'scanner', vendor: '' }, { status: 'Completed' })).not.toThrow()
    expect(() => ensureVendorAssigned({ source: 'scanner', vendor: 'vendor-1' }, { status: 'Placed' })).not.toThrow()
    expect(() => ensureVendorAssigned({ source: 'upload', vendor: 'vendor-1' }, { orderPlaced: true })).not.toThrow()
  })
})
