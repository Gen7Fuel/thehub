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
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getStartAndEndOfToday } from '@/lib/utils'
import { DateTime } from 'luxon'
import axios from "axios"
import { useAuth } from "@/context/AuthContext";
import { formatFleetCardNumber } from '@/lib/utils';

export const Route = createFileRoute('/_navbarLayout/po/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const resetForm = useFormStore((state) => state.resetForm);
  const { start, end } = getStartAndEndOfToday();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: start,
    to: end,
  });
  
  // const poData = Route.useLoaderData() as any;

  const [stationName, setStationName] = React.useState<string>(user?.location || "");
  const [timezone, setTimezone] = React.useState<string>(user?.timezone || "America/Toronto");
  const [purchaseOrders, setPurchaseOrders] = React.useState<
    {
    _id?: string;
    date: string;
    fleetCardNumber: string;
    customerName: string;
    driverName: string;
    quantity: number;
    amount: number;
    description: string;
    vehicleMakeModel: string;
    signature: string;
    receipt: string;
    poNumber: string;
  }[]
  >([]);

  const fetchPurchaseOrders = async () => {
    console.log('fetchPurchaseOrders called with:', date, stationName);
    if (!date?.from || !date?.to || !stationName) return;

    // Convert day boundaries in station timezone -> UTC instants
    const toYmd = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    const startUtc = DateTime.fromISO(`${toYmd(date.from)}T00:00:00`, { zone: timezone }).toUTC().toJSDate()
    const endUtc = DateTime.fromISO(`${toYmd(date.to)}T00:00:00`, { zone: timezone }).toUTC().toJSDate()

    try {
      // add authorization header with bearer token
      const response = await axios.get(
        `/api/purchase-orders`, {
          params: {
            startDate: startUtc.toISOString(),
            endDate: endUtc.toISOString(),
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
      setPurchaseOrders([]);
    }
  };

  const generatePDF = async (order: {
    date: string;
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
    const ok = window.confirm(`Delete PO entry dated ${new Date(order.date).toLocaleDateString()}? This cannot be undone.`)
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

  // Change Date dialog state
  const [changeDateOpen, setChangeDateOpen] = React.useState(false)
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null)
  const [newDate, setNewDate] = React.useState<string>('')

  const toYmd = (d: string | Date) => {
    const x = new Date(d as any)
    const y = x.getFullYear()
    const m = String(x.getMonth() + 1).padStart(2, '0')
    const dd = String(x.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  const onChangeDateClick = (order: any) => {
    setSelectedOrder(order)
    setNewDate(toYmd(order.date))
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
      setPurchaseOrders(prev => prev.map(o => (o as any)._id === selectedOrder._id ? { ...o, date: updated.date } : o))

      setChangeDateOpen(false)
      setSelectedOrder(null)
      setNewDate('')
    } catch (error: any) {
      console.error('Failed to update date:', error)
      if (error.response?.status === 403) navigate({ to: "/no-access" })
    }
  }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md">
      <h2 className="text-lg font-bold mb-2">Purchase Order List</h2>

      <div className="flex justify-around gap-4 border-t border-dashed border-gray-300 mt-4 pt-4">
        <DatePickerWithRange date={date} setDate={setDate} />

        <LocationPicker
          setStationName={setStationName}
          setTimezone={setTimezone}
          value="stationName"
          // {...(!access.component_po_location_filter ? { disabled: true } : {})}
        />
      </div>

      <table className="table-auto w-full border-collapse border-0 mt-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Date</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Fleet Card Number/PO Number</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Customer Name</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Driver Name</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Quantity</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Amount</th>
            {(access?.po?.pdf || access?.po?.changeDate || access?.po?.delete) && (
              <th className="border-dashed border-b border-gray-300 px-4 py-2">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.length > 0 ? (
            purchaseOrders.map((order, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{new Date(order.date).toLocaleDateString()}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{formatFleetCardNumber(order.fleetCardNumber) || order.poNumber}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.customerName}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.driverName}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.quantity}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.amount.toFixed(2)}</td>
                  {(access?.po?.pdf || access?.po?.changeDate || access?.po?.delete) && (
                    <td className="border-dashed border-t border-gray-300 px-4 py-2 space-x-2">
                      {access?.po?.pdf && (
                        <Button onClick={() => generatePDF(order)}>PDF</Button>
                      )}
                      {access?.po?.changeDate && (
                        <Button variant="outline" onClick={() => onChangeDateClick(order)}>Change Date</Button>
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
                    </td>
                  )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="border-dashed border-t border-gray-300 px-4 py-2 text-center">
                No purchase orders available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
