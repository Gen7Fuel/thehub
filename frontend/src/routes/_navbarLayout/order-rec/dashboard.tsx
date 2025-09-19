import { createFileRoute } from "@tanstack/react-router"
import React, { useEffect, useState } from "react"
import { OrderCard } from "@/components/custom/ordercard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { io,Socket } from "socket.io-client"

export const Route = createFileRoute("/_navbarLayout/order-rec/dashboard")({
  component: RouteComponent,
})

const token = localStorage.getItem("token");

export const socket: Socket = io("http://backend:5000", {
  auth: { token }, // this will send the JWT during handshake
  // transports: ["websocket"], // force WS (optional but good for dev)
});

type Vendor = {
  _id: string;
  name: string;
  lastPlacedOrder?: string;
  vendor_order_frequency?: number | string;
  location: string;
};

function RouteComponent() {
  const [orderRecs, setOrderRecs] = useState<any[]>([])
  // const [vendors, setVendors] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weeks, setWeeks] = useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>("")
  const [uniquevendors, setUniqueVendors] = useState<Record<string, Vendor[]>>({});


  // Dialog state
  const [viewCommentsOrderId, setViewCommentsOrderId] = useState<string | null>(null)
  const [addEditCommentOrderId, setAddEditCommentOrderId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [currentComments, setCurrentComments] = useState<{text:string,author:string,timestamp:string}[]>([])
  const [updateStatusOrderId, setUpdateStatusOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

    const allVendors = React.useMemo(
    () =>
      Array.from(
        new Set(
          Object.keys(uniquevendors).map(key => key.split("::")[0])
        )
      ),
    [uniquevendors]
  );

  const handleComment = async (id: string, text: string) => {
    try {
      const res = await fetch(`/api/order-rec/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          text,
          author: localStorage.getItem("initials"),
        }),
      })

      if (!res.ok) throw new Error("Failed to add comment")
      const updated = await res.json()
      setOrderRecs((prev) => prev.map((rec) => (rec._id === id ? updated : rec)))
    } catch (err) {
      console.error("Error saving comment:", err)
    }
  }

  const handleUpdateStatus = async () => {
    if (!updateStatusOrderId || !newStatus) return;
    try {
      const res = await fetch(`/api/order-rec/${updateStatusOrderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const updated = await res.json();
      setOrderRecs((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      const vendorsRes = await fetch("/api/vendors", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (vendorsRes.ok) {
        const vendorsData: Vendor[] = await vendorsRes.json();

        // Rebuild grouped vendors for table display
        const grouped = vendorsData.reduce((acc: Record<string, Vendor[]>, v: Vendor) => {
          const key = `${v.name.trim().toLowerCase()}::${v.location}`; 
          if (!acc[key]) acc[key] = [];
          acc[key].push(v);
          return acc;
        }, {});

        setUniqueVendors(grouped);
      }
      
      setUpdateStatusOrderId(null);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const getPercentile = (lastPlaced: string | Date | undefined, freqWeeks: number | undefined) => {
    if (!lastPlaced || !freqWeeks) return 0;

    const lastDate = new Date(lastPlaced);
    const freqDays = freqWeeks * 7;
    const now = new Date();

    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const percentile = Math.min(100, Math.max(0, (diffDays / freqDays) * 100));

    return percentile;
  };

  const getRedColor = (
    percentile: number, 
    lastPlacedOrder?: string, 
    currentStatusTimestamp?: string, 
    currentStatus?: string
  ) => {
    // Case 1: last placed order timestamp equals current status "Placed" timestamp → neutral grey
    if (!lastPlacedOrder || (currentStatus === "Placed" && currentStatusTimestamp === lastPlacedOrder)) {
      return "#d1d5db"; // Tailwind gray-300
    }

    // Case 2: percentile-based red
    const intensity = Math.floor((percentile / 100) * 255);
    return `rgb(255, ${255 - intensity}, ${255 - intensity})`; // red gradient
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "Created":
        return "#fef3c7"; // light yellow
      case "Placed":
        return "#bfdbfe"; // light blue
      case "Completed":
        return "#fcd34d"; // light orange/golden
      case "Delivered":
        return "#bbf7d0"; // light green
      case "Invoice Received":
        return "#e0e7ff"; // light purple/indigo
      default:
        return "#f3f4f6"; // default light grey
    }
  };

  const formatVendorName = (name: string) => {
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  };


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [recsRes, vendorsRes, storesRes] = await Promise.all([
        fetch("/api/order-rec", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
        fetch("/api/vendors", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
        fetch("/api/locations", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
      ])
      if (recsRes.ok && vendorsRes.ok && storesRes.ok) {
        const recsData = await recsRes.json()
        const vendorsData = await vendorsRes.json()
        const storesData = await storesRes.json()
        
        // setVendors(vendorsData)

        const grouped = vendorsData.reduce((acc: Record<string, Vendor[]>, v: Vendor) => {
          const key = `${v.name.trim().toLowerCase()}::${v.location}`; 
          if (!acc[key]) acc[key] = [];
          acc[key].push(v);
          return acc;
        }, {});


        setUniqueVendors(grouped);

        setOrderRecs(recsData)
        setStores(storesData)
        buildWeeks(recsData)
      }
      setLoading(false)
    }
    fetchData()

    // Setup SSE for real-time order rec updates
    // const evtSource = new EventSource("/api/order-rec/stream");

    // evtSource.addEventListener("orderUpdated", (event: MessageEvent) => {
    //   const updatedOrder = JSON.parse(event.data);
    //   setOrderRecs((prev) =>
    //     prev.map((r) => (r._id === updatedOrder._id ? updatedOrder : r))
    //   );
    // });

    // evtSource.addEventListener("orderCreated", (event: MessageEvent) => {
    //   const newOrder = JSON.parse(event.data);
    //   setOrderRecs((prev) => [...prev, newOrder]);
    // });

    // evtSource.addEventListener("orderDeleted", (event: MessageEvent) => {
    //   const deletedOrder = JSON.parse(event.data);
    //   setOrderRecs((prev) => prev.filter((r) => r._id !== deletedOrder._id));
    // });

    // // Cleanup on unmount
    // return () => {
    //   evtSource.close();
    // };

    // WebSocket listeners
    socket.on("connect", () => {
      console.log("Connected to WS server", socket.id);
    });

    socket.on("orderUpdated", (updatedOrder:any) => {
      console.log("Order updated:", updatedOrder);
      setOrderRecs((prev) =>
        prev.map((r) => (r._id === updatedOrder._id ? updatedOrder : r))
      );
    });

    socket.on("orderCreated", (newOrder:any) => {
      console.log("Order created:", newOrder);
      setOrderRecs((prev) => [...prev, newOrder]);
    });

    socket.on("orderDeleted", (deletedOrder:any) => {
      console.log("Order deleted:", deletedOrder);
      setOrderRecs((prev) => prev.filter((r) => r._id !== deletedOrder._id));
    });

    socket.on("connect_error", (err:any) => {
      console.error("WS connection error:", err.message);
    });

    // Cleanup on unmount
    return () => {
      socket.off("orderUpdated");
      socket.off("orderCreated");
      socket.off("orderDeleted");
      socket.disconnect();
    };
  }, []);

  const buildWeeks = (data: any[]) => {
    const sundays = new Set<string>()
    data.forEach((rec) => {
      const created = new Date(rec.createdAt)
      const sunday = getWeekStart(created)
      sundays.add(sunday.toISOString().split("T")[0])
    })
    const weekList = Array.from(sundays).sort((a,b)=>new Date(b).getTime()-new Date(a).getTime())
    setWeeks(weekList)
    if (weekList.length>0) setSelectedWeek(weekList[0])
  }

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diff = d.getDate() - (day === 0 ? 6 : day - 1); // shift so Monday is start
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };


  const filteredOrders = orderRecs.filter((rec) => {
    if (!selectedWeek) return true
    const created = new Date(rec.createdAt)
    const weekStart = new Date(selectedWeek)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return created>=weekStart && created<=weekEnd
  })

  const lookup: Record<string, Record<string, any>> = {}
  filteredOrders.forEach((rec) => {
    const storeName = rec.site
    const vendorId = typeof rec.vendor === "object" ? rec.vendor._id : rec.vendor
    if (!lookup[storeName]) lookup[storeName]={}
    lookup[storeName][vendorId]=rec
  })

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <div className="flex items-center space-x-4">
        <label className="font-semibold">Select Week:</label>
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a week"/>
          </SelectTrigger>
          <SelectContent>
            {weeks.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="relative max-h-[80vh]">
        <div className="overflow-x-auto overflow-y-auto max-h-[80vh] max-w-[calc(100vw-100px)] border rounded-lg">
          <table className="border-collapse w-full">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-left w-64 sticky left-0 top-0 z-30">
                  Store \ Vendor
                </th>
                {allVendors.map(vendorName => (
                  <th
                    key={vendorName}
                    className="border border-gray-300 px-4 py-3 bg-gray-100 text-center font-medium text-gray-800 text-sm truncate sticky top-0 z-20 shadow-sm"
                    title={vendorName}
                  >
                    {formatVendorName(vendorName)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {stores
                .filter(
                  store =>
                    // store.stationName !== "Sarnia" &&
                    store.stationName !== "Jocko Point"
                )
                .map(store => (
                  <tr key={store._id}>
                    {/* Store name column */}
                    <td className="border border-gray-300 px-4 py-2 font-semibold text-gray-800 bg-gray-50 sticky left-0 z-20 shadow-sm">
                      {store.stationName}
                    </td>

                    {/* Vendor columns */}
                    {allVendors.map(vendorName => {
                      // Find vendor(s) tied to this store + vendor name
                      const vendorObjs =
                        uniquevendors[`${vendorName}::${store.stationName}`];

                      if (!vendorObjs) {
                        return (
                          <td
                            key={vendorName}
                            className="border border-gray-300 bg-white w-80 p-0 items-center"
                          >
                            <div className="w-80 h-40 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-500 text-sm">
                              Vendor Not Associated
                            </div>
                          </td>
                        );
                      }

                      // Vendor meta (first object is fine since grouped)
                      const vendorMeta = vendorObjs[0];

                      // Week range
                      const weekStart = new Date(selectedWeek);
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekEnd.getDate() + 6);

                      // All orders between this store + vendor historically
                      const allOrders = orderRecs.filter(
                        r =>
                          r.site === store.stationName &&
                          vendorObjs.some(
                            vo =>
                              vo._id ===
                              (typeof r.vendor === "object" ? r.vendor._id : r.vendor)
                          )
                      );

                      // Orders in the selected week
                      const rec = allOrders.find(
                        r =>
                          new Date(r.createdAt) >= weekStart &&
                          new Date(r.createdAt) <= weekEnd
                      );

                      return (
                        <td
                          key={vendorName}
                          className="border border-gray-300 bg-white w-80 p-0 items-center"
                        >
                          {allOrders.length === 0 ? (
                            // Case 1: no orders at all
                            <div className="w-80 h-40 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-500 text-sm">
                              Vendor Not Associated
                            </div>
                          ) : rec ? (
                            // Case 2: order exists this week → render normal card
                            <OrderCard
                              key={rec._id}
                              id={rec._id}
                              filename={rec.filename}
                              site={rec.site}
                              currentStatus={rec.currentStatus}
                              statusHistory={rec.statusHistory}
                              comments={rec.comments}
                              getPercentile={getPercentile}
                              getRedColor={getRedColor}
                              getStatusColor={getStatusColor}
                              onUpdateStatus={() => {
                                setUpdateStatusOrderId(rec._id);
                                setNewStatus(rec.currentStatus);
                              }}
                              lastPlacedOrder={vendorMeta?.lastPlacedOrder || undefined}
                              vendor_order_frequency={
                                vendorMeta?.vendor_order_frequency
                                  ? Number(vendorMeta.vendor_order_frequency)
                                  : undefined
                              }
                              onViewOrder={id => (window.location.href = `/order-rec/${id}`)}
                              onViewComments={id => {
                                const recData = orderRecs.find(r => r._id === id);
                                setCurrentComments(recData?.comments || []);
                                setViewCommentsOrderId(id);
                              }}
                              onAddEditComment={(id, lastComment) => {
                                setCommentText(lastComment || "");
                                setAddEditCommentOrderId(id);
                              }}
                            />
                          ) : (
                            // Case 3: orders in history but none this week
                            <Card className="w-80 overflow-hidden rounded-2xl border border-gray-300 shadow-sm">
                              {/* Top Section */}
                              <div className="flex flex-col p-4 h-full justify-between bg-gray-50">
                                <div className="text-sm font-semibold text-gray-800 text-center">
                                  No Orders Created This Week
                                </div>
                              </div>

                              {/* Bottom Section */}
                              <div
                                className="flex flex-col items-center justify-center p-2 bg-gray-100"
                                style={{
                                  backgroundColor:
                                    getRedColor?.(
                                      getPercentile?.(
                                        vendorMeta.lastPlacedOrder,
                                        vendorMeta.vendor_order_frequency
                                          ? Number(vendorMeta.vendor_order_frequency)
                                          : undefined
                                      ) ?? 0,
                                      vendorMeta.lastPlacedOrder
                                    ) ?? "#f3f4f6",
                                }}
                              >
                                <div className="text-sm text-gray-700 font-semibold mt-1">
                                  {vendorMeta?.lastPlacedOrder
                                    ? new Date(
                                        vendorMeta.lastPlacedOrder
                                      ).toLocaleString("en-CA", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "No record for previous order placed"}
                                </div>
                              </div>
                            </Card>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>

        </div>
      </div>

      {/* View Comments Dialog */}
      <Dialog open={!!viewCommentsOrderId} onOpenChange={()=>setViewCommentsOrderId(null)}>
        <DialogContent className="w-[400px] max-w-full">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto mt-2">
            {currentComments.length>0 ? (
              currentComments.map((c,idx)=>(
                <div key={idx} className="text-sm text-gray-700">
                  <span className="text-xs text-gray-400 mr-1">
                    ({new Date(c.timestamp).toLocaleString("en-US",{month:"short",day:"numeric"})})
                  </span>
                  <span className="font-medium">{c.author}:</span> {c.text}
                </div>
              ))
            ):(
              <div className="text-gray-400 text-sm">No comments yet</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={()=>setViewCommentsOrderId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Comment Dialog */}
      <Dialog open={!!addEditCommentOrderId} onOpenChange={() => setAddEditCommentOrderId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>

          <Input
            // value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Enter your comment..."
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEditCommentOrderId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (addEditCommentOrderId && commentText.trim()) {
                  handleComment(addEditCommentOrderId, commentText.trim())
                  setCommentText("") // Clear input after adding
                  setAddEditCommentOrderId(null)
                }
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          {/* Status Update Dialog */}
      <Dialog open={!!updateStatusOrderId} onOpenChange={() => setUpdateStatusOrderId(null)}>
        <DialogContent className="w-[350px] max-w-full">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <span className="font-medium">Current Status: </span>
              <span>{orderRecs.find((r) => r._id === updateStatusOrderId)?.currentStatus}</span>
            </div>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {["Created", "Placed", "Completed", "Delivered", "Invoice Received"]
                  .filter(
                    (s) =>
                      s !== orderRecs.find((r) => r._id === updateStatusOrderId)?.currentStatus
                  )
                  .map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusOrderId(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Comments Dialog */}
      <Dialog open={!!viewCommentsOrderId} onOpenChange={() => setViewCommentsOrderId(null)}>
        <DialogContent className="w-[400px] max-w-full">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto mt-2">
            {currentComments.length > 0 ? (
              currentComments.map((c, idx) => (
                <div key={idx} className="text-sm text-gray-700">
                  <span className="text-xs text-gray-400 mr-1">
                    ({new Date(c.timestamp).toLocaleString("en-US", { month: "short", day: "numeric" })})
                  </span>
                  <span className="font-medium">{c.author}:</span> {c.text}
                </div>
              ))
            ) : (
              <div className="text-gray-400 text-sm">No comments yet</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setViewCommentsOrderId(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
