import React, { useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { DatePicker } from '@/components/custom/datePicker';
import { LocationPicker } from '@/components/custom/locationPicker';
import { Button } from '@/components/ui/button';
import { formatPhoneNumber } from '@/lib/utils';
import { pdf } from '@react-pdf/renderer'
import StatusSalesPDF from '@/components/custom/statusSalesForm';
import axios from "axios"
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/status/list')({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth()
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  if (date)
    console.log('Selected date:', new Date(date.setHours(0, 0, 0, 0)).toISOString());

  const [stationName, setStationName] = React.useState<string>(user?.location || '');
  const [statusSales, setStatusSales] = React.useState<
    {
      createdAt: string;
      statusCardNumber: string;
      pump: string;
      fuelGrade: string;
      amount: number;
      total: number;
      customerDetails: {
        name: string;
        phone: string;
      };
      notes: string;
    }[]
  >([]);

  const fetchStatusSales = async () => {
    if (!date || !stationName) return;

    try {
      // add authorization header with bearer token
      const response = await axios.get('/api/status-sales', {
        params: {
          // startDate: toUTC(date).toISOString().split('T')[0],
          // endDate: toUTC(date).toISOString().split('T')[0],
          startDate: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
          endDate: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
          stationName,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setStatusSales(response.data);
    } catch (error) {
      console.error('Error fetching status sales:', error);
      setStatusSales([]);
    }
  };

  useEffect(() => {
    fetchStatusSales();
  }, [date, stationName]);

  interface StatusSale {
    _id?: string;
    statusCardNumber: string;
    pump: string;
    fuelGrade: string;
    amount: number;
    total: number;
    stationName?: string;
    notes: string;
    customerDetails: {
      name: string;
      phone: string;
    };
    createdAt: string; // ISO date string
    updatedAt?: string; // ISO date string
    __v?: number;
  }

  const generatePDF = async (statusSales: StatusSale[]) => {
    try {
      const doc = <StatusSalesPDF data={statusSales} date={date ? date.toISOString().split('T')[0] : ''} station={stationName} />;
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

  // const access = user?.access || '{}'; //markpoint
  const access = user?.access || {};

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md">
      <span className='flex justify-between'>
      <h2 className="text-lg font-bold mb-2">Status Sales List</h2>
      {/* { access.component_status_pdf && //markpoint */}
      { access.status.pdf &&
        <Button onClick={() => generatePDF(statusSales)} className="mb-4">
          PDF
        </Button>
      }
      </span>

      <div className="flex justify-around gap-4 border-t border-dashed border-gray-300 mt-4 pt-4">
        <DatePicker date={date} setDate={setDate} />

        <LocationPicker
          setStationName={setStationName}
          value="stationName"
          // {...(!access.component_po_location_filter ? { disabled: true } : {})}
        />
      </div>

      <table className="table-auto w-full border-collapse border-0 mt-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Customer</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Status Card Number</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Pump</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Fuel Grade</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Amount (L)</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Total (CAD)</th>
            {/* <th className="border-dashed border-b border-gray-300 px-4 py-2">createdAt</th> */}
          </tr>
        </thead>
        <tbody>
          {statusSales.length > 0 ? (
            statusSales.map((sale, index) => (
              <>
              <tr key={index} className="hover:bg-gray-50">
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {sale.customerDetails.name} <br />
                  {
                    sale.amount > 200 && (
                      <small>{formatPhoneNumber(sale.customerDetails.phone)}</small>
                    )
                  }
                </td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{sale.statusCardNumber}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{sale.pump}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{sale.fuelGrade}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{sale.amount.toFixed(2)}</td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">{sale.total.toFixed(2)}</td>
                {/* <td className="border-dashed border-t border-gray-300 px-4 py-2">{sale.createdAt.replace('T', '---')}</td> */}
              </tr>
              {sale.amount > 200 && (
                <tr key={index} className="hover:bg-gray-50">
                  <td colSpan={6} className="px-4 text-xs">
                    Notes: {sale.notes}
                  </td>
                </tr>
              )}
              </>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="border-dashed border-t border-gray-300 px-4 py-2 text-center">
                No status sales available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

