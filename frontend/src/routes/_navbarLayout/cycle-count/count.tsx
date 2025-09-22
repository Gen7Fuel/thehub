import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";
import TableWithInputs from "@/components/custom/TableWithInputs";

export const Route = createFileRoute('/_navbarLayout/cycle-count/count')({
  component: RouteComponent,
})

function RouteComponent() {
  const location = localStorage.getItem("location") || "";
  const [stationName, setStationName] = useState(location);
  const [items, setItems] = useState<any[]>([]);
  const [flaggedItems, setFlaggedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Track FOH and BOH values for each item
  const [counts, setCounts] = useState<{ [id: string]: { foh: string; boh: string } }>({});

  useEffect(() => {
    if (!stationName) return;
    setLoading(true);
    setError("");
    fetch(`/api/cycle-count/daily-items?site=${encodeURIComponent(stationName)}&chunkSize=20`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setItems(data.items || []);
        setFlaggedItems(data.flaggedItems || []);
        if (!data.items) setError(data.message || "Failed to fetch items");
        // Initialize counts state for each item (flagged + daily)
        const initialCounts: { [id: string]: { foh: string; boh: string } } = {};
        const allItems = [...(data.flaggedItems || []), ...(data.items || [])];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        allItems.forEach((item: any) => {
          const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
          const isToday =
            updatedAt &&
            updatedAt >= today &&
            updatedAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);

          initialCounts[item._id] = {
            foh:
              isToday && item.foh != null && item.foh !== 0
                ? String(item.foh)
                : "",
            boh:
              isToday && item.boh != null && item.boh !== 0
                ? String(item.boh)
                : ""
          };
        });
        setCounts(initialCounts);
      })
      .catch(() => setError("Failed to fetch items"))
      .finally(() => setLoading(false));
  }, [stationName]);

  const handleInputChange = (id: string, field: "foh" | "boh", value: string) => {
    setCounts(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const allItems = [...flaggedItems, ...items];
      const payload = allItems
        .map(item => ({
          _id: item._id,
          foh: counts[item._id]?.foh ?? "",
          boh: counts[item._id]?.boh ?? ""
        }))
        .filter(entry => entry.foh !== "" || entry.boh !== "");

      if (payload.length === 0) {
        setSaving(false);
        alert("No counts to save.");
        return;
      }

      const res = await fetch("/api/cycle-count/save-counts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ items: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save counts");
      alert("Counts saved!");

      // Re-fetch the latest flagged and daily items from the backend
      setLoading(true);
      fetch(`/api/cycle-count/daily-items?site=${encodeURIComponent(stationName)}&chunkSize=20`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          setItems(data.items || []);
          setFlaggedItems(data.flaggedItems || []);
          // Re-initialize counts for the new items
          const initialCounts: { [id: string]: { foh: string; boh: string } } = {};
          const allItems = [...(data.flaggedItems || []), ...(data.items || [])];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          allItems.forEach((item: any) => {
            const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
            const isToday =
              updatedAt &&
              updatedAt >= today &&
              updatedAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);

            initialCounts[item._id] = {
              foh:
                isToday && item.foh != null && item.foh !== 0
                  ? String(item.foh)
                  : "",
              boh:
                isToday && item.boh != null && item.boh !== 0
                  ? String(item.boh)
                  : ""
            };
          });
          setCounts(initialCounts);
        })
        .catch(() => setError("Failed to fetch items"))
        .finally(() => setLoading(false));

    } catch (err: any) {
      setError(err.message || "Failed to save counts");
      setSaving(false);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto mt-12">
      <div className="mb-6">
        <LocationPicker
          setStationName={setStationName}
          value="stationName"
          disabled
          defaultValue={location}
        />
      </div>
      <button
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Count"}
      </button>
      {flaggedItems.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2 text-red-700">Flagged Items</h2>
          <TableWithInputs
            items={flaggedItems}
            counts={counts}
            onInputChange={handleInputChange}
            tableClassName=""
            headerClassName="bg-red-100"
            rowClassName="bg-red-50"
          />
        </div>
      )}
      <h2 className="text-xl font-bold mb-4">Today's Cycle Count Items</h2>
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {items.length > 0 && (
        <>
          <TableWithInputs
            items={items}
            counts={counts}
            onInputChange={handleInputChange}
            tableClassName=""
            headerClassName="bg-gray-100"
            rowClassName=""
          />
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Count"}
          </button>
        </>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="text-gray-500 mt-4">No items found for this site.</div>
      )}
    </div>
  );
}