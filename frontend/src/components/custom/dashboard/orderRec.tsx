import React from "react";

interface OrderRec {
  id: number;
  orderNumber: string;
  supplier: string;
  date: string;
  status: string;
}

const demoOrderRecs: OrderRec[] = [
  { id: 1, orderNumber: "ORD-1001", supplier: "Acme Corp", date: "2025-09-24", status: "Received" },
  { id: 2, orderNumber: "ORD-1002", supplier: "Beta Supplies", date: "2025-09-23", status: "Pending" },
  { id: 3, orderNumber: "ORD-1003", supplier: "Gamma Goods", date: "2025-09-22", status: "Received" },
];

const OrderRecList: React.FC = () => (
  <div className="pt-16 flex flex-col items-center">
    <h2 className="text-xl font-bold mb-4">Order Receipts</h2>
    <table className="min-w-full border text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border px-2 py-1">Order #</th>
          <th className="border px-2 py-1">Supplier</th>
          <th className="border px-2 py-1">Date</th>
          <th className="border px-2 py-1">Status</th>
        </tr>
      </thead>
      <tbody>
        {demoOrderRecs.map(rec => (
          <tr key={rec.id}>
            <td className="border px-2 py-1">{rec.orderNumber}</td>
            <td className="border px-2 py-1">{rec.supplier}</td>
            <td className="border px-2 py-1">{rec.date}</td>
            <td className="border px-2 py-1">{rec.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default OrderRecList;