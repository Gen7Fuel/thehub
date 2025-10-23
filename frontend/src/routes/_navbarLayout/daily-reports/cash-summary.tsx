import { DatePicker } from '@/components/custom/datePicker'
import { LocationPicker } from '@/components/custom/locationPicker'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { calculateData, toUTCstring } from '@/lib/utils'
import EditableCell from '@/components/custom/editableCell'
import { Button } from '@/components/ui/button'
import { pdf } from '@react-pdf/renderer';
import { CashSummaryPDF } from '@/components/custom/CashSummaryPDF'; // Adjust path as needed
import axios from "axios"
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute(
  '/_navbarLayout/daily-reports/cash-summary',
)({
  component: RouteComponent,
})

interface CashSummary {
  cash_summary: {
    hand_held_debit: number;
    name: string;
    managers_notes: string;
  } | null;
  worksheets: Worksheet[];
  purchase_orders: PurchaseOrder[];
  payables: Payable[];
}

interface Worksheet {
  opening_float: FloatDetails;
  closing_float: FloatDetails;
  _id: string;
  report_number: number;
  shift: string;
  shift_lead: string;
  till_location: string;
  location: string;
  short: boolean;
  over_short_amount: number;
  notes: string;
  float_returned_to_bag: number;
  void: number;
  abandoned_change: number;
  unsettled_prepay: number;
  shift_report_cash: number;
  date: string;
  drops: Drop[];
  createdAt: string;
  updatedAt: string;
  __v: number;
  void_txn?: number; // Optional field
}

interface FloatDetails {
  bill: {
    five: number;
    ten: number;
    twenty: number;
    fifty: number;
    hundred: number;
  };
  change: {
    one: number;
    two: number;
    quarter: number;
    dime: number;
    nickel: number;
  };
}

interface Drop {
  time: string;
  amount: number;
  initials: string;
  _id: string;
}

interface PurchaseOrder {
  _id: string;
  fleetCardNumber: string;
  customerName: string;
  amount: number;
  productCode: string;
  quantity: number;
  date: string;
  stationName: string;
}

interface Payable {
  _id: string;
  vendorName: string;
  amount: number;
  paymentMethod: string;
  notes: string;
  date: string;
  stationName: string;
}

function RouteComponent() {
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [data, setData] = useState<CashSummary>({
    cash_summary: null,
    worksheets: [],
    purchase_orders: [],
    payables: [],
  });
  const { user } = useAuth()
  const [location, setLocation] = useState<string>(user?.location || '')
  const [totals, setTotals] = useState({
    totalShiftReportCash: 0,
    totalCalculatedCash: 0,
    totalOverShort: 0,
  })

  const fetchCashSummary = async () => {
    if (!date || !location) {
      alert('Please select both date and location.')
      return
    }

    try {
      const response = await axios.get(`/api/cash-summary`, {
        params: {
          startDate: toUTCstring(date.toISOString().split('T')[0] + 'T00:00:00.000Z'),
          endDate: toUTCstring(date.toISOString().split('T')[0] + 'T23:59:59.999Z'),
          location,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      const result = response.data

      // Ensure cash_summary has default values if null
      const processedResult = {
        ...result,
        cash_summary: result.cash_summary || {
          hand_held_debit: 0,
          name: '',
          managers_notes: '',
        }
      };

      setData(processedResult)

      // Calculate totals
      let totalShiftReportCash = 0
      let totalCalculatedCash = 0
      let totalOverShort = 0

      result.worksheets.forEach((item: any) => {
        const calculated = calculateData(item)
        totalShiftReportCash += item.shift_report_cash
        totalCalculatedCash += calculated.totalCash
        totalOverShort += calculated.isShort
          ? -calculated.overShortAmount
          : calculated.overShortAmount
      })

      setTotals({
        totalShiftReportCash,
        totalCalculatedCash,
        totalOverShort,
      })
    } catch (error) {
      console.error('Error fetching cash summary:', error)
      setData({
        cash_summary: {
          hand_held_debit: 0,
          name: '',
          managers_notes: '',
        },
        worksheets: [],
        purchase_orders: [],
        payables: [],
      })
      setTotals({
        totalShiftReportCash: 0,
        totalCalculatedCash: 0,
        totalOverShort: 0,
      })
    }
  }

  const createCashSummary = async () => {
    try {
      await axios.post('/api/cash-summary', {
        name: user?.name,
        location,
        date: date?.toISOString(),
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
    } catch (error) {
      console.error('Error creating cash summary:', error)
      // alert('Failed to create cash summary');
    }
  }

  useEffect(() => {
    createCashSummary()
    fetchCashSummary()
  }, [date, location])

  if (!data) {
    return <div>Loading...</div>
  }

  const handleSave = async () => {
    try {
      await axios.put('/api/cash-summary', {
        startDate: toUTCstring(date?.toISOString().split('T')[0] + 'T00:00:00.000Z'),
        endDate: toUTCstring(date?.toISOString().split('T')[0] + 'T23:59:59.999Z'),
        // date: date ? date.toISOString().split('T')[0] : '',
        location,
        hand_held_debit: data.cash_summary?.hand_held_debit || 0,
        managers_notes: data.cash_summary?.managers_notes || '',
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })
      alert('Cash summary saved successfully!')
    } catch (error) {
      console.error('Error saving cash summary:', error)
      alert('Failed to save cash summary')
    }
  }

  console.log('Data:', {
    ...data,
    cash_summary: {
      ...data.cash_summary,
      date,
      location,
    },
  })

  // const access = user?.access || '{}'

  // Calculate totals for purchase orders and payables
  const purchaseOrderTotal = data.purchase_orders?.reduce((sum, po) => sum + po.amount, 0) || 0
  const payablesTotal = data.payables?.reduce((sum, payable) => sum + payable.amount, 0) || 0

  const handlePDF = async () => {
    const blob = await pdf(
      <CashSummaryPDF
        data={data}
        date={date}
        location={location}
        totals={totals}
        purchaseOrderTotal={purchaseOrderTotal}
        payablesTotal={payablesTotal}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div>
      <div className='flex justify-between mb-4'>
        <Button onClick={handleSave}>
          Save
        </Button>
        <Button onClick={handlePDF}>
          PDF
        </Button>
      </div>

      <div className='flex flex-row gap-4 mb-4'>
        <DatePicker date={date} setDate={setDate} />
        <LocationPicker
          setStationName={setLocation}
          value="stationName"
          // {...(!access.component_po_location_filter ? { disabled: true } : {})}
        />
      </div>

      <div className='mt-4'>
        {data.worksheets && data.worksheets.length > 0 ? (
          <table className='table-auto w-full text-sm border-collapse border border-gray-300'>
            <thead>
              <tr>
                <th className='border border-gray-300 px-2 py-1 w-1/4'>Canadian Cash</th>
                <th className='border border-gray-300 px-2 py-1 w-1/4'>AM</th>
                <th className='border border-gray-300 px-2 py-1 w-1/4'>PM</th>
                <th className='border border-gray-300 px-2 py-1 w-1/4'>Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group worksheets by report_number
                const groupedByReport = data.worksheets.reduce((acc: any, item: any) => {
                  if (!acc[item.report_number]) {
                    acc[item.report_number] = {};
                  }
                  acc[item.report_number][item.shift] = item;
                  return acc;
                }, {});

                return Object.keys(groupedByReport).map((reportNumber) => {
                  const amData = groupedByReport[reportNumber]['AM'];
                  const pmData = groupedByReport[reportNumber]['PM'];
                  
                  const amCalculated = amData ? calculateData(amData) : null;
                  const pmCalculated = pmData ? calculateData(pmData) : null;
                  
                  const totalShiftReportCash = (amData?.shift_report_cash || 0) + (pmData?.shift_report_cash || 0);
                  const totalCalculatedCash = (amCalculated?.totalCash || 0) + (pmCalculated?.totalCash || 0);

                  return (
                    <tr key={reportNumber}>
                      <td className='border border-gray-300 px-2 py-1'>${totalShiftReportCash.toFixed(2)}</td>
                      <td className='border border-gray-300 px-2 py-1'>
                        {amData ? `$${amCalculated?.totalCash.toFixed(2)}` : '-'}
                      </td>
                      <td className='border border-gray-300 px-2 py-1'>
                        {pmData ? `$${pmCalculated?.totalCash.toFixed(2)}` : '-'}
                      </td>
                      <td className='border border-gray-300 px-2 py-1'>
                        ${totalCalculatedCash.toFixed(2)}
                      </td>
                    </tr>
                  );
                });
              })()}
              <tr>
                <td className='border border-gray-300 px-2 py-1 font-bold'>
                  ${totals.totalShiftReportCash.toFixed(2)}
                </td>
                <td className='border border-gray-300 px2 py1 font-bold'></td>
                <td className='border border-gray-300 px2 py1 font-bold'></td>
                <td className='border border-gray-300 px-2 py-1 font-bold'>
                  ${totals.totalCalculatedCash.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p>No data available. Please provide valid filters and fetch.</p>
        )}
      </div>

      <table className='table-auto w-full text-sm border-collapse border border-gray-300 mt-4'>
        <tbody>
          <tr>
            <td className='border border-gray-300 px-2 py-1'>Shift Report Cash</td>
            <td className='border border-gray-300 px-2 py-1'>{totals.totalShiftReportCash.toFixed(2)}</td>
          </tr>

          <tr>
            <td className='border border-gray-300 px-2 py-1'>Handheld Debit</td>
            <EditableCell
              className="px-2 py-1"
              initialValue={data.cash_summary?.hand_held_debit || 0}
              id="hand_held_debit"
              onChange={(value: string | number) => {
                const numericValue = typeof value === 'string' ? parseFloat(value) : value;
                setData((prevData) => ({
                  ...prevData,
                  cash_summary: {
                    ...prevData.cash_summary,
                    hand_held_debit: numericValue,
                    name: prevData.cash_summary?.name || '',
                    managers_notes: prevData.cash_summary?.managers_notes || '',
                  },
                }))
              }}
            />
          </tr>

          <tr>
            <td className='border border-gray-300 px-2 py-1'>Net Total Cash</td>
            <td className='border border-gray-300 px-2 py-1'>{(totals.totalShiftReportCash - (data.cash_summary?.hand_held_debit || 0)).toFixed(2)}</td>
          </tr>

          <tr>
            <td className='border border-gray-300 px-2 py-1'>Total Calculated Cash</td>
            <td className='border border-gray-300 px-2 py-1'>{totals.totalCalculatedCash.toFixed(2)}</td>
          </tr>

          <tr>
            <td className='border border-gray-300 px-2 py-1'>Total Over/Short Amount</td>
            <td className='border border-gray-300 px-2 py-1'>
              {(totals.totalOverShort - (data.cash_summary?.hand_held_debit || 0)).toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className='text-lg font-bold mt-6 mb-2'>Manager's Notes</h2>
      <textarea
        className='w-full h-32 border border-gray-300 p-2'
        placeholder='Enter your notes here...'
        value={data.cash_summary?.managers_notes || ''}
        onChange={(e) => {
          setData((prevData) => ({
            ...prevData,
            cash_summary: {
              ...prevData.cash_summary,
              hand_held_debit: prevData.cash_summary?.hand_held_debit || 0,
              name: prevData.cash_summary?.name || '',
              managers_notes: e.target.value,
            },
          }))
        }}
      />

      {/* Accounts Receivable Section */}
      <h2 className='text-lg font-bold mt-6 mb-2'>Accounts Receivable</h2>
      {data.purchase_orders && data.purchase_orders.length > 0 ? (
        <div>
          <table className='table-auto w-full text-sm border-collapse border border-gray-300'>
            <thead>
              <tr>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Customer Name</th>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Product</th>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Quantity</th>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.purchase_orders.map((po, index) => (
                <tr key={po._id || index}>
                  <td className='border border-gray-300 px-2 py-1'>{po.customerName}</td>
                  <td className='border border-gray-300 px-2 py-1'>{po.productCode}</td>
                  <td className='border border-gray-300 px-2 py-1'>{po.quantity}</td>
                  <td className='border border-gray-300 px-2 py-1'>${po.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className='bg-gray-50'>
                <td colSpan={3} className='border border-gray-300 px-2 py-1 font-bold text-right'>
                  Total Accounts Receivable:
                </td>
                <td className='border border-gray-300 px-2 py-1 font-bold'>
                  ${purchaseOrderTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className='text-gray-500 italic'>No purchase order transactions for this date and location.</p>
      )}

      {/* Accounts Payable Section */}
      <h2 className='text-lg font-bold mt-6 mb-2'>Accounts Payable</h2>
      {data.payables && data.payables.length > 0 ? (
        <div>
          <table className='table-auto w-full text-sm border-collapse border border-gray-300'>
            <thead>
              <tr>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Vendor Name</th>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Payment Method</th>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Notes</th>
                <th className='border border-gray-300 px-2 py-1 bg-gray-100'>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.payables.map((payable, index) => (
                <tr key={payable._id || index}>
                  <td className='border border-gray-300 px-2 py-1'>{payable.vendorName}</td>
                  <td className='border border-gray-300 px-2 py-1'>{payable.paymentMethod}</td>
                  <td className='border border-gray-300 px-2 py-1'>{payable.notes || '-'}</td>
                  <td className='border border-gray-300 px-2 py-1'>${payable.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className='bg-gray-50'>
                <td colSpan={3} className='border border-gray-300 px-2 py-1 font-bold text-right'>
                  Total Accounts Payable:
                </td>
                <td className='border border-gray-300 px-2 py-1 font-bold'>
                  ${payablesTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className='text-gray-500 italic'>No payable transactions for this date and location.</p>
      )}
    </div>
  );
}