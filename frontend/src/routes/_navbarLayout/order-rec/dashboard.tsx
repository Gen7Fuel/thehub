import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { OrderCard } from "@/components/custom/ordercard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/_navbarLayout/order-rec/dashboard")({
  component: RouteComponent,
})

function RouteComponent() {
  const [orderRecs, setOrderRecs] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [weeks, setWeeks] = useState<string[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>("")

  // Dialog state
  const [viewCommentsOrderId, setViewCommentsOrderId] = useState<string | null>(null)
  const [addEditCommentOrderId, setAddEditCommentOrderId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [currentComments, setCurrentComments] = useState<{text:string,author:string,timestamp:string}[]>([])
  const [updateStatusOrderId, setUpdateStatusOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");


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
          const vendorsData = await vendorsRes.json();
        setVendors(vendorsData);
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
        setOrderRecs(recsData)
        setVendors(vendorsData)
        setStores(storesData)
        buildWeeks(recsData)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

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
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

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
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-left w-64 sticky left-0 top-0 z-30">
                  Store \ Vendor
                </th>
                {vendors.map(v=>(
                  <th key={v._id} className="border border-gray-300 px-2 py-1 bg-gray-100 text-center w-80 text-sm truncate sticky top-0 z-20" title={v.name}>
                    {v.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map(store=>(
                <tr key={store._id}>
                  <td className="border border-gray-300 px-2 py-1 font-semibold w-64 text-sm break-words bg-white sticky left-0 z-20">
                    {store.stationName}
                  </td>
                  {vendors.map(vendor=>{
                    const rec = lookup[store.stationName]?.[vendor._id]
                    console.log("rec:", rec);
                    return <td key={vendor._id} className="border border-gray-300 bg-white w-100 p-0 items-center">
                      {rec ? (
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
                          // onUpdateStatus={(status)=>fetch(`/api/order-rec/${rec._id}/status`, {method:"PUT", headers:{"Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("token")}`}, body:JSON.stringify({status})})}
                          onUpdateStatus={() => {
                              setUpdateStatusOrderId(rec._id);
                              setNewStatus(rec.currentStatus);
                          }}
                          lastPlacedOrder={vendor?.lastPlacedOrder || null}
                          vendor_order_frequency={vendor?.vendor_order_frequency ? Number(vendor.vendor_order_frequency) : undefined}
                          onViewOrder={(id)=>window.location.href=`/order-rec/${id}`}
                          onViewComments={(id)=>{
                            const recData = orderRecs.find(r=>r._id===id)
                            setCurrentComments(recData?.comments||[])
                            setViewCommentsOrderId(id)
                          }}
                          onAddEditComment={(id,lastComment)=>{
                            setCommentText(lastComment||"")
                            setAddEditCommentOrderId(id)
                          }}
                        />
                      ) : (
                        <div className="w-110 h-55 flex items-center justify-center rounded-2xl bg-gray-100 text-gray-500 text-sm">
                          No Orders
                        </div>
                      )}
                    </td>
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
