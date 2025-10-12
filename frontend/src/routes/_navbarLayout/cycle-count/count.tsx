import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { LocationPicker } from "@/components/custom/locationPicker";
import TableWithInputs from "@/components/custom/TableWithInputs";
import { DateTime } from 'luxon';
import { useRef } from "react";
import { getSocket } from "@/lib/websocket";


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


  const midnightTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any previous timeout
    if (midnightTimeout.current) clearTimeout(midnightTimeout.current);

    // Calculate ms until next local midnight
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();

    // Set timeout to refresh at local midnight
    midnightTimeout.current = setTimeout(() => {
      // Re-fetch items (or reload page if you prefer)
      window.location.reload(); // or call your fetch logic directly
    }, msUntilMidnight);

    // Cleanup on unmount
    return () => {
      if (midnightTimeout.current) clearTimeout(midnightTimeout.current);
    };
  }, [stationName]);

  // useEffect(() => {
  //   // Handler for real-time updates
  //   const handleUpdate = (data: { site: string }) => {
  //     if (!data.site || data.site === stationName) {
  //       // Re-fetch items for this station
  //       setLoading(true);
  //       setError("");
  //       fetch(`/api/cycle-count/daily-items?site=${encodeURIComponent(stationName)}&chunkSize=20&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, {
  //         headers: {
  //           Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  //         },
  //       })
  //         .then(res => res.json())
  //         .then(data => {
  //           setItems(data.items || []);
  //           setFlaggedItems(data.flaggedItems || []);
  //           // ...re-initialize counts as in your existing code...
  //           const initialCounts: { [id: string]: { foh: string; boh: string } } = {};
  //           const allItems = [...(data.flaggedItems || []), ...(data.items || [])];
  //           const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  //           const now = DateTime.now().setZone(timezone);
  //           const todayStart = now.startOf('day');
  //           const tomorrowStart = todayStart.plus({ days: 1 });

  //           allItems.forEach((item: any) => {
  //             const updatedAt = item.updatedAt ? DateTime.fromISO(item.updatedAt).setZone(timezone) : null;
  //             const isToday =
  //               updatedAt &&
  //               updatedAt >= todayStart &&
  //               updatedAt < tomorrowStart;

  //             initialCounts[item._id] = {
  //               foh:
  //                 isToday && item.foh != null
  //                   ? String(item.foh)
  //                   : "",
  //               boh:
  //                 isToday && item.boh != null
  //                   ? String(item.boh)
  //                   : ""
  //             };
  //           });
  //           setCounts(initialCounts);
  //         })
  //         .catch(() => setError("Failed to fetch items"))
  //         .finally(() => setLoading(false));
  //     }
  //   };

  //   socket.on("cycle-count-updated", handleUpdate);
  //   return () => {
  //     socket.off("cycle-count-updated", handleUpdate);
  //   };
  // }, [stationName]);

  const handleInputBlur = (id: string, field: "foh" | "boh", value: string) => {
    console.log("📤 SENDING cycle-count-field-updated:");
    console.log("  - Item ID:", id);
    console.log("  - Field:", field);
    console.log("  - Value:", value);
    
    const socket = getSocket();
    console.log("📤 Using socket:", socket.id || "not connected");
    
    // Save to backend
    fetch("/api/cycle-count/save-item", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({ _id: id, field, value }),
    });

    // Emit websocket event for real-time update
    socket.emit("cycle-count-field-updated", { itemId: id, field, value });
    console.log("📤 Event emitted via WebSocket");
  };

  // const handleInputBlur = (id: string, field: "foh" | "boh", value: string) => {
  //   const socket = getSocket();
  //   // Save to backend
  //   fetch("/api/cycle-count/save-item", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  //     },
  //     body: JSON.stringify({ _id: id, field, value }),
  //   });

  //   // Emit websocket event for real-time update
  //   socket.emit("cycle-count-field-updated", { itemId: id, field, value });
  // };

  interface CycleCountFieldUpdate {
    itemId: string;
    field: "foh" | "boh";
    value: string;
  }

  // Listen for updates from other clients
  useEffect(() => {
    console.log("🔌 Setting up WebSocket listeners in count component");
    
    const socket = getSocket();
    console.log("🔌 Got socket in count component:", socket.id || "not connected");
    
    function updateField({ itemId, field, value }: CycleCountFieldUpdate) {
      console.log("📨 RECEIVED cycle-count-field-updated:");
      console.log("  - Item ID:", itemId);
      console.log("  - Field:", field);
      console.log("  - Value:", value);
      
      setCounts(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          [field]: value
        }
      }));
      console.log("📨 Updated local state");
    }
    
    socket.on("cycle-count-field-updated", updateField);
    console.log("🔌 Listener registered for cycle-count-field-updated");
    
    return () => {
      console.log("🔌 Cleaning up WebSocket listeners");
      socket.off("cycle-count-field-updated", updateField);
    };
  }, []);
  // useEffect(() => {
  //   const socket = getSocket();
  //   function updateField({ itemId, field, value }: CycleCountFieldUpdate) {
  //     setCounts(prev => ({
  //       ...prev,
  //       [itemId]: {
  //         ...prev[itemId],
  //         [field]: value
  //       }
  //     }));
  //   }
  //   socket.on("cycle-count-field-updated", updateField);
  //   return () => {
  //     socket.off("cycle-count-field-updated", updateField);
  //   };
  // }, []);

  useEffect(() => {
    if (!stationName) return;
    setLoading(true);
    setError("");
    fetch(`/api/cycle-count/daily-items?site=${encodeURIComponent(stationName)}&chunkSize=20&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, {
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
        // const today = new Date();
        // today.setHours(0, 0, 0, 0);
        // allItems.forEach((item: any) => {
        //   const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
        //   const isToday =
        //     updatedAt &&
        //     updatedAt >= today &&
        //     updatedAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);

        //   initialCounts[item._id] = {
        //     foh:
        //       isToday && item.foh != null && item.foh !== 0
        //         ? String(item.foh)
        //         : "",
        //     boh:
        //       isToday && item.boh != null && item.boh !== 0
        //         ? String(item.boh)
        //         : ""
        //   };
        // });
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = DateTime.now().setZone(timezone);
        const todayStart = now.startOf('day');
        const tomorrowStart = todayStart.plus({ days: 1 });

        allItems.forEach((item: any) => {
          const updatedAt = item.updatedAt ? DateTime.fromISO(item.updatedAt).setZone(timezone) : null;
          const isToday =
            updatedAt &&
            updatedAt >= todayStart &&
            updatedAt < tomorrowStart;

          initialCounts[item._id] = {
            foh:
              isToday && item.foh != null
                ? String(item.foh)
                : "",
            boh:
              isToday && item.boh != null
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
          // const today = new Date();
          // today.setHours(0, 0, 0, 0);
          // allItems.forEach((item: any) => {
          //   const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
          //   const isToday =
          //     updatedAt &&
          //     updatedAt >= today &&
          //     updatedAt < new Date(today.getTime() + 24 * 60 * 60 * 1000);

          //   initialCounts[item._id] = {
          //     foh:
          //       isToday && item.foh != null && item.foh !== 0
          //         ? String(item.foh)
          //         : "",
          //     boh:
          //       isToday && item.boh != null && item.boh !== 0
          //         ? String(item.boh)
          //         : ""
          //   };
          // });
          const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const now = DateTime.now().setZone(timezone);
          const todayStart = now.startOf('day');
          const tomorrowStart = todayStart.plus({ days: 1 });

          allItems.forEach((item: any) => {
            const updatedAt = item.updatedAt ? DateTime.fromISO(item.updatedAt).setZone(timezone) : null;
            const isToday =
              updatedAt &&
              updatedAt >= todayStart &&
              updatedAt < tomorrowStart;

            initialCounts[item._id] = {
              foh:
                isToday && item.foh != null
                  ? String(item.foh)
                  : "",
              boh:
                isToday && item.boh != null
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

  const access = JSON.parse(localStorage.getItem('access') || '{}')

  return (
    <div className="max-w-3xl mx-auto mt-12">
      <div className="mb-6">
        <LocationPicker
          setStationName={setStationName}
          value="stationName"
          {...(!access.component_cycle_count_count_location_filter ? { disabled: true } : {})}
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
            onInputBlur={handleInputBlur}
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
            onInputBlur={handleInputBlur}
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