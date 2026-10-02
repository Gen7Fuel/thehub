import { describe, expect, it } from "vitest";

import {
  aggregateCarrierScheduleCompliance,
  getOrderExceptions,
  type ScheduleComplianceOrder,
} from "../ScheduleComplianceExceptionCenter";

const baseOrder = {
  originalDeliveryDate: "2026-09-10T00:00:00.000Z",
  originalDeliveryWindow: { start: "08:00", end: "10:00" },
  items: [{ grade: "Regular", ltrs: 10_000 }],
};

const orders: ScheduleComplianceOrder[] = [
  {
    ...baseOrder,
    _id: "order-1",
    poNumber: "PO-1",
    currentStatus: "Delivered",
    estimatedDeliveryDate: "2026-09-10T00:00:00.000Z",
    estimatedDeliveryWindow: { start: "08:00", end: "10:00" },
    carrier: { _id: "carrier-a", carrierName: "Road Fleet" },
  },
  {
    ...baseOrder,
    _id: "order-2",
    poNumber: "PO-2",
    currentStatus: "Delivered",
    estimatedDeliveryDate: "2026-09-10T00:00:00.000Z",
    estimatedDeliveryWindow: { start: "05:00", end: "07:00" },
    carrier: { _id: "carrier-a", carrierName: "Road Fleet" },
  },
  {
    ...baseOrder,
    _id: "order-3",
    poNumber: "PO-3",
    currentStatus: "Delivered",
    estimatedDeliveryDate: "2026-09-11T00:00:00.000Z",
    estimatedDeliveryWindow: { start: "08:00", end: "10:00" },
    carrier: { _id: "carrier-b", carrierName: "North Haul" },
    supplier: { _id: "supplier-a", supplierName: "North Supply" },
    rack: {
      _id: "rack-a",
      rackName: "Toronto Rack",
      rackLocation: "Toronto",
    },
    station: { _id: "station-a", site: "Store 1" },
    comments: [
      {
        text: "Delivery pushed to next day by carrier.",
        author: "Dispatcher",
        timestamp: "2026-09-10T18:00:00.000Z",
      },
    ],
  },
  {
    ...baseOrder,
    _id: "order-4",
    poNumber: "PO-4",
    currentStatus: "Cancelled",
    estimatedDeliveryDate: "2026-09-10T00:00:00.000Z",
    estimatedDeliveryWindow: { start: "08:00", end: "10:00" },
    carrier: { _id: "carrier-b", carrierName: "North Haul" },
    supplier: { _id: "supplier-a", supplierName: "North Supply" },
    rack: {
      _id: "rack-a",
      rackName: "Toronto Rack",
      rackLocation: "Toronto",
    },
    station: { _id: "station-a", site: "Store 1" },
    comments: [
      {
        text: "Carrier could not load product.",
        author: "Scheduler",
        timestamp: "2026-09-10T14:00:00.000Z",
      },
    ],
  },
];

describe("aggregateCarrierScheduleCompliance", () => {
  it("rates delivered orders by carrier schedule accuracy", () => {
    const result = aggregateCarrierScheduleCompliance(orders, ["Regular"]);

    expect(result).toEqual([
      {
        id: "carrier-a",
        carrierName: "Road Fleet",
        early: 1,
        onTime: 1,
        delayed: 0,
        total: 2,
        onTimeRate: 100,
        delayedRate: 0,
      },
      {
        id: "carrier-b",
        carrierName: "North Haul",
        early: 0,
        onTime: 0,
        delayed: 1,
        total: 1,
        onTimeRate: 0,
        delayedRate: 100,
      },
    ]);
  });

  it("ignores orders that do not match the selected grades", () => {
    expect(aggregateCarrierScheduleCompliance(orders, ["Diesel"])).toEqual([]);
  });
});

describe("getOrderExceptions", () => {
  it("returns cancelled and delayed orders with comments and schedule context", () => {
    expect(getOrderExceptions(orders, ["Regular"])).toEqual([
      {
        id: "order-4",
        type: "Cancelled",
        poNumber: "PO-4",
        carrierName: "North Haul",
        stationName: "Store 1",
        rackLabel: "Toronto Rack · Toronto",
        supplierName: "North Supply",
        scheduledLabel: "Sep 10, 2026 08:00 - 10:00",
        estimatedLabel: "Sep 10, 2026 08:00 - 10:00",
        comments: [
          {
            text: "Carrier could not load product.",
            author: "Scheduler",
            timestamp: "2026-09-10T14:00:00.000Z",
          },
        ],
      },
      {
        id: "order-3",
        type: "Delayed",
        poNumber: "PO-3",
        carrierName: "North Haul",
        stationName: "Store 1",
        rackLabel: "Toronto Rack · Toronto",
        supplierName: "North Supply",
        scheduledLabel: "Sep 10, 2026 08:00 - 10:00",
        estimatedLabel: "Sep 11, 2026 08:00 - 10:00",
        comments: [
          {
            text: "Delivery pushed to next day by carrier.",
            author: "Dispatcher",
            timestamp: "2026-09-10T18:00:00.000Z",
          },
        ],
      },
    ]);
  });
});
