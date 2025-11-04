import React, { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useFormStore } from '@/store'
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange'
// import { addDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import { LocationPicker } from '@/components/custom/locationPicker'
import PurchaseOrderPDF from '@/components/custom/poForm'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { getStartAndEndOfToday } from '@/lib/utils'
import { toZonedTime } from 'date-fns-tz'
import axios from "axios"
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/po/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
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
  }[]
  >([]);

  const fetchPurchaseOrders = async () => {
    console.log('fetchPurchaseOrders called with:', date, stationName);
    if (!date?.from || !date?.to || !stationName) return;

    // Convert dates to the selected timezone before sending to API
    const startDateInTimezone = toZonedTime(date.from, timezone);
    const endDateInTimezone = toZonedTime(date.to, timezone);

    try {
      // add authorization header with bearer token
      const response = await axios.get(
        `/api/purchase-orders`, {
          params: {
            startDate: startDateInTimezone.toISOString(),
            endDate: endDateInTimezone.toISOString(),
            stationName
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = response.data;
      console.log('Fetched purchase orders:', data);
      setPurchaseOrders(data);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      setPurchaseOrders([]);
    }
  };

  const generatePDF = async (order: {
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
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Fleet Card Number</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Customer Name</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Driver Name</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Quantity</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Amount</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {purchaseOrders.length > 0 ? (
            purchaseOrders.map((order, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{new Date(order.date).toLocaleDateString()}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.fleetCardNumber}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.customerName}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.driverName}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.quantity}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{order.amount.toFixed(2)}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {
                    // access.component_po_pdf && //markpoint
                    access.po.pdf && 
                    <Button onClick={() => generatePDF(order)}>PDF</Button>
                  }
                </td>
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
      </div>
  );
}
