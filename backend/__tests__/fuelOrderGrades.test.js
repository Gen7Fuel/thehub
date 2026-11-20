import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import mongoose from 'mongoose';
import moment from 'moment-timezone';
import { describe, expect, it, vi } from 'vitest';

const [rackId, supplierId, carrierId, firstStation, secondStation] = Array.from({ length: 5 }, (_, index) =>
  String(index + 1).padStart(24, '0'));
const orderSource = readFileSync(new URL('../routes/fuel/fuelOrderRoutes.js', import.meta.url), 'utf8');

function setUpOrders({ secondTankGrade = 'Regular', upcomingOrders = [] } = {}) {
  const routes = new Map();
  const saved = [];
  const queue = { add: vi.fn().mockResolvedValue({ id: 'draft-test' }) };
  const notificationQueue = { add: vi.fn().mockResolvedValue({ id: 'notification-test' }) };

  class FuelOrder {
    constructor(data) { this.data = data; this._id = data.poNumber; }
    static async findOne() { return null; }
    static find() {
      const result = Promise.resolve(upcomingOrders);
      result.populate = () => result;
      return result;
    }
    async save() { saved.push(this.data); return this; }
    toObject() { return this.data; }
  }

  const lookup = (data) => ({ findById: () => ({ lean: async () => data }) });
  const grades = [
    { key: 'Dyed Premium', name: 'Premium <Blend>', sortOrder: 1 },
    { key: 'Regular', name: 'Regular', sortOrder: 2 },
    { key: 'E15', name: 'E15', sortOrder: 3 },
    { key: 'Archived Blend', name: 'Former Blend', sortOrder: 4, active: false },
  ];
  const dependencies = {
    express: { Router: () => ({
      get: (path, handler) => routes.set(path, handler),
      put() {},
      post: (path, handler) => routes.set(path, handler),
    }) },
    mongoose,
    'moment-timezone': moment,
    '../../models/Location': { find: () => ({ lean: async () => [
      { _id: firstStation, stationName: 'Station A', fuelCustomerName: 'Station A' },
      { _id: secondStation, stationName: 'Station B', fuelCustomerName: 'Station B' },
    ] }) },
    '../../models/fuel/FuelStationTank': { find: () => ({ lean: async () => [
      { stationId: firstStation, grade: 'Regular' }, { stationId: firstStation, grade: 'Dyed Premium' },
      { stationId: firstStation, grade: 'Diesel' }, { stationId: secondStation, grade: secondTankGrade },
    ] }) },
    '../../models/fuel/FuelOrder': FuelOrder,
    '../../models/fuel/FuelCarrier': lookup({}),
    '../../models/fuel/FuelSupplier': lookup({ associatedRack: rackId, supplierName: 'Supplier', supplierBadges: [
      { badgeNumber: 'primary', availableGrades: ['Regular', 'Dyed Premium', 'Diesel'] },
      { badgeNumber: 'secondary', availableGrades: ['E15'] },
    ] }),
    '../../models/fuel/FuelRack': lookup({ _id: rackId, availableGrades: ['Regular', 'E15', 'Dyed Premium', 'Diesel'] }),
    '../../models/fuel/FuelGrade': { find: filter => ({
      sort: () => ({ lean: async () => grades.filter(grade => !filter.active || grade.active !== false) }),
    }) },
    '../../queues/emailQueue': { emailQueue: notificationQueue },
    '../../queues/fuelOrderDraftQueue': { fuelOrderDraftQueue: queue },
    '../../middleware/changeLogger': { logChange: async () => {} },
  };
  runInNewContext(orderSource, { require: name => dependencies[name], module: { exports: {} }, console });

  async function submit(orders) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await routes.get('/')({ body: {
      rackId, supplierId, carrierId, orders, isSplit: true,
      orderDate: '2026-11-20', deliveryDate: '2026-11-21', startTime: '08:00', endTime: '12:00',
    } }, res);
    return res;
  }

  async function notifyUpcoming() {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await routes.get('/notify-upcoming')({}, res);
    return res;
  }

  return { submit, saved, queue, notifyUpcoming, notificationQueue };
}

function order(stationId, poNumber, badgeNo, grades) {
  return { stationId, poNumber, badgeNo, customerName: poNumber, pdfBase64: 'test-pdf',
    items: grades.map(grade => ({ grade, ltrs: 1000 })) };
}

describe('Fuel order grade validation and drafts', () => {
  it('keeps stable grade keys across a two-station, two-badge order and uses catalog labels in the draft', async () => {
    const { submit, saved, queue } = setUpOrders();
    const orders = [
      order(firstStation, 'A1', 'primary', ['Regular', 'Dyed Premium']),
      order(firstStation, 'A2', 'secondary', ['E15']),
      order(secondStation, 'B1', 'primary', ['Regular']),
      order(secondStation, 'B2', 'secondary', ['E15']),
    ];

    const res = await submit(orders);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(saved.map(entry => entry.items)).toEqual(orders.map(entry => entry.items));
    const { draftPayload } = queue.add.mock.calls[0][1];
    expect(draftPayload.attachments).toHaveLength(4);
    expect(draftPayload.body.content).toContain('1K Premium &lt;Blend&gt;<br>1K Regular');
    expect(draftPayload.body.content).toContain('1K E15');
    expect(draftPayload.body.content).toContain('FOR ANY LOAD DELIVERED TO MULTIPLE STATIONS');
  });

  it.each([
    { grade: 'Diesel', badge: 'primary', station: firstStation, tank: 'Regular' },
    { grade: 'E15', badge: 'primary', station: firstStation, tank: 'Regular' },
    { grade: 'E15', badge: 'secondary', station: secondStation, tank: 'E15' },
  ])('rejects unavailable $grade on the later PO before any part of the batch is saved', async ({ grade, badge, station, tank }) => {
    const { submit, saved, queue } = setUpOrders({ secondTankGrade: tank });
    const res = await submit([order(firstStation, 'A1', 'primary', ['Regular']), order(station, 'A2', badge, [grade])]);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining(`${grade} is unavailable`) });
    expect(saved).toHaveLength(0);
    expect(queue.add).not.toHaveBeenCalled();
  });
});

it('includes E15, custom, archived and unknown grades with litres in both upcoming notifications', async () => {
  const timezone = 'America/Vancouver';
  const estimatedDeliveryDate = moment().tz(timezone).add(1, 'day').startOf('day').toDate();
  const { notifyUpcoming, notificationQueue, queue } = setUpOrders({
    upcomingOrders: [{
      estimatedDeliveryDate,
      station: { timezone, province: 'British Columbia', stationName: 'Station B' },
      poNumber: 'B1',
      items: [
        { grade: 'Unknown <Grade>', ltrs: 800 },
        { grade: 'E15', ltrs: 1500 },
        { grade: 'Regular', ltrs: 2000 },
        { grade: 'Dyed Premium', ltrs: 1000 },
        { grade: 'Archived Blend', ltrs: 300 },
        { grade: 'Zero Grade', ltrs: 0 },
      ],
    }],
  });

  const res = await notifyUpcoming();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(notificationQueue.add).toHaveBeenCalledTimes(2);
  expect(queue.add).not.toHaveBeenCalled();

  for (const [job, { html }] of notificationQueue.add.mock.calls) {
    expect(job).toBe('sendFuelOrderNotification');
    expect([...html.matchAll(/<b style="color: #4a5568;">([^<]+):<\/b>/g)].map(([, grade]) => grade))
      .toEqual(['Premium &lt;Blend&gt;', 'Regular', 'E15', 'Former Blend', 'Unknown &lt;Grade&gt;']);
    expect(html).toContain('E15:</b> ' + (1500).toLocaleString() + 'L');
  }
});
