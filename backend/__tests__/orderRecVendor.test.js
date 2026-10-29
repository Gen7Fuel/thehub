import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import { createServer } from 'node:http'
import OrderRec from '../models/OrderRec.js'
import { createOrderRecVendorRouter } from '../routes/orderRecVendorRoutes.js'

const id = '507f1f77bcf86cd799439012'
const vendorId = '507f1f77bcf86cd799439011'
const permissionMap = new Map([['orderRec', 42], ['orderRec.workflow', 44], ['orderRec.scanToOrder', 43]])
const officeUser = () => ({ stationName: 'Rankin', role: { permissionsArray: [{ permId: 42, value: true }, { permId: 44, value: true }] } })

describe('head-office vendor assignment (HTTP, isolated database dependencies)', () => {
  let server, baseUrl, currentUser, order, vendor, updated, updateOrder, emit
  beforeEach(async () => {
    currentUser = officeUser()
    order = { _id: id, site: 'Rankin', source: 'scanner', vendor: '', integerId: 17, createdAt: new Date(2026, 9, 29), currentStatus: 'Created' }
    vendor = { _id: vendorId, name: 'Acme' }
    updated = { ...order, vendor: vendorId, filename: 'OrderRec - Acme - 29th October 2026 - 17' }
    updateOrder = vi.fn(async () => updated)
    emit = vi.fn()
    const app = express()
    app.use(express.json())
    app.set('io', { emit })
    app.use((req, _res, next) => { req.user = currentUser; next() })
    app.use('/api/order-rec', createOrderRecVendorRouter({
      OrderRec: {
        findById: () => ({ lean: async () => order }),
        findOneAndUpdate: updateOrder,
        buildFilename: OrderRec.buildFilename,
      },
      Vendor: { findOne: vi.fn(query => ({ lean: async () => query.location === 'Rankin' ? vendor : null })) },
      getPermissionMap: () => permissionMap,
    }))
    server = createServer(app)
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}/api/order-rec/${id}/vendor`
  })
  afterEach(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const assign = (body = { vendor: vendorId }) => fetch(baseUrl, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Required-Permission': 'orderRec.workflow' }, body: JSON.stringify(body),
  })

  it('assigns a same-site vendor, regenerates the filename, and emits an update', async () => {
    const response = await assign()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ vendor: vendorId, filename: updated.filename })
    expect(updateOrder).toHaveBeenCalledWith(expect.objectContaining({
      _id: id, source: 'scanner', vendor: { $in: ['', null] }, currentStatus: { $nin: ['Placed', 'Delivered', 'Invoice Received'] },
    }), { $set: { vendor: vendorId, filename: updated.filename } }, { new: true, runValidators: true })
    expect(emit).toHaveBeenCalledWith('orderUpdated', updated)
  })
  it('denies store scanner users even if they claim the workflow header', async () => {
    currentUser = { ...officeUser(), role: { permissionsArray: [{ permId: 42, value: true }, { permId: 43, value: true }] } }
    expect((await assign()).status).toBe(403)
    expect(updateOrder).not.toHaveBeenCalled()
  })
  it('honors user permission overrides and site access', async () => {
    currentUser = { ...officeUser(), customPermissionsArray: [{ permId: 44, value: false }] }
    expect((await assign()).status).toBe(403)
    currentUser = { ...officeUser(), stationName: 'Other store' }
    expect((await assign()).status).toBe(403)
    expect(updateOrder).not.toHaveBeenCalled()
    currentUser.site_access = { Rankin: true }
    expect((await assign()).status).toBe(200)
  })
  it('requires authentication and a valid vendor', async () => {
    currentUser = null
    expect((await assign()).status).toBe(401)
    currentUser = officeUser()
    expect((await assign({ vendor: '' })).status).toBe(400)
    vendor = null
    expect((await assign()).status).toBe(400)
    expect(updateOrder).not.toHaveBeenCalled()
  })
  it.each([{ source: 'upload' }, { vendor: vendorId }, { currentStatus: 'Placed' }, { delivered: true }])('rejects ineligible orders %j', async changes => {
    Object.assign(order, changes)
    expect((await assign()).status).toBe(409)
    expect(updateOrder).not.toHaveBeenCalled()
  })
  it('reports a concurrent assignment instead of overwriting it', async () => {
    updated = null
    expect((await assign()).status).toBe(409)
    expect(emit).not.toHaveBeenCalled()
  })
  it('reports missing orders', async () => {
    order = null
    expect((await assign()).status).toBe(404)
    expect(updateOrder).not.toHaveBeenCalled()
  })
})
