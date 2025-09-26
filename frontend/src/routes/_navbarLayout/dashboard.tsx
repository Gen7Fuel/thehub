import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";

export const Route = createFileRoute('/_navbarLayout/dashboard')({
  component: RouteComponent,
  loader: () => fetchData(),
})

function RouteComponent() {
  const [site, setSite] = useState(localStorage.getItem("location") || "");

  const { orderRecs } = Route.useLoaderData();

  return (
    <div className="pt-16 flex flex-col items-center">
      <LocationPicker
        setStationName={setSite}
        value="stationName"
        defaultValue={site}
      />
      <div className="mt-8 w-full max-w-3xl">
        <h2 className="text-xl font-bold mb-4">Order Recs</h2>
        {orderRecs && orderRecs.length > 0 ? (
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Site</th>
                <th className="border px-2 py-1">Vendor</th>
                <th className="border px-2 py-1">Created At</th>
                <th className="border px-2 py-1"># Categories</th>
                <th className="border px-2 py-1"># Items</th>
              </tr>
            </thead>
            <tbody>
              {orderRecs.map((rec: any, idx: number) => (
                <tr key={rec._id || idx}>
                  <td className="border px-2 py-1">{rec.site}</td>
                  <td className="border px-2 py-1">{rec.vendor}</td>
                  <td className="border px-2 py-1">
                    {rec.createdAt ? new Date(rec.createdAt).toLocaleString() : ""}
                  </td>
                  <td className="border px-2 py-1">{rec.categories?.length ?? 0}</td>
                  <td className="border px-2 py-1">
                    {rec.categories?.reduce((sum: number, cat: any) => sum + (cat.items?.length ?? 0), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500 mt-4">No order recs found for this range.</div>
        )}
      </div>
    </div>
  );
}

const fetchData = async () => {
  const params = new URLSearchParams({
    site: "Rankin",
    startDate: "2025-09-21",
    endDate: "2025-09-27",
  });

  const response = { 
    orderRecs: await fetch(`/api/order-rec/range?${params}`).then(res => res.json()),
    cycleCounts: [],
    audits: [],
    sales: [],
    writeOffs: [],
  };

  return response;
}