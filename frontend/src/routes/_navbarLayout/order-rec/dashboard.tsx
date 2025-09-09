import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute('/_navbarLayout/order-rec/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  const [orderRecs, setOrderRecs] = useState<any[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderRecs = async () => {
      setLoading(true);
      const res = await fetch("/api/order-rec", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrderRecs(data);
      }
      setLoading(false);
    };
    fetchOrderRecs();
  }, []);

  // Categorize order recs
  const created: any[] = [];
  const completed: any[] = [];
  const orderPlaced: any[] = [];
  const delivered: any[] = [];
  let lastOrdered: any | null = null;

  orderRecs.forEach(rec => {
    if (rec.delivered) {
      delivered.push(rec);
    } else if (rec.orderPlaced) {
      orderPlaced.push(rec);
    } else if (rec.completed) {
      completed.push(rec);
    } else {
      created.push(rec);
    }
  });

  // Find the most recently delivered/orderPlaced/completed rec
  const allOrdered = [...delivered, ...orderPlaced, ...completed].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
  if (allOrdered.length > 0) lastOrdered = allOrdered[0];

  const renderCards = (recs: any[]) =>
    recs.map(rec => (
      <Card key={rec._id} className="mb-4 p-4 shadow rounded bg-white">
        <div className="font-bold">{rec.filename || rec.site}</div>
        <div className="text-xs text-muted-foreground">{rec.site}</div>
        <div className="text-xs">{new Date(rec.createdAt).toLocaleString()}</div>
      </Card>
    ));

  return (
    <div className="grid grid-cols-5 gap-4">
      <div>
        <h2 className="font-semibold mb-2">Created</h2>
        {renderCards(created)}
      </div>
      <div>
        <h2 className="font-semibold mb-2">Completed</h2>
        {renderCards(completed)}
      </div>
      <div>
        <h2 className="font-semibold mb-2">Order Placed</h2>
        {renderCards(orderPlaced)}
      </div>
      <div>
        <h2 className="font-semibold mb-2">Delivered</h2>
        {renderCards(delivered)}
      </div>
      <div>
        <h2 className="font-semibold mb-2">Last Ordered</h2>
        {lastOrdered && renderCards([lastOrdered])}
      </div>
    </div>
  );
}