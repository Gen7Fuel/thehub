import React, { useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useFormStore } from '@/store';
import { DatePickerWithRange } from '@/components/custom/datePickerWithRange';
import { addDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { LocationPicker } from '@/components/custom/locationPicker';
import axios from "axios"
import { toUTC } from '@/lib/utils';
// import { useAuth } from "@/context/AuthContext"

export const Route = createFileRoute('/_navbarLayout/kardpoll/list')({
  component: RouteComponent,
  loader: async () => {
    try {
      // add authorization header with bearer token
      const response = await axios.get('/api/locations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const locations = response.data;
      return { locations };
    } catch (error) {
      console.error('Error loading locations:', error);
      return { locations: [] };
    }
  },
});

function RouteComponent() {
  const resetForm = useFormStore((state) => state.resetForm);
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 0),
  });
  // const { user } = useAuth()
  // const access = user?.access || '{}'
  const [stationName, setStationName] = React.useState<string>('');
  const [transactions, setTransactions] = React.useState<
    {
      date: string;
      fleetCardNumber: string;
      productCode: string;
      quantity: number;
      amount: number;
    }[]
  >([]);

  const fetchTransactions = async () => {
    if (!date?.from || !date?.to || !stationName) return;

    try {
      const response = await axios.get(
        `/api/kardpoll-transactions`, {
          params: {
            startDate: toUTC(date.from).toISOString(),
            endDate: toUTC(date.to).toISOString(),
            stationName
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      setTransactions(response.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    }
  };

  // const data = Route.useLoaderData() as { locations: { _id: string; stationName: string }[] };

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    fetchTransactions();
  }, [date, stationName]);

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md">
      <h2 className="text-lg font-bold mb-2">Kardpoll Transactions</h2>

      <div className="flex justify-around gap-4 border-t border-dashed border-gray-300 mt-4 pt-4">
        <DatePickerWithRange date={date} setDate={setDate} />

        <LocationPicker
          setStationName={setStationName}
          value='stationName'
          // disabled={!access.component_kardpoll_list_location_filter}
        />
      </div>

      <table className="table-auto w-full border-collapse border-0 mt-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Date</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Fleet Card Number</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Product Code</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Quantity</th>
            <th className="border-dashed border-b border-gray-300 px-4 py-2">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length > 0 ? (
            transactions.map((transaction, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {new Date(transaction.date).toLocaleDateString()}
                </td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {transaction.fleetCardNumber}
                </td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {transaction.productCode}
                </td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {transaction.quantity}
                </td>
                <td className="border-dashed border-t border-gray-300 px-4 py-2">
                  {transaction.amount.toFixed(2)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="border-dashed border-t border-gray-300 px-4 py-2 text-center">
                No transactions available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}