import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getStatusStyles } from "./requests"
import { REASON_COLORS, REASONS } from './create'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Package, CheckCircle2, CheckSquare, Square, Minus, Plus } from 'lucide-react'
import Barcode from 'react-barcode'
import axios from 'axios'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/_navbarLayout/write-off/$id')({
  component: WriteOffDetailsPage,
  loader: async ({ params }) => {
    const res = await axios.get(`/api/write-off/${params.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    return res.data
  }
})

function WriteOffDetailsPage() {
  const data = Route.useLoaderData()
  const [writeOff, setWriteOff] = useState(data)
  const [barcodeValue, setBarcodeValue] = useState<string | null>(null)

  // Inside WriteOffDetailsPage component
  const [editItem, setEditItem] = useState<any | null>(null);

  const isATE = writeOff.listType === 'ATE';

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Construct payload dynamically
      const payload: any = {
        qty: editItem.qty
      };

      if (isATE) {
        payload.markdownAction = editItem.markdownAction;
      } else {
        payload.reason = editItem.reason;
      }

      const res = await axios.patch(
        `/api/write-off/${writeOff._id}/items/${editItem._id}/details`,
        payload,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      setWriteOff(res.data);
      setEditItem(null);
    } catch (err) {
      console.error("Update failed", err);
      alert("Failed to update item details.");
    }
  };

  const handleToggleItem = async (itemId: string, currentVal: boolean) => {
    try {
      const res = await axios.patch(
        `/api/write-off/${writeOff._id}/items/${itemId}`,
        { completed: !currentVal },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setWriteOff(res.data);
    } catch (err: any) {
      // This will now show the actual error message from the backend
      console.error("Failed to update item:", err.response?.data || err.message);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm("Are you sure you want to finalize this write-off? This will lock the record.")) return;

    try {
      const res = await axios.patch(
        `/api/write-off/${writeOff._id}/finalize`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setWriteOff(res.data);
      // Optional: add a success toast notification here
    } catch (err) {
      console.error("Finalization failed", err);
    }
  };

  // Helper to determine if the page should be read-only
  const isLocked = writeOff.submitted;

  return (
    <div className="min-w-4xl mx-auto p-6 flex flex-col h-[calc(100vh-80px)] font-sans antialiased">
      {/* ---------------------------------------------------------
          HEADER SECTION
      --------------------------------------------------------- */}
      {isATE ? (
        /* ATE HEADER */
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm flex items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-md font-bold tracking-normal text-slate-900">
                {writeOff.listNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusStyles(writeOff.status)}`}
              >
                {writeOff.status}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-base font-bold tracking-normal">
                  {new Date(writeOff.createdAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-base font-medium text-slate-400">at</span>
                <span className="text-base font-bold text-slate-900 tracking-normal">
                  {new Date(writeOff.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />

              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-500 uppercase tracking-normal">
                <Package className="w-4 h-4" />
                {writeOff.items.length} Units
              </div>
            </div>
          </div>


          <div className="text-right">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              Markdown Workflow
            </span>
          </div>
        </div>
      ) : (
        /* HEADER INFO CARD */
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm flex items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-md font-bold tracking-normal text-slate-900">
                {writeOff.listNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusStyles(writeOff.status)}`}
              >
                {writeOff.status}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-base font-bold tracking-normal">
                  {new Date(writeOff.createdAt).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-base font-medium text-slate-400">at</span>
                <span className="text-base font-bold text-slate-900 tracking-normal">
                  {new Date(writeOff.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />

              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-500 uppercase tracking-normal">
                <Package className="w-4 h-4" />
                {writeOff.items.length} Units
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <Button
              disabled={writeOff.status !== 'Complete' || isLocked}
              onClick={handleFinalize}
              className={`h-12 px-8 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-lg 
          ${isLocked
                  ? 'bg-slate-200 text-slate-500 shadow-none cursor-not-allowed'
                  : writeOff.status === 'Complete'
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'
                    : 'bg-slate-100 text-slate-400 shadow-none'
                }`}
            >
              {isLocked ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2 stroke-[3px]" />
                  Write off Finalised
                </>
              ) : (
                <>
                  {writeOff.status === 'Complete' && (
                    <CheckCircle2 className="w-4 h-4 mr-2 stroke-[3px]" />
                  )}
                  Finalize Write-Off
                </>
              )}
            </Button>
          </div>
        </div>
      )}


      {/* Main Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto">
          {isATE ? (
            /* NEW ATE TABLE */
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-indigo-50/50 z-10 border-b border-indigo-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-indigo-900 uppercase">Item Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-indigo-900 uppercase">Barcode</th>
                  <th className="px-6 py-4 text-xs font-bold text-indigo-900 uppercase text-center">ATE Qty</th>
                  <th className="px-6 py-4 text-xs font-bold text-indigo-900 uppercase text-center">Current On Hand</th>
                  <th className="px-6 py-4 text-xs font-bold text-indigo-900 uppercase text-center">Action</th>
                  <th className="px-6 py-4 text-xs font-bold text-indigo-900 uppercase text-right">Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {writeOff.items.map((item: any) => (
                  <tr key={item._id}
                    className={`transition-colors cursor-pointer ${isLocked ? 'cursor-default' : 'hover:bg-slate-50'
                      } ${item.completed ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                        <span className="text-[10px] font-bold text-indigo-400">
                          {new Date(item.expiryDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-600 underline" onClick={(e) => { e.stopPropagation(); setBarcodeValue(item.upc_barcode); }}>
                      {item.upc_barcode}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700"
                      onClick={() => {
                        // 1. If the list is locked (submitted), do nothing
                        if (isLocked) return;

                        // 2. If the item is checked, show alert and prevent edit
                        if (item.completed) {
                          alert("This item is already checked. Please uncheck it if you need to edit the quantity or reason.");
                          return;
                        }

                        // 3. Otherwise, open edit dialog
                        setEditItem(item);
                      }}
                    >
                      {item.qty}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-400">{item.onHandAtWriteOff}</td>
                    <td className="px-6 py-4 text-center"
                      onClick={() => {
                        // 1. If the list is locked (submitted), do nothing
                        if (isLocked) return;

                        // 2. If the item is checked, show alert and prevent edit
                        if (item.completed) {
                          alert("This item is already checked. Please uncheck it if you need to edit the quantity or reason.");
                          return;
                        }

                        // 3. Otherwise, open edit dialog
                        setEditItem(item);
                      }}
                    >
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border ${item.markdownAction === 'Marked Down' ? 'bg-green-100 border-green-200 text-green-700' :
                        item.markdownAction === 'No Markdown Needed' ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-50 text-slate-400 italic'
                        }`}>
                        {item.markdownAction || 'Pending Review'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={(e) => { e.stopPropagation(); !isLocked && handleToggleItem(item._id, item.completed); }}>
                        {item.completed ? <CheckSquare size={28} className="text-green-600 fill-green-50" /> : <Square size={28} className="text-slate-200" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* ORIGINAL WRITE-OFF TABLE */
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Item Name
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    UPC / Barcode
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    Qty (to Write-Off)
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                    On hand Qty (at Write-Off)
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Reason
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {writeOff.items.map((item: any) => (
                  <tr
                    key={item._id}
                    className={`transition-colors cursor-pointer ${isLocked ? 'cursor-default' : 'hover:bg-slate-50'
                      } ${item.completed ? 'bg-slate-50/30' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">
                          {item.name}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {item.gtin || 'No GTIN'}
                        </span>
                      </div>
                    </td>

                    <td
                      className="px-6 py-4 text-blue-600 cursor-pointer underline hover:text-blue-800"
                      onClick={() => setBarcodeValue(item.upc_barcode)}
                    >
                      <span className="text-sm">{item.upc_barcode}</span>
                    </td>

                    <td className="px-6 py-4 text-center"
                      onClick={() => {
                        // 1. If the list is locked (submitted), do nothing
                        if (isLocked) return;

                        // 2. If the item is checked, show alert and prevent edit
                        if (item.completed) {
                          alert("This item is already checked. Please uncheck it if you need to edit the quantity or reason.");
                          return;
                        }

                        // 3. Otherwise, open edit dialog
                        setEditItem(item);
                      }}
                    >
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-bold 
                        ${item.isEdited ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                          {item.qty}
                        </span>
                        {item.isEdited && <span className="text-[8px] font-bold uppercase text-slate-500">Edited</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-lg text-sm font-bold bg-slate-100 text-slate-700">
                          {item.onHandAtWriteOff}
                        </span>
                        {/* {item.isEdited && <span className="text-[8px] font-bold uppercase text-slate-500">Edited</span>} */}
                      </div>
                    </td>

                    <td className="px-6 py-4"
                      onClick={() => {
                        // 1. If the list is locked (submitted), do nothing
                        if (isLocked) return;

                        // 2. If the item is checked, show alert and prevent edit
                        if (item.completed) {
                          alert("This item is already checked. Please uncheck it if you need to edit the quantity or reason.");
                          return;
                        }

                        // 3. Otherwise, open edit dialog
                        setEditItem(item);
                      }}
                    >
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border 
                        ${REASON_COLORS[item.reason]} ${item.isEdited ? 'ring-1 ring-slate-800 ring-offset-1' : ''}`}>
                          {item.reason}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevents opening the edit dialog
                          !isLocked && handleToggleItem(item._id, item.completed);
                        }}
                        disabled={isLocked}
                        className="flex items-center justify-end w-full"
                      >
                        {item.completed ? (
                          <CheckSquare size={28} className="text-green-600 fill-green-50" strokeWidth={2.5} />
                        ) : (
                          <Square size={28} className="text-slate-300" strokeWidth={2} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Barcode Dialog */}
      <Dialog open={!!barcodeValue} onOpenChange={() => setBarcodeValue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>UPC Barcode</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-4">
            {barcodeValue && <Barcode value={barcodeValue} />}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-bold">
              {isATE ? 'Review ATE Item' : 'Edit Item Details'}
            </DialogTitle>
          </DialogHeader>

          {editItem && (
            <form onSubmit={handleUpdateDetails} className="space-y-6 pt-4">
              <div className="text-center">
                <p className="text-sm font-bold text-slate-900">{editItem.name}</p>
                <p className="text-xs text-slate-500 font-mono">{editItem.upc_barcode}</p>
              </div>

              {/* Quantity Selector - Stays same for both */}
              <div className="flex flex-col items-center gap-3">
                <label className="text-sm font-bold">
                  {isATE ? 'Quantity Found' : 'Quantity'}
                </label>
                <div className="flex items-center gap-4">
                  <Button
                    type="button" variant="outline" size="icon" className="h-10 w-10"
                    onClick={() => setEditItem({ ...editItem, qty: Math.max(1, editItem.qty - 1) })}
                  >
                    <Minus size={18} />
                  </Button>
                  <Input
                    type="number"
                    value={editItem.qty}
                    className="w-20 text-center font-bold text-lg"
                    onChange={(e: any) => setEditItem({ ...editItem, qty: Number(e.target.value) })}
                  />
                  <Button
                    type="button" variant="outline" size="icon" className="h-10 w-10"
                    onClick={() => setEditItem({ ...editItem, qty: editItem.qty + 1 })}
                  >
                    <Plus size={18} />
                  </Button>
                </div>
              </div>

              {/* Conditional Dropdown: Reason vs Markdown Action */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-center">
                  {isATE ? 'Markdown Action' : 'Reason for Write-Off'}
                </label>

                <Select
                  // If ATE, use markdownAction field. If WO, use reason field.
                  value={isATE ? (editItem.markdownAction || "") : editItem.reason}
                  onValueChange={(val) =>
                    setEditItem(isATE
                      ? { ...editItem, markdownAction: val }
                      : { ...editItem, reason: val }
                    )
                  }
                >
                  <SelectTrigger className="w-full font-bold">
                    <SelectValue placeholder={isATE ? "Select action" : "Select reason"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isATE ? (
                      /* ATE SPECIFIC OPTIONS */
                      <>
                        <SelectItem value="Marked Down" className="font-medium text-green-700">
                          Marked Down
                        </SelectItem>
                        <SelectItem value="No Markdown Needed" className="font-medium text-slate-600">
                          No Markdown Needed
                        </SelectItem>
                      </>
                    ) : (
                      /* ORIGINAL WO OPTIONS (Excluding "About to Expire") */
                      REASONS
                        .filter(r => r !== "About to Expire") // <--- Filters out the ATE option
                        .map(r => (
                          <SelectItem key={r} value={r} className="font-medium">
                            {r}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="flex-1 font-bold" onClick={() => setEditItem(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className={`flex-1 font-bold text-white ${isATE ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900'}`}
                >
                  {isATE ? 'Confirm Review' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div >
  )
}