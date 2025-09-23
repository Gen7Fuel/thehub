import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquareText, MessageSquarePlus, Eye, RefreshCcw  } from 'lucide-react'

interface OrderCardProps {
  id: string
  filename?: string
  site?: string
  currentStatus?: string
  statusHistory: { status: string; timestamp: string }[];
  comments?: { text: string; author: string; timestamp: string }[]
  onUpdateStatus: () => void
  onViewOrder?: (id: string) => void
  onViewComments?: (id: string) => void
  onAddEditComment?: (id: string, lastComment?: string) => void
  getRedColor?: ( percentile: number, lastPlacedOrder?: string, currentStatusTimestamp?: string, currentStatus?: string) => string
  getPercentile?: (lastPlaced: string | undefined, freqWeeks: number | undefined) => number
  getStatusColor?: (status?: string) => string
  lastPlacedOrder?: string 
  vendor_order_frequency?: number 
  empty?: boolean
}

export function OrderCard({
  id,
  // filename,
  // site,
  currentStatus,
  statusHistory,
  comments,
  onUpdateStatus,
  onViewOrder,
  onViewComments,
  onAddEditComment,
  getRedColor,
  getPercentile,
  getStatusColor,
  lastPlacedOrder,
  vendor_order_frequency,
  // empty,
}: OrderCardProps) {
  const lastComment = comments && comments.length > 0 ? comments[comments.length - 1] : null

  return (
    <Card className="w-80 overflow-hidden rounded-2xl border border-gray-300 shadow-sm gap-0 py-0">
    
    {/* <Card className="w-110 grid grid-cols-[70%_30%] overflow-hidden rounded-2xl border border-gray-300 shadow-sm gap-0 py-0"> */}
      {/* Left panel */}
      <div className="flex flex-col p-4 h-full justify-between" style={{
          backgroundColor: getStatusColor?.(currentStatus?? "Created") ?? "#f3f4f6"
        }}>
        {/* Top: filename & status */}
        <div>
          {/* <div className="font-semibold text-base break-words line-clamp-2" title={filename}>
            {filename}
          </div> */}
          <div className="font-semibold text-base text-gray-800 mt-1">
            Status: {currentStatus || "Created"}
          </div>
          {statusHistory && (
            <div className="text-base text-gray-600 mt-1">
              {(() => {
                const entry = Array.isArray(statusHistory) ? statusHistory.find(s => s.status === currentStatus) : null;
                return entry
                  ? new Date(entry.timestamp).toLocaleString("en-CA", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "—";
              })()}
            </div>
          )}
        </div>

        {/* Middle: View button + Update Status button */}
        <div className="flex gap-2 mt-2">
          {/* View Order */}
          <Button
            className="flex-1 py-1 px-2 text-sm rounded-md 
                      bg-slate-600 text-white hover:bg-slate-700 
                      border border-slate-600 shadow-sm"
            onClick={() => onViewOrder?.(id)}
          >
            {/* View Order */}
            <Eye className="w-4 h-4" />
          </Button>

          {/* Update Status */}
          <Button
            className="flex-1 py-1 px-2 text-sm rounded-md 
                      bg-indigo-500 text-white hover:bg-indigo-600 
                      border border-indigo-500 shadow-sm"
            onClick={() => onUpdateStatus?.()}
          >
            {/* Update Status */}
            <RefreshCcw className="w-4 h-4" />
          </Button>
        {/* </div> */}


        {/* Bottom section: View/Add Comment */}
        {/* <div className="flex gap-2 mt-2">  */}
          {comments && comments.length > 0 && ( 
            <Button className="flex-1 py-1 px-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-md" 
              onClick={() => onViewComments?.(id)} 
            > 
              {/* View Comments ({comments.length})  */}
              <MessageSquareText className="w-6 h-6 text-gray-700" /> ({comments.length}) 
            </Button> 
          )} 
          <Button className="flex-1 py-1 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-md" 
              onClick={() => onAddEditComment?.(id, lastComment?.text)} 
          > 
            {/* Add Comment  */}
            <MessageSquarePlus className="w-6 h-6 text-gray-700" />
          </Button> 
        </div>
      </div>
      <div
        className="flex flex-col items-center justify-center p-2 h-full"
        style={{
            backgroundColor: getRedColor?.(
              getPercentile?.(lastPlacedOrder, vendor_order_frequency) ?? 0,
              lastPlacedOrder,
              statusHistory?.find(s => s.status === currentStatus)?.timestamp,
              currentStatus
            ) ?? "#f3f4f6"
          }}
        >
          {/* <div className="text-sm font-semibold text-gray-800">
            Last Placed Order
          </div> */}
          <div className="text-sm text-gray-700 font-semibold mt-1">
            {lastPlacedOrder
              ? new Date(lastPlacedOrder).toLocaleString("en-CA", {
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
  )
}
