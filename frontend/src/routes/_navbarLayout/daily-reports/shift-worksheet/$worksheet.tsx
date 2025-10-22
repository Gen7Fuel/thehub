import { createFileRoute } from '@tanstack/react-router';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EditableCell from '@/components/custom/editableCell';
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from 'react';
import { calculateData } from '@/lib/utils';
import axios from "axios"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute(
  '/_navbarLayout/daily-reports/shift-worksheet/$worksheet',
)({
  component: RouteComponent,
});

interface ShiftWorksheetData {
  _id: any
  report_number: number
  date: string
  shift: string
  shift_lead: string
  till_location: string
  notes: string
  float_returned_to_bag: number
  drops: { time: string; amount: number; initials: string }[]
  opening_float: { bill: Record<string, number>; change: Record<string, number> }
  closing_float: { bill: Record<string, number>; change: Record<string, number> }
  void_txn: string
  abandoned_change: string
  unsettled_prepay: string
  shift_report_cash: number
}

function RouteComponent() {
  const [data, setData] = useState<ShiftWorksheetData | null>(null)
  const { user } = useAuth()

  // Extract the worksheet value from the URL
  const worksheet = window.location.pathname.split('/').pop() || ''

  useEffect(() => {
    axios.get(`/api/shift-worksheet/${worksheet}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      .then((response) => setData(response.data))
      .catch((error) => console.error('Error fetching data:', error))
  }, [worksheet])

  // Functions to handle updates to the data
  const handleUpdate = (field: keyof ShiftWorksheetData, value: any) => {
    if (data) {
      setData({ ...data, [field]: value })
    }
  }

  const handleOBillUpdate = (field: string, value: any) => {
    if (data) {
      const updatedOpeningFloat = {
        ...data.opening_float,
        bill: {
          ...data.opening_float.bill,
          [field]: value,
        },
      }
      setData({ ...data, opening_float: updatedOpeningFloat })
    }
  }

  const handleCBillUpdate = (field: string, value: any) => {
    if (data) {
      const updatedClosingFloat = {
        ...data.closing_float,
        bill: {
          ...data.closing_float.bill,
          [field]: value,
        },
      }
      setData({ ...data, closing_float: updatedClosingFloat })
    }
  }

  const handleOChangeUpdate = (field: string, value: any) => {
    if (data) {
      const updatedOpeningFloat = {
        ...data.opening_float,
        change: {
          ...data.opening_float.change,
          [field]: value,
        },
      }
      setData({ ...data, opening_float: updatedOpeningFloat })
    }
  }

  const handleCChangeUpdate = (field: string, value: any) => {
    if (data) {
      const updatedClosingFloat = { 
        ...data.closing_float,
        change: {
          ...data.closing_float.change,
          [field]: value,
        },
      }
      setData({ ...data, closing_float: updatedClosingFloat })
    }
  }

  const handleDropAdd = (e: any) => {
    e.preventDefault();

    if (data) {
      const newDrop = { time: new Date().toLocaleTimeString(), amount: Number(e.target.dropAmount.value), initials: user?.initials || '' }
      const updatedDrops = [...data.drops, newDrop]
      // console.log(updatedDrops)
      setData({ ...data, drops: updatedDrops })
    }

    e.target.dropAmount.value = '';
    const dropAmountInput = document.getElementById("dropAmount") as HTMLInputElement;
    dropAmountInput?.focus();
  }

  const handleSave = () => {
    if (data) {
      axios.put(`/api/shift-worksheet/${data._id}`, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
        .then((response) => {
          if (response.status === 200) {
            console.log('Data saved successfully')
            toast("Data saved!")
          } else {
            console.error('Error saving data')
          }
        })
        .catch((error) => console.error('Error saving data:', error))
    }
  }

  const r = data ? calculateData(data) : {
    totalClosingFloatBill: 0,
    totalClosingFloatChange: 0,
    totalClosingFloat: 0,
    totalOpeningFloatBill: 0,
    totalOpeningFloatChange: 0,
    totalOpeningFloat: 0,
    totalCashForDeposit: 0,
    totalDrops: 0,
    totalCash: 0,
    overShortAmount: 0,
    isShort: false,
  };

  const { five, ten, twenty, fifty, hundred } = data?.opening_float.bill || {};
  const { two, one, quarter, dime, nickel } = data?.opening_float.change || {};

  const { five: closingFive, ten: closingTen, twenty: closingTwenty, fifty: closingFifty, hundred: closingHundred } =
    data?.closing_float.bill || {};
  const { two: closingTwo, one: closingOne, quarter: closingQuarter, dime: closingDime, nickel: closingNickel } =
    data?.closing_float.change || {};
  const drops = data?.drops || [];
  const { shift_lead, notes, float_returned_to_bag, abandoned_change, unsettled_prepay, void_txn, shift_report_cash } =
    data || {};

  if (!worksheet) {
    return <div className="p-4">Worksheet not found.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-4">
        <Button onClick={handleSave} className="mt-2">
          Save
        </Button>

        <Toaster />
        
        <p>
          <strong>Report Number:</strong> {data?.report_number} | <strong>Shift:</strong> {data?.shift} |{' '}
          <strong>Till Location:</strong> {data?.till_location}
        </p>
      </div>
      <hr className="my-4 border-gray-300 border-dashed" />

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-4">
        {/* Opening Float */}
        <div>
          <h2 className="text-lg font-bold mb-2">Opening Float</h2>
          
          <table className="table-auto w-full text-sm border-collapse">
            <thead>
              <tr>
                <td>Bill</td>
                <td></td>
                <td className='w-16'></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$5</td>
                <EditableCell
                  id="five"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={five}
                  onChange={(value) => handleOBillUpdate('five', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(five * 5)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$10</td>
                <EditableCell
                  id="ten"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={ten}
                  onChange={(value) => handleOBillUpdate('ten', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(ten * 10)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$20</td>
                <EditableCell
                  id="twenty"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={twenty}
                  onChange={(value) => handleOBillUpdate('twenty', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(twenty * 20)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$50</td>
                <EditableCell
                  id="fifty"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={fifty}
                  onChange={(value) => handleOBillUpdate('fifty', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(fifty * 50)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$100</td>
                <EditableCell
                  id="hundred"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={hundred}
                  onChange={(value) => handleOBillUpdate('hundred', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(hundred * 100)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-gray-300 px-2 py-1 font-bold">Total</td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 font-bold">
                  ${r?.totalOpeningFloatBill}
                </td>
              </tr>
            </tfoot>
          </table>

          <table className="table-auto w-full text-sm border-collapse">
            <thead>
              <tr>
                <td>Change</td>
                <td></td>
                <td className='w-16'></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$2</td>
                <EditableCell
                  id="two"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={two}
                  onChange={(value) => handleOChangeUpdate('two', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(two * 2).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$1</td>
                <EditableCell
                  id="one"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={one}
                  onChange={(value) => handleOChangeUpdate('one', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(one * 1).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">25c</td>
                <EditableCell
                  id="quarter"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={quarter}
                  onChange={(value) => handleOChangeUpdate('quarter', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(quarter * 0.25).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">10c</td>
                <EditableCell
                  id="dime"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={dime}
                  onChange={(value) => handleOChangeUpdate('dime', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(dime * 0.10).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">5c</td>
                <EditableCell
                  id="nickel"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={nickel}
                  onChange={(value) => handleOChangeUpdate('nickel', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(nickel * 0.05).toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-gray-300 px-2 py-1 font-bold">Total</td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 font-bold">
                  ${r?.totalOpeningFloatChange?.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Opening Cash</td>
                <td className="border border-gray-300 px-2 py-1">
                  ${r?.totalOpeningFloat?.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      {/* Drops */}
      <div className="mt-4">
        <h2 className="text-lg font-bold mb-2">Drops</h2>
        <table className="table-auto w-full text-sm border-collapse border border-gray-300">
          {drops.length === 0 && (
            <tr>
              <td className="border border-gray-300 px-2 py-1" colSpan={2}>
                No drops recorded.
              </td>
            </tr>
          )}
          {drops.length > 0 && (
            <thead>
              <tr>
                <th className="border border-gray-300 px-2 py-1">Time</th>
                <th className="border border-gray-300 px-2 py-1">Amount</th>
                <th className="border border-gray-300 px-2 py-1">Initials</th>
              </tr>
            </thead>
          )}
          <tbody id="dropTable">
            {drops.map((drop: any, index: any) => (
              <tr key={index}>
                <td className="border border-gray-300 px-2 py-1">{drop.time}</td>
                <td className="border border-gray-300 px-2 py-1">{drop.amount}</td>
                <td className="border border-gray-300 px-2 py-1">{drop.initials}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="">
          <form className='flex mt-2' onSubmit={handleDropAdd}>
            <Input className="w-3/4" type="number" id="dropAmount" placeholder="Amount" />
            <Button className="w-1/4">Add Drop</Button>
          </form>
        </div>
      </div>

        {/* Closing Float */}
        <div>
          <h2 className="text-lg font-bold mb-2">Closing Float</h2>

          <table className="table-auto w-full text-sm border-collapse">
            <thead>
              <tr>
                <td>Bill</td>
                <td></td>
                <td className='w-16'></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$5</td>
                <EditableCell
                  id="closingFive"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingFive}
                  onChange={(value) => handleCBillUpdate('five', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingFive * 5)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$10</td>
                <EditableCell
                  id="closingTen"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingTen}
                  onChange={(value) => handleCBillUpdate('ten', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingTen * 10)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$20</td>
                <EditableCell
                  id="closingTwenty"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingTwenty}
                  onChange={(value) => handleCBillUpdate('twenty', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingTwenty * 20)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$50</td>
                <EditableCell
                  id="closingFifty"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingFifty}
                  onChange={(value) => handleCBillUpdate('fifty', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingFifty * 50)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$100</td>
                <EditableCell
                  id="closingHundred"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingHundred}
                  onChange={(value) => handleCBillUpdate('hundred', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingHundred * 100)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-gray-300 px-2 py-1">Total</td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 font-bold">
                  ${r?.totalClosingFloatBill}
                </td>
              </tr>
            </tfoot>
          </table>

          <table className="table-auto w-full text-sm border-collapse">
            <thead>
              <tr>
                <td>Change</td>
                <td></td>
                <td className='w-16'></td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$2</td>
                <EditableCell
                  id="closingTwo"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingTwo}
                  onChange={(value) => handleCChangeUpdate('two', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingTwo * 2).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">$1</td>
                <EditableCell
                  id="closingOne"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingOne}
                  onChange={(value) => handleCChangeUpdate('one', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingOne * 1).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">25c</td>
                <EditableCell
                  id="closingQuarter"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingQuarter}
                  onChange={(value) => handleCChangeUpdate('quarter', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingQuarter * 0.25).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">10c</td>
                <EditableCell
                  id="closingDime"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingDime}
                  onChange={(value) => handleCChangeUpdate('dime', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingDime * 0.10).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-2 py-1">5c</td>
                <EditableCell
                  id="closingNickel"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={closingNickel}
                  onChange={(value) => handleCChangeUpdate('nickel', value)}
                />
                <td className="border border-gray-300 px-2 py-1">${(closingNickel * 0.05).toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="border border-gray-300 px-2 py-1">Total</td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 font-bold">
                  ${r?.totalClosingFloatChange?.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Closing Cash</td>
                <td className="border border-gray-300 px-2 py-1">
                  ${r?.totalClosingFloat?.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Float Returned to Bag</td>
                <EditableCell
                  id="floatReturned"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={float_returned_to_bag}
                  onChange={(value) => handleUpdate('float_returned_to_bag', value)}
                />
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Total Cash for Deposit</td>
                <td className="border border-gray-300 px-2 py-1" id="floatReturned">${r?.totalCashForDeposit.toFixed(2)}</td>
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Total Drops</td>
                <td className="border border-gray-300 px-2 py-1">
                  ${r?.totalDrops.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Total Cash</td>
                <td className="border border-gray-300 px-2 py-1">
                  {r?.totalCash?.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="border border-gray-300 px-2 py-1" colSpan={2}>Shift Report Cash</td>
                <EditableCell
                  id="shiftReportCash"
                  className="border border-gray-300 px-2 py-1"
                  initialValue={shift_report_cash}
                  onChange={(value) => handleUpdate('shift_report_cash', value)}
                />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Other Details */}
      <div className="my-4">
        <h2 className="text-lg font-bold mb-2">Other Details</h2>
        <table className="table-auto w-full text-sm border-collapse border border-gray-300">
          <tbody>
            <tr>
              <td className="border border-gray-300 px-2 py-1 font-bold">Shift Lead</td>
              <td className="border border-gray-300 px-2 py-1">{shift_lead}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1 font-bold">{r?.isShort ? `Short` : `Over`} Amount</td>
              <td className="border border-gray-300 px-2 py-1">${r?.overShortAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1 font-bold">Void</td>
              <EditableCell
                id="voidTxn"
                className="border border-gray-300 px-2 py-1"
                initialValue={void_txn}
                onChange={(value) => handleUpdate('void_txn', value)}
              />
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1 font-bold">Abandoned Change</td>
              <EditableCell
                id="abandonedChange"
                className="border border-gray-300 px-2 py-1"
                initialValue={abandoned_change}
                onChange={(value) => handleUpdate('abandoned_change', value)}
              />
            </tr>
            <tr>
              <td className="border border-gray-300 px-2 py-1 font-bold">Unsettled Prepay</td>
              <EditableCell
                id="unsettledPrepay"
                className="border border-gray-300 px-2 py-1"
                initialValue={unsettled_prepay}
                onChange={(value) => handleUpdate('unsettled_prepay', value)}
              />
            </tr>
            {/* <tr>
              <td className="border border-gray-300 px-2 py-1 font-bold">Notes</td>
              <td className="border border-gray-300 px-2 py-1" id="notes" contentEditable>{notes || ''}</td>
            </tr> */}
          </tbody>
        </table>

        <div className="mt-4">
          <h2 className="text-lg font-bold mb-2">Notes</h2>
          <textarea
            id="notes"
            className="border border-gray-300 px-2 py-1 w-full h-32"
            value={notes}
            onChange={(e) => handleUpdate('notes', e.target.value)}
          ></textarea>
        </div>
      </div>
    </div>
  );
}