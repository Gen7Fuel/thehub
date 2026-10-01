import { describe, expect, it } from "vitest";

import {
  aggregateSupplierRackVolumes,
  type SupplierRackOrder,
} from "../SupplierRackVolumeChart";

const orders: SupplierRackOrder[] = [
  {
    _id: "order-1",
    currentStatus: "Delivered",
    supplier: { _id: "supplier-a", supplierName: "North Supply" },
    rack: { _id: "rack-a", rackName: "Toronto Rack" },
    items: [
      { grade: "Regular", ltrs: 10_000 },
      { grade: "Premium", ltrs: 2_000 },
    ],
  },
  {
    _id: "order-2",
    currentStatus: "Created",
    supplier: { _id: "supplier-a", supplierName: "North Supply" },
    rack: { _id: "rack-b", rackName: "Ottawa Rack" },
    items: [
      { grade: "Regular", ltrs: 5_000 },
      { grade: "Diesel", ltrs: 3_000 },
    ],
  },
  {
    _id: "order-3",
    currentStatus: "Delivered",
    supplier: { _id: "supplier-b", supplierName: "Lake Supply" },
    rack: { _id: "rack-a", rackName: "Toronto Rack" },
    items: [
      { grade: "Regular", ltrs: 4_000 },
      { grade: "Diesel", ltrs: 6_000 },
    ],
  },
  {
    _id: "order-4",
    currentStatus: "Cancelled",
    supplier: { _id: "supplier-b", supplierName: "Lake Supply" },
    rack: { _id: "rack-b", rackName: "Ottawa Rack" },
    items: [{ grade: "Regular", ltrs: 20_000 }],
  },
];

describe("aggregateSupplierRackVolumes", () => {
  it("groups delivered litres by supplier and respects the grade selection", () => {
    const result = aggregateSupplierRackVolumes(
      orders,
      ["Regular"],
      "supplier",
      "delivered",
    );

    expect(result).toEqual([
      {
        id: "supplier-a",
        name: "North Supply",
        litres: 10_000,
        orderCount: 1,
        grades: { Regular: 10_000 },
      },
      {
        id: "supplier-b",
        name: "Lake Supply",
        litres: 4_000,
        orderCount: 1,
        grades: { Regular: 4_000 },
      },
    ]);
  });

  it("counts all non-cancelled orders for ordered volume", () => {
    const result = aggregateSupplierRackVolumes(
      orders,
      ["Regular", "Premium", "Diesel"],
      "supplier",
      "ordered",
    );

    expect(result[0]).toMatchObject({
      id: "supplier-a",
      litres: 20_000,
      orderCount: 2,
      grades: { Regular: 15_000, Premium: 2_000, Diesel: 3_000 },
    });
    expect(result[1]).toMatchObject({
      id: "supplier-b",
      litres: 10_000,
      orderCount: 1,
    });
  });

  it("can regroup the same filtered orders by rack", () => {
    const result = aggregateSupplierRackVolumes(
      orders,
      ["Regular", "Diesel"],
      "rack",
      "ordered",
    );

    expect(result).toEqual([
      {
        id: "rack-a",
        name: "Toronto Rack",
        litres: 20_000,
        orderCount: 2,
        grades: { Regular: 14_000, Diesel: 6_000 },
      },
      {
        id: "rack-b",
        name: "Ottawa Rack",
        litres: 8_000,
        orderCount: 1,
        grades: { Regular: 5_000, Diesel: 3_000 },
      },
    ]);
  });

  it("returns no entities when no grades are selected", () => {
    expect(
      aggregateSupplierRackVolumes(orders, [], "supplier", "delivered"),
    ).toEqual([]);
  });
});
