import React, { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useFormStore } from '@/store'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
// import { addDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { LocationPicker } from '@/components/custom/locationPicker'
import PurchaseOrderPDF from '@/components/custom/poForm'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Trash2, Camera, Loader2, Calendar, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getStartAndEndOfToday, uploadBase64Image } from '@/lib/utils'
import axios from "axios"
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { formatFleetCardNumber } from '@/lib/utils';
import { getPendingActions, deletePendingAction } from '@/lib/orderRecIndexedDB';

export const Route = createFileRoute('/_navbarLayout/po/list')({
  component: RouteComponent,
})

const toYmd = (d: string | Date) => {
  const x = new Date(d as any)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function RouteComponent() {
  const { user } = useAuth()
  const { selectedSite } = useSite()
  const navigate = useNavigate()
  const resetForm = useFormStore((state) => state.resetForm);
  const { start, end } = getStartAndEndOfToday();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: start,
    to: end,
  });

  // const poData = Route.useLoaderData() as any;

  const [stationName, setStationName] = React.useState<string>(selectedSite || user?.location || "");
  const [, setTimezone] = React.useState<string>(user?.timezone || "America/Toronto");
  const [purchaseOrders, setPurchaseOrders] = React.useState<
    {
    _id?: string;
    date: string;
    dateStr?: string;
    fleetCardNumber: string;
    noFleetCard?: boolean;
    customerName: string;
    driverName: string;
    quantity: number;
    amount: number;
    description: string;
    vehicleMakeModel: string;
    licensePlate?: string;
    signature: string;
    receipt: string;
    poNumber: string;
    requestReceipt?: boolean;
  }[]
  >([]);

  // Purchase orders created offline and not yet synced to the server (read
  // straight from the shared IndexedDB pending-action queue in lib/orderRecIndexedDB).
  const [pendingPOs, setPendingPOs] = React.useState<any[]>([]);
  const prevPendingCountRef = React.useRef(0);

  const fetchPurchaseOrders = async () => {
    console.log('fetchPurchaseOrders called with:', date, stationName);
    if (!date?.from || !date?.to || !stationName) return;

    try {
      // add authorization header with bearer token
      const response = await axios.get(
        `/api/purchase-orders`, {
          params: {
            startDate: toYmd(date.from),
            endDate: toYmd(date.to),
            stationName
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            "X-Required-Permission": "po"
          }
        }
      );
      const data = response.data;
      console.log('Fetched purchase orders:', data);
      setPurchaseOrders(data);
    } catch (error: any) {
      if (error.response?.status === 403) {
          // Redirect to no-access page
        navigate({ to: "/no-access" });
      }
      console.error("Error fetching purchase orders:", error);
      // Keep showing whatever was last successfully fetched (e.g. while offline)
      // instead of blanking the table — a failed refresh isn't "no orders".
    }
  };

  const refreshPendingPOs = React.useCallback(async () => {
    try {
      const actions = await getPendingActions();
      setPendingPOs(actions.filter((a: any) => a?.type === 'CREATE_PURCHASE_ORDER'));
    } catch (err) {
      console.error('Error reading pending purchase orders:', err);
    }
  }, []);

  // Poll the local offline queue so a PO saved while offline shows up here
  // immediately, and disappears once the background sync loop clears it.
  useEffect(() => {
    refreshPendingPOs();
    const interval = setInterval(refreshPendingPOs, 5000);
    const onOnline = () => setTimeout(refreshPendingPOs, 2000);
    window.addEventListener('online', onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
    };
  }, [refreshPendingPOs]);

  // A drop in the pending count means the sync loop just posted one or more
  // queued orders to the server — refresh the server list to pick them up.
  useEffect(() => {
    if (pendingPOs.length < prevPendingCountRef.current) {
      fetchPurchaseOrders();
    }
    prevPendingCountRef.current = pendingPOs.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPOs.length]);

  const filteredPendingActions = pendingPOs
    .filter((a: any) => a?.payload?.stationName === stationName)
    .filter((a: any) => {
      if (!date?.from || !date?.to) return true;
      const d = a?.payload?.date;
      return d && d >= toYmd(date.from) && d <= toYmd(date.to);
    });

  const mapPendingAction = (a: any) => ({
    _id: `pending-${a.queuedAt}`,
    date: a.payload.date,
    dateStr: a.payload.date,
    fleetCardNumber: a.payload.fleetCardNumber,
    noFleetCard: a.payload.noFleetCard,
    poNumber: a.payload.poNumber,
    customerName: a.payload.customerName,
    driverName: a.payload.driverName,
    quantity: a.payload.quantity,
    amount: a.payload.amount,
    description: a.payload.purchaseType === 'non-fuel' ? a.payload.itemsDescription : a.payload.productCode,
    vehicleMakeModel: a.payload.vehicleMakeModel,
    licensePlate: a.payload.licensePlate,
    signature: a.payload.signature,
    receipt: '',
    requestReceipt: false,
    pending: !a.failed,
    failed: !!a.failed,
    failureReason: a.failureReason,
    _key: a._key,
  });

  // Permanently-failed submissions (e.g. 403 permission denied, 409
  // duplicate PO number) will never succeed no matter how many times the
  // background sync retries — surfaced separately so they don't sit as an
  // unexplained "pending" spinner forever.
  const pendingRows = filteredPendingActions.filter((a: any) => !a.failed).map(mapPendingAction);
  const failedRows = filteredPendingActions.filter((a: any) => a.failed).map(mapPendingAction);

  const allOrders = [...failedRows, ...pendingRows, ...purchaseOrders];

  const dismissFailedPO = async (key: any) => {
    if (key == null) return;
    const ok = window.confirm('Remove this failed purchase order from the queue? It was never submitted — re-enter it manually if it still needs to be recorded.');
    if (!ok) return;
    await deletePendingAction(key);
    refreshPendingPOs();
  };

  const generatePDF = async (order: {
    date: string;
    dateStr?: string;
    fleetCardNumber: string;
    poNumber: string;
    customerName: string;
    driverName: string;
    quantity: number;
    amount: number;
    description: string;
    vehicleMakeModel: string;
    signature: string;
    receipt: string;
  }) => {
    try {
      const doc = <PurchaseOrderPDF order={order} />;
      const asPdf = pdf(<></>); // Create a new instance of pdf with an empty React fragment
      asPdf.updateContainer(doc); // Add the document to the pdf instance
      const blob = await asPdf.toBlob(); // Generate the pdf as a blob

      // Create a URL for the blob and open it in a new window
      const url = URL.createObjectURL(blob);
      window.open(url);

    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!date?.from || !date?.to) {
      const today = new Date();
      setDate({ from: today, to: today });
      return;
    }
    fetchPurchaseOrders();
  }, [date, stationName]);

  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {}

  // Track delete requests
  const [pendingDelete, setPendingDelete] = React.useState<Set<string>>(() => new Set())

  const deleteOrder = async (order: any) => {
    if (!access?.po?.delete) return
    const dateLabel = order.dateStr || new Date(order.date).toLocaleDateString('en-CA', { timeZone: 'UTC' })
    const ok = window.confirm(`Delete PO entry dated ${dateLabel}? It will be removed from this list.`)
    if (!ok) return
    try {
      setPendingDelete(prev => new Set(prev).add(order._id))
      await axios.delete(`/api/purchase-orders/${order._id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'po.delete',
        },
      })
      setPurchaseOrders(prev => prev.filter((o: any) => o._id !== order._id))
    } catch (error: any) {
      if (error.response?.status === 403) navigate({ to: '/no-access' })
      const msg = error.response?.data?.message || error.message || 'Delete failed'
      alert(msg)
    } finally {
      setPendingDelete(prev => {
        const next = new Set(prev)
        next.delete(order._id)
        return next
      })
    }
  }

  // Receipt capture state
  const receiptFileInputRef = React.useRef<HTMLInputElement>(null)
  const [receiptTargetOrder, setReceiptTargetOrder] = React.useState<any | null>(null)
  const [receiptPreview, setReceiptPreview] = React.useState<string>('')
  const [receiptDialogOpen, setReceiptDialogOpen] = React.useState(false)
  const [uploadingReceipt, setUploadingReceipt] = React.useState(false)

  const onCameraClick = (order: any) => {
    setReceiptTargetOrder(order)
    receiptFileInputRef.current?.click()
  }

  const handleReceiptCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string)
      setReceiptDialogOpen(true)
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const submitReceipt = async () => {
    if (!receiptTargetOrder || !receiptPreview) return
    setUploadingReceipt(true)
    try {
      const { filename } = await uploadBase64Image(receiptPreview, 'receipt.jpg')
      await axios.put(
        `/api/purchase-orders/${receiptTargetOrder._id}`,
        { receipt: filename, requestReceipt: false },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Required-Permission': 'po',
          },
        }
      )
      setPurchaseOrders(prev =>
        prev.map(o => (o as any)._id === receiptTargetOrder._id ? { ...o, receipt: filename, requestReceipt: false } : o)
      )
      setReceiptDialogOpen(false)
      setReceiptPreview('')
      setReceiptTargetOrder(null)
    } catch (error: any) {
      if (error.response?.status === 403) navigate({ to: '/no-access' })
      alert(error.response?.data?.message || error.message || 'Upload failed')
    } finally {
      setUploadingReceipt(false)
    }
  }

  // Change Date dialog state
  const [changeDateOpen, setChangeDateOpen] = React.useState(false)
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null)
  const [newDate, setNewDate] = React.useState<string>('')

  const onChangeDateClick = (order: any) => {
    setSelectedOrder(order)
    setNewDate(order.dateStr || toYmd(order.date))
    setChangeDateOpen(true)
  }

  const saveNewDate = async () => {
    if (!selectedOrder || !newDate) return
    try {
      const res = await axios.put(
        `/api/purchase-orders/${selectedOrder._id}`,
        { date: newDate },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            "X-Required-Permission": "po",
          },
        }
      )
      const updated = res.data
      setPurchaseOrders(prev => prev.map(o => (o as any)._id === selectedOrder._id ? { ...o, date: updated.date, dateStr: updated.dateStr } : o))

      setChangeDateOpen(false)
      setSelectedOrder(null)
      setNewDate('')
    } catch (error: any) {
      console.error('Failed to update date:', error)
      if (error.response?.status === 403) navigate({ to: "/no-access" })
    }
  }

  const showActionsColumn = !!(access?.po?.pdf || access?.po?.changeDate || access?.po?.delete || purchaseOrders.some(o => o.requestReceipt) || pendingRows.length > 0 || failedRows.length > 0)

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={receiptFileInputRef}
        onChange={handleReceiptCapture}
      />
      <h2 className="text-lg font-bold mb-2">Purchase Order List</h2>

      <div className="flex justify-between gap-4 border-t border-dashed border-gray-300 mt-4 pt-4">
        <DatePickerWithRange date={date} setDate={setDate} />

        <LocationPicker
          setStationName={setStationName}
          setTimezone={setTimezone}
          value="stationName"
          // {...(!access.component_po_location_filter ? { disabled: true } : {})}
        />
      </div>

      <div className="flex justify-between border-b border-dashed border-gray-300 py-2 mb-2 text-sm text-gray-600">
        <span>
          {allOrders.length} {allOrders.length === 1 ? 'entry' : 'entries'}
          {pendingRows.length > 0 && (
            <span className="text-amber-600"> ({pendingRows.length} pending upload)</span>
          )}
          {failedRows.length > 0 && (
            <span className="text-red-600"> ({failedRows.length} failed)</span>
          )}
        </span>
        <span>Qty: {allOrders.reduce((sum, o) => sum + o.quantity, 0).toFixed(3)}</span>
        <span>Total: ${allOrders.reduce((sum, o) => sum + o.amount, 0).toFixed(2)}</span>
      </div>

      <table className="table-auto w-full border-collapse border-0 mt-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Date</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Card / PO</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Customer Name</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Driver Name</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Quantity</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Amount</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Vehicle</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Plate</th>
            {showActionsColumn && (
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {allOrders.length > 0 ? (
            allOrders.map((order: any, index) => (
              <tr key={order._id ?? index} className={order.failed ? 'bg-red-50 hover:bg-red-100' : order.pending ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{
                  order.dateStr || new Date(order.date).toLocaleDateString('en-CA', { timeZone: 'UTC' })
                }</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.noFleetCard ? 'No Fleet Card' : (formatFleetCardNumber(order.fleetCardNumber) || order.poNumber)}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.customerName}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.driverName}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.quantity}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.amount.toFixed(2)}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.vehicleMakeModel}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.licensePlate}</td>
                {showActionsColumn && (
                  <td className="border-dashed border-t border-gray-300 px-4 py-2 space-x-2">
                    {order.failed ? (
                      <span className="text-xs font-medium text-red-700 inline-flex flex-col items-start gap-0.5">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Upload failed
                        </span>
                        {order.failureReason && (
                          <span className="text-[10px] text-red-600 max-w-[180px] truncate" title={order.failureReason}>
                            {order.failureReason}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1 text-[10px] text-red-700"
                          onClick={() => dismissFailedPO(order._key)}
                        >
                          Dismiss
                        </Button>
                      </span>
                    ) : order.pending ? (
                      <span className="text-xs font-medium text-amber-700 inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Pending upload
                      </span>
                    ) : (
                      <>
                        {order.requestReceipt && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onCameraClick(order)}
                            title="Upload Receipt"
                            aria-label="Upload Receipt"
                          >
                            <Camera className="h-4 w-4" />
                            <span className="sr-only">Upload Receipt</span>
                          </Button>
                        )}
                        {access?.po?.pdf && (
                          <Button onClick={() => generatePDF(order)}>PDF</Button>
                        )}
                        {access?.po?.changeDate && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => onChangeDateClick(order)}
                            title="Change Date"
                            aria-label="Change Date"
                          >
                            <Calendar className="h-4 w-4" />
                            <span className="sr-only">Change Date</span>
                          </Button>
                        )}
                        {access?.po?.delete && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => deleteOrder(order)}
                            disabled={pendingDelete.has(order._id || '')}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="border-dashed border-t border-gray-300 px-4 py-2 text-center">
                No purchase orders available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {/* Receipt Upload Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={(open) => { if (!uploadingReceipt) { setReceiptDialogOpen(open); if (!open) setReceiptPreview('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {receiptPreview && (
              <img src={receiptPreview} alt="Receipt preview" className="w-full max-h-64 object-contain rounded border" />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => receiptFileInputRef.current?.click()}
              disabled={uploadingReceipt}
            >
              <Camera className="mr-2 h-3 w-3" />
              Retake
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReceiptDialogOpen(false); setReceiptPreview('') }} disabled={uploadingReceipt}>
              Cancel
            </Button>
            <Button onClick={submitReceipt} disabled={uploadingReceipt || !receiptPreview}>
              {uploadingReceipt ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Date Dialog */}
      <Dialog open={changeDateOpen} onOpenChange={setChangeDateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Purchase Order Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="po-date">Date</Label>
              <input
                id="po-date"
                type="date"
                className="border rounded px-2 py-1"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeDateOpen(false)}>Cancel</Button>
            <Button onClick={saveNewDate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
  );
}
