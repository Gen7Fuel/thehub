import { describe, expect, it } from "vitest";

import {
  aggregateCarrierBadgeAllocations,
  type CarrierBadgeOrder,
} from "../CarrierBadgeAllocationChart";

const orders: CarrierBadgeOrder[] = [
  {
    _id: "order-1",
    currentStatus: "Delivered",
    badgeNo: "A-100",
    carrier: { _id: "carrier-a", carrierName: "Road Fleet" },
    supplier: { _id: "supplier-a", supplierName: "North Supply" },
    items: [
      { grade: "Regular", ltrs: 10_000 },
      { grade: "Premium", ltrs: 2_000 },
    ],
  },
  {
    _id: "order-2",
    currentStatus: "Created",
    badgeNo: "A-100",
    carrier: { _id: "carrier-a", carrierName: "Road Fleet" },
    supplier: { _id: "supplier-b", supplierName: "Lake Supply" },
    items: [
      { grade: "Regular", ltrs: 5_000 },
      { grade: "Diesel", ltrs: 3_000 },
    ],
  },
  {
    _id: "order-3",
    currentStatus: "Delivered",
    badgeNo: "B-200",
    carrier: { _id: "carrier-b", carrierName: "North Haul" },
    supplier: { _id: "supplier-a", supplierName: "North Supply" },
    items: [
      { grade: "Regular", ltrs: 4_000 },
      { grade: "Diesel", ltrs: 6_000 },
    ],
  },
  {
    _id: "order-4",
    currentStatus: "Cancelled",
    badgeNo: "C-300",
    carrier: { _id: "carrier-c", carrierName: "Cancelled Carrier" },
    supplier: { _id: "supplier-c", supplierName: "Closed Supply" },
    items: [{ grade: "Regular", ltrs: 20_000 }],
  },
];

describe("aggregateCarrierBadgeAllocations", () => {
  it("groups delivered litres by carrier, badge, and supplier", () => {
    const result = aggregateCarrierBadgeAllocations(
      orders,
      ["Regular"],
      "delivered",
    );

    expect(result).toEqual([
      {
        id: "carrier-a:A-100:North Supply",
        carrierName: "Road Fleet",
        badgeNo: "A-100",
        supplierName: "North Supply",
        label: "A-100 · North Supply",
        litres: 10_000,
        orderCount: 1,
        grades: { Regular: 10_000 },
      },
      {
        id: "carrier-b:B-200:North Supply",
        carrierName: "North Haul",
        badgeNo: "B-200",
        supplierName: "North Supply",
        label: "B-200 · North Supply",
        litres: 4_000,
        orderCount: 1,
        grades: { Regular: 4_000 },
      },
    ]);
  });

  it("keeps the same badge split by supplier for ordered volume", () => {
    const result = aggregateCarrierBadgeAllocations(
      orders,
      ["Regular", "Premium", "Diesel"],
      "ordered",
    );

    expect(result.map((item) => item.id)).toEqual([
      "carrier-a:A-100:North Supply",
      "carrier-b:B-200:North Supply",
      "carrier-a:A-100:Lake Supply",
    ]);
    expect(result[2]).toMatchObject({
      litres: 8_000,
      orderCount: 1,
      grades: { Regular: 5_000, Diesel: 3_000 },
    });
  });

  it("returns no allocations when no grades are selected", () => {
    expect(aggregateCarrierBadgeAllocations(orders, [], "delivered")).toEqual(
      [],
    );
  });
});
