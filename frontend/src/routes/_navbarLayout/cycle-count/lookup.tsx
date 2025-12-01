import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/cycle-count/lookup')({
  component: RouteComponent,
})

function RouteComponent() {
  const [upc, setUpc] = useState("");
  const { user } = useAuth()
  const [site, setSite] = useState(user?.location || "");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const params = new URLSearchParams({ upc_barcode: upc, site });
      const res = await fetch(`/api/cycle-count/lookup?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(`token`)}`,
          "X-Required-Permission": "cycleCount.lookup",
        },
      });

      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Error fetching cycle count lookup:", err);
      setResult({ error: "Failed to fetch data." });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-md mx-auto my-8 p-4 border rounded">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Enter UPC"
          value={upc}
          onChange={e => setUpc(e.target.value)}
          className="border px-2 py-1 rounded"
          required
        />
        <LocationPicker
          setStationName={setSite}
          value="stationName"
          defaultValue={site}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Searching..." : "Lookup"}
        </button>
      </form>

      {result && !result.error && (
        <div className="mt-4 bg-gray-100 p-2 rounded text-sm">
          <div><strong>Name:</strong> {result.name}</div>
          <div><strong>Category:</strong> {result.category}</div>
          <div><strong>FOH:</strong> {result.foh}</div>
          <div><strong>BOH:</strong> {result.boh}</div>
          <div><strong>Updated At:</strong> {result.updatedAt ? new Date(result.updatedAt).toLocaleString() : ""}</div>
        </div>
      )}
      {result?.error && (
        <div className="mt-4 text-red-600">{result.error}</div>
      )}
    </div>
  );
}