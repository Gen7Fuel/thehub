import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { DatePicker } from '@/components/custom/datePicker';
import { Button } from '@/components/ui/button';
import { LocationPicker } from '@/components/custom/locationPicker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { applyComma, snakeToTitleCase } from '@/lib/utils';
import axios from "axios"

interface SalesSummaryData {
  fuel_sales: {
    [fuelType: string]: {
      volume: number;
      of_volume: number;
      retail: number | string;
      sales: number;
      fuel_loyalty_volume: number;
      fuel_loyalty: number;
      stick_reading: number;
    };
  };
  totals: {
    total_volume_ss: number;
    total_sales_ss: number;
    total_fuel_loyalty_ss: number;
    net_dpt_sales: number;
    lottery_net_sales: number;
    penny_rounding: number;
    total_sales: number;
    taxable_sales: number;
    taxes_collected: number;
    total_other_revenue: number;
    total_revenue: number;
    total_cash_pay_out: number;
    total_store_expenses: number;
    paid_in: number;
    total_money_due: number;
    adjusted_total_money_due: number;
    money_orders_sales: number;
    car_wash_sales: number;
  };
  credit_debit: {
    [key: string]: number;
    fuel_discount: number;
    total_credit: number;
    gift_cards: number;
    loyalty_redemption: number;
  };
  house_account: {
    total: number;
    // accounts: { customerName: string; amount: number }[];
  };
  cash: {
    [key: string]: number;
  };
  coupons: {
    coupons: number;
    total_coupons: number;
  };
  food_stamps: {
    food_stamps: number;
    total_food_stamps: number;
  };
}

export const Route = createFileRoute('/_navbarLayout/reports/sales-summary/')({
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
})

function RouteComponent() {
  const [data, setData] = useState<SalesSummaryData | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [stationNumber, setStationNumber] = useState<string>('');
  const navigate = useNavigate()

  const fetchReport = async () => {
    if (!date || !stationNumber) return;
    console.log(date.toISOString(), stationNumber)
    try {
      // add authorization header with bearer token
      const response = await axios.get(`/api/sales-summary/${date.toISOString().split('T')[0]}/${stationNumber}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "reports"
        }
      });
      setData(response.data);
      console.log('Sales Summary Data:', response.data);
    } catch (error: any) {
      if (error.response?.status === 403) {
          // Redirect to no-access page
          navigate({ to: "/no-access" });
      } else {
        console.error('Error fetching sales summary:', error);
      } 
    }
  }

  return (
    <>
    <div className='flex flex-row gap-4'>
      <DatePicker date={date} setDate={setDate} />

      <LocationPicker
        setStationName={setStationNumber}
        value='csoCode'
      />

      <Button onClick={fetchReport}>Fetch</Button>
    </div>

    <h2 className='text-xl font-bold mt-4'>Sales Summary</h2>

    {data && (
      <>
      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Fuel Sales</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-center">% of Volume</TableHead>
            <TableHead className="text-center">Retail</TableHead>
            <TableHead className="text-right">Sales, $</TableHead>
            <TableHead className="text-center">Fuel Loyalty Volume</TableHead>
            <TableHead className="text-center">Fuel Loyalty, $</TableHead>
            <TableHead className="text-right">Stick Reading</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(data.fuel_sales ?? {}).map(([fuelType, details], index) => {
            const d = details as {
              volume: number;
              of_volume: number;
              retail: number | string;
              sales: number;
              fuel_loyalty_volume: number;
              fuel_loyalty: number;
              stick_reading: number;
            };
            return (
              <TableRow key={index}>
                <TableCell>{fuelType.toUpperCase()}</TableCell>
                <TableCell className="text-right">{applyComma(d.volume, 3)}</TableCell>
                <TableCell className="text-center">{(d.of_volume * 100).toFixed(2)}%</TableCell>
                <TableCell className="text-center">{d.retail}</TableCell>
                <TableCell className="text-right">{applyComma(d.sales, 2)}</TableCell>
                <TableCell className="text-center">{applyComma(d.fuel_loyalty_volume, 3)}</TableCell>
                <TableCell className="text-center">{applyComma(d.fuel_loyalty, 3)}</TableCell>
                <TableCell className="text-right">{applyComma(d.stick_reading)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="border-t-4 border-black">
            <TableCell>Total Self Service</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.total_volume_ss, 3)}</TableCell>
            <TableCell className="text-center">100.00%</TableCell>
            <TableCell />
            <TableCell className="text-right">{applyComma(data.totals.total_sales_ss, 2)}</TableCell>
            <TableCell />
            <TableCell className="text-center">{data.totals.total_fuel_loyalty_ss}</TableCell>
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell>Total Fuel</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.total_volume_ss, 3)}</TableCell>
            <TableCell className="text-center">(100%)</TableCell>
            <TableCell />
            <TableCell className="text-right">{applyComma(data.totals.total_sales_ss, 2)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell>Net Dpt. Sales</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right">{applyComma(data.totals.net_dpt_sales, 2)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell>Lottery Net Sales</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right">{applyComma(data.totals.lottery_net_sales, 2)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell>Money Orders Sales</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right">{applyComma(data.totals.money_orders_sales ?? 0, 2)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell>Car Wash Sales</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right">{applyComma(data.totals.car_wash_sales ?? 0, 2)}</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell>Penny Rounding</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right">
              {data.totals.penny_rounding < 0
                ? `(${applyComma(Math.abs(data.totals.penny_rounding), 2)})`
                : applyComma(data.totals.penny_rounding, 2)}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell className="font-bold">Total Sales, $</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right font-bold">
              {applyComma(
                (data.totals.total_sales ?? 0) - (data.credit_debit.fuel_discount ?? 0),
                2
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="text-center font-bold">Taxable Sales, $</TableHead>
            <TableHead className="text-center font-bold">Taxes Collected On, $</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="text-center">
              {data.totals.taxable_sales < 0
                ? `(${applyComma(Math.abs(data.totals.taxable_sales), 2)})`
                : applyComma(data.totals.taxable_sales, 2)}
            </TableCell>
            <TableCell className="text-center">
              {applyComma(data.totals.taxes_collected, 2)}
            </TableCell>
          </TableRow>
          <TableRow className="border-t-4 border-black">
            <TableCell className="font-bold">Total Other Revenue, $</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.total_other_revenue, 2)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-bold">Total Revenue, $</TableCell>
            <TableCell className="text-right font-bold">{applyComma(data.totals.total_revenue, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableBody>
          <TableRow>
            <TableCell>Total Cash Pay Out, $</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.total_cash_pay_out, 2)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Total Store Expenses, $</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.total_store_expenses, 2)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Paid In, $</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.paid_in, 2)}</TableCell>
          </TableRow>
          <TableRow className="font-bold bg-gray-100">
            <TableCell>Total Money Due, $</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.total_money_due, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">Credit/Debit</TableHead>
            <TableHead className="text-right font-bold">Value, $</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(data.credit_debit)
            .filter(([key]) => key !== "total_credit")
            .map(([key, value], _idx) => (
              <TableRow key={key}>
                <TableCell>{snakeToTitleCase(key)}</TableCell>
                <TableCell className="text-right">{applyComma(value, 2)}</TableCell>
              </TableRow>
            ))}
          <TableRow className="border-t-4 border-black font-bold">
            <TableCell>Total Credit</TableCell>
            <TableCell className="text-right">{applyComma(data.credit_debit.total_credit, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">House Account</TableHead>
            <TableHead className="text-right font-bold">Value, $</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>House Account</TableCell>
            <TableCell className="text-right">{applyComma(data.house_account.total, 2)}</TableCell>
          </TableRow>
          <TableRow className="border-t-4 border-black font-bold">
            <TableCell>Total House Account</TableCell>
            <TableCell className="text-right">{applyComma(data.house_account.total, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">Cash</TableHead>
            <TableHead className="text-right font-bold">Value, $</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.entries(data.cash)
            .filter(([key]) => !key.toLowerCase().includes("total_cash"))
            .map(([key, value], _idx) => (
              <TableRow key={key}>
                <TableCell>{snakeToTitleCase(key)}</TableCell>
                <TableCell className="text-right">{applyComma(value, 2)}</TableCell>
              </TableRow>
            ))}
          <TableRow className="border-t-4 border-black font-bold">
            <TableCell>Total Cash In</TableCell>
            <TableCell className="text-right">{applyComma(data.cash.total_cash_in, 2)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Refunds To Prepaids</TableCell>
            <TableCell className="text-right">{applyComma(data.cash.refunds_to_prepaids ?? 0, 2)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Cash Paid Out</TableCell>
            <TableCell className="text-right">{applyComma(data.cash.cash_paid_out ?? 0, 2)}</TableCell>
          </TableRow>
          <TableRow className="border-t-4 border-black font-bold">
            <TableCell>Total Cash Out</TableCell>
            <TableCell className="text-right">{applyComma(data.cash.total_cash_out, 2)}</TableCell>
          </TableRow>
          <TableRow className="font-bold">
            <TableCell>Total Cash</TableCell>
            <TableCell className="text-right">{applyComma(data.cash.total_cash, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">Coupons</TableHead>
            <TableHead className="text-right font-bold">Value, $</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
        
          <TableRow>
            <TableCell>Coupons</TableCell>
            <TableCell className="text-right">{applyComma(data.coupons.coupons, 2)}</TableCell>
          </TableRow>
          <TableRow className="border-t-4 border-black font-bold">
            <TableCell>Total Coupons</TableCell>
            <TableCell className="text-right">{applyComma(data.coupons.total_coupons ?? 0, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">Food Stamps</TableHead>
            <TableHead className="text-right font-bold">Value, $</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
        
          <TableRow>
            <TableCell>Food Stamps</TableCell>
            <TableCell className="text-right">{applyComma(data.food_stamps.food_stamps, 2)}</TableCell>
          </TableRow>
          <TableRow className="border-t-4 border-black font-bold">
            <TableCell>Total Food Stamps</TableCell>
            <TableCell className="text-right">{applyComma(data.food_stamps.total_food_stamps ?? 0, 2)}</TableCell>
          </TableRow>
          <TableRow className="font-bold">
            <TableCell>Adjusted Total Money Due</TableCell>
            <TableCell className="text-right">{applyComma(data.totals.adjusted_total_money_due ?? 0, 2)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </>
    )}

    </>
  )
}


// OLD CODE
    // {salesSummary ? (
    // <Stack gap="5">
    //     <Table.Root size="sm" variant="outline">
    //     <Table.Header>
    //         <Table.Row>
    //             <Table.ColumnHeader>Fuel Sales</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="end">Volume</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="center">%-of-Volume</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="center">Retail</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="end">Sales, $</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="center">Fuel Loyalty Volume</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="center">Fuel Loyalty, $</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="end">Stick Reading</Table.ColumnHeader>
    //         </Table.Row>
    //     </Table.Header>
    //     <Table.Body>
    //         {Object.entries(salesSummary.fuel_sales).map(([ fuelType, details ], index, array) => (
    //             <Table.Row key={index}>
    //                 <Table.Cell>{ fuelType.toUpperCase() }</Table.Cell>
    //                 <Table.Cell textAlign="end">{ applyComma(details.volume, 3) }</Table.Cell>
    //                 <Table.Cell textAlign="center">{ ( details.of_volume * 100 ).toFixed(2) }%</Table.Cell>
    //                 <Table.Cell textAlign="center">{ details.retail }</Table.Cell>
    //                 <Table.Cell textAlign="end">{ applyComma(details.sales, 2) }</Table.Cell>
    //                 <Table.Cell textAlign="center">{ applyComma(details.fuel_loyalty_volume, 3) }</Table.Cell>
    //                 <Table.Cell textAlign="center">{ applyComma(details.fuel_loyalty, 3) }</Table.Cell>
    //                 <Table.Cell textAlign="end">{ applyComma(details.stick_reading) }</Table.Cell>
    //             </Table.Row>
    //         ))}

    //         <Table.Row style={{ borderTop: "3px solid black", borderBottom: "none" }}>
    //             <Table.Cell>Total Self Service</Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.total_volume_ss, 3) }</Table.Cell>
    //             <Table.Cell textAlign="center">100.00%</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.total_sales_ss, 2) }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="center">{ salesSummary.totals.total_fuel_loyalty_ss }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell>Total Fuel</Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.total_volume_ss, 3) }</Table.Cell>
    //             <Table.Cell textAlign="center">(100%)</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.total_sales_ss, 2) }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //     </Table.Body>
    //         <Table.Row>
    //             <Table.Cell>Net Dpt. Sales</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.net_dpt_sales, 2)}</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell>Lottery Net Sales</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.lottery_net_sales, 2) }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell>Fuel Discount</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">({ applyComma(salesSummary.credit_debit.fuel_discount, 2) })</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //         {/* <Table.Row>
    //             <Table.Cell>Money Orders Sales</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.money_orders_sales, 2) }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell>Car Wash Sales</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.car_wash_sales, 2) }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row> */}
    //         <Table.Row>
    //             <Table.Cell>Penny Rounding</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="end">{ salesSummary.totals.penny_rounding < 0 ? `(${applyComma(salesSummary.totals.penny_rounding * -1, 2)})` : applyComma(salesSummary.totals.penny_rounding, 2) }</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //         </Table.Row>
    //     <Table.Footer>
    //         <Table.Row style={{ background: "#F4F4F4" }}>
    //             <Table.Cell>Total Sales, $</Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell></Table.Cell>
    //             <Table.Cell textAlign="right">{ salesSummary.totals.total_sales - salesSummary.credit_debit.fuel_discount }</Table.Cell>
    //         </Table.Row>
    //     </Table.Footer>
    //     </Table.Root>

    //     <Text>Other Revenue</Text>

    //     <Table.Root size="sm" variant="outline">
    //     <Table.Header>
    //         <Table.Row>
    //             <Table.ColumnHeader textAlign="center">Taxable Sales, $</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="center">Taxes Collected</Table.ColumnHeader>
    //         </Table.Row>
    //     </Table.Header>
    //     <Table.Body>
    //         <Table.Row style={{ borderBottom: "3px solid black" }}>
    //             <Table.Cell textAlign="center">{ applyComma(salesSummary.totals.taxable_sales, 2) }</Table.Cell>
    //             <Table.Cell textAlign="center">{ salesSummary.totals.taxes_collected.toFixed(2) }</Table.Cell>
    //         </Table.Row>
    //         <Table.Row style={{ borderTop: "2px solid black" }}>
    //             <Table.Cell>Total Other Revenue, $</Table.Cell>
    //             <Table.Cell textAlign="right">{ salesSummary.totals.total_other_revenue }</Table.Cell>
    //         </Table.Row>
    //     </Table.Body>
    //     <Table.Footer>
    //         <Table.Row>
    //             <Table.Cell>Total Revenue, $</Table.Cell>
    //             <Table.Cell textAlign="right">{ salesSummary.totals.total_revenue }</Table.Cell>
    //         </Table.Row>
    //     </Table.Footer>
    //     </Table.Root>

    //     <Text>Expenses</Text>
    //     <Table.Root size="sm" variant="line">
    //     <Table.Body>
    //         <Table.Row>
    //             <Table.Cell>Total Cash Pay Out, $</Table.Cell>
    //             <Table.Cell>{ applyComma(salesSummary.totals.total_cash_pay_out, 2) }</Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell>Total Store Expenses, $</Table.Cell>
    //             <Table.Cell textAlign="end">{ applyComma(salesSummary.totals.total_store_expenses, 2) }</Table.Cell>
    //         </Table.Row>
    //         <Table.Row>
    //             <Table.Cell>Paid In, $</Table.Cell>
    //             <Table.Cell textAlign="right">{ salesSummary.totals.paid_in }</Table.Cell>
    //         </Table.Row>
    //     </Table.Body>
    //     <Table.Footer>
    //         <Table.Row style={{ background: "#F4F4F4" }}>
    //             <Table.Cell>Total Money Due</Table.Cell>
    //             <Table.Cell textAlign="right">{ salesSummary.totals.total_money_due }</Table.Cell>
    //         </Table.Row>
    //     </Table.Footer>
    //     </Table.Root>

    //     <Text>Credit Sales</Text>

    //     <Table.Root variant="outline">
    //     <Table.Header>
    //         <Table.ColumnHeader>Credit/Debit</Table.ColumnHeader>
    //         <Table.ColumnHeader textAlign="end">Value, $</Table.ColumnHeader>
    //     </Table.Header>
    //     <Table.Body>
    //         {/* {Object.entries(salesSummary.credit_debit).slice(0, -1).map((item, index) => (
    //             item[0] !== "fuel_discount" && (
    //                 <Table.Row key={index}>
    //                     <Table.Cell>{snakeToTitleCase(item[0])}</Table.Cell>
    //                     <Table.Cell textAlign="right">{applyComma(item[1], 2)}</Table.Cell>
    //                 </Table.Row>
    //             )
    //         ))} */}

    //         {Object.entries(salesSummary.credit_debit).slice(0, -1).map((item, index) => (
    //             !["fuel_discount", "gift_cards", "loyalty_redemption"].includes(item[0]) && (
    //                 <Table.Row key={index}>
    //                 <Table.Cell>{snakeToTitleCase(item[0])}</Table.Cell>
    //                 <Table.Cell textAlign="right">{applyComma(item[1], 2)}</Table.Cell>
    //                 </Table.Row>
    //             )
    //         ))}
    //         {/* Use the following code when all three issues below are resolved */}
    //         {/* {Object.entries(salesSummary.credit_debit).slice(0, -1).map((item, index) => (
    //         !["fuel_discount", "gift_cards", "loyalty_redemption"].includes(item[0]) && (
    //             <Table.Row key={index}>
    //             <Table.Cell>{snakeToTitleCase(item[0])}</Table.Cell>
    //             <Table.Cell textAlign="right">{applyComma(item[1], 2)}</Table.Cell>
    //             </Table.Row>
    //         )
    //         ))} */}
    //     </Table.Body>
    //     <Table.Footer>
    //         <Table.Row style={{ background: "#F4F4F4", borderTop: "3px solid black" }}>
    //             <Table.Cell>Bank Deposit</Table.Cell>
    //             <Table.Cell textAlign="right">{applyComma(salesSummary.credit_debit.total_credit - salesSummary.credit_debit.fuel_discount, 2)}</Table.Cell>
    //         </Table.Row>
    //     </Table.Footer>
    //     </Table.Root>

    //     <Table.Root variant="outline">
    //     <Table.Header>
    //         <Table.Row>
    //             <Table.ColumnHeader>Others</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="right">Value, $</Table.ColumnHeader>
    //         </Table.Row>
    //     </Table.Header>
    //     <Table.Body>
    //         {Object.entries(salesSummary.credit_debit).slice(0, -1).map((item, index) => (
    //             ["gift_cards", "loyalty_redemption"].includes(item[0]) && (
    //                 <Table.Row key={index}>
    //                 <Table.Cell>{snakeToTitleCase(item[0])}</Table.Cell>
    //                 <Table.Cell textAlign="right">{applyComma(item[1], 2)}</Table.Cell>
    //                 </Table.Row>
    //             )
    //         ))}
    //     </Table.Body>
    //     <Table.Footer>
    //         <Table.Row style={{ borderTop: "3px solid black" }}>
    //             <Table.Cell>Total Credit Sales</Table.Cell>
    //             <Table.Cell textAlign="right">{applyComma((salesSummary.credit_debit.gift_cards + salesSummary.credit_debit.loyalty_redemption), 2)}</Table.Cell>
    //         </Table.Row>
    //     </Table.Footer>
    //     </Table.Root>

    //     {/* House Account */}
    //     <Table.Root size="sm" variant="outline">
    //     <Table.Header>
    //         <Table.Row>
    //             <Table.ColumnHeader>House Account</Table.ColumnHeader>
    //             <Table.ColumnHeader textAlign="right">Value, $</Table.ColumnHeader>
    //         </Table.Row>
    //     </Table.Header>
    //     <Table.Body>
    //     <For each={data}>
    //         {(item, index) => (
    //             <Table.Row key={index}>
    //                 <Table.Cell>{item.customerName}</Table.Cell>
    //                 <Table.Cell textAlign="right">{applyComma(item.amount, 2)}</Table.Cell>
    //             </Table.Row>
    //         )}
    //     </For>
    //     </Table.Body>
    //     <Table.Footer>
    //         <Table.Row style={{ borderTop: "3px solid black" }}>
    //             <Table.Cell>Total House Account</Table.Cell>
    //             <Table.Cell textAlign="right">{ applyComma(salesSummary.house_account.total, 2) }</Table.Cell>
    //         </Table.Row>
    //     </Table.Footer>
    //     </Table.Root>

    //     <Text>Cash Sales</Text>

    //     <Table.Root size="sm" variant="outline">
    //         <Table.Header>
    //             <Table.Row>
    //                 <Table.ColumnHeader>Cash</Table.ColumnHeader>
    //                 <Table.ColumnHeader textAlign="right">Value, $</Table.ColumnHeader>
    //             </Table.Row>
    //         </Table.Header>
    //         <Table.Body>
    //             {Object.entries(salesSummary.cash).map(([key, value], index, array) => {
    //                 const isTotalCash = key.includes("total_cash_");
    //                 const isLastEntry = index === array.length - 1;
    //                 const style = {
    //                 ...(isTotalCash && { fontWeight: "bold", borderTop: "3px solid black" }),
    //                 ...(isLastEntry && { marginTop: "10px", fontWeight: "bold" })
    //                 };

    //                 return (
    //                 <Table.Row key={index} style={style}>
    //                     <Table.Cell>{snakeToTitleCase(key)}</Table.Cell>
    //                     <Table.Cell textAlign="right">{applyComma(value, 2)}</Table.Cell>
    //                 </Table.Row>
    //                 );
    //             })}
    //         </Table.Body>
    //     </Table.Root>

    // <Table.Root size="sm" variant="outline">
    // <Table.Header>
    //     <Table.Row>
    //     <Table.ColumnHeader>Cash</Table.ColumnHeader>
    //     <Table.ColumnHeader textAlign="right">Value, $</Table.ColumnHeader>
    //     </Table.Row>
    // </Table.Header>
    // <Table.Body>
    //     {Object.entries(salesSummary.cash).map(([key, value], index, array) => {
    //     const isTotalCash = key.includes("total_cash_");
    //     const isLastEntry = index === array.length - 1;
    //     const style = {
    //         ...(isTotalCash && { fontWeight: "bold", borderTop: "3px solid black" }),
    //         ...(isLastEntry && { marginTop: "10px", fontWeight: "bold" })
    //     };

    //     return (
    //         <Table.Row key={index} style={style}>
    //         <Table.Cell>{snakeToTitleCase(key)}</Table.Cell>
    //         <Table.Cell textAlign="right">{applyComma(value, 2)}</Table.Cell>
    //         </Table.Row>
    //     );
    //     })}
    // </Table.Body>
    // </Table.Root>

    // <Table.Root size="sm" variant="outline">
    // <Table.Header>
    //     <Table.Row>
    //     <Table.ColumnHeader>Coupons</Table.ColumnHeader>
    //     <Table.ColumnHeader textAlign="right">Value, $</Table.ColumnHeader>
    //     </Table.Row>
    // </Table.Header>
    // <Table.Body>
    //     {Object.entries(salesSummary.coupons).map(([key, value], index, array) => {
    //     const isTotalCoupons = key.includes("total_coupons");
    //     const isLastEntry = index === array.length - 1;
    //     const style = {
    //         ...(isTotalCoupons && { fontWeight: "bold", borderTop: "3px solid black" }),
    //         ...(isLastEntry && { marginTop: "10px", fontWeight: "bold" })
    //     };

    //     return (
    //         <Table.Row key={index} style={style}>
    //         <Table.Cell>{snakeToTitleCase(key)}</Table.Cell>
    //         <Table.Cell textAlign="right">{applyComma(value, 2)}</Table.Cell>
    //         </Table.Row>
    //     );
    //     })}
    // </Table.Body>
    // </Table.Root>

    // <Table.Root size="sm" variant="outline">
    // <Table.Header>
    //     <Table.Row>
    //     <Table.ColumnHeader>Food Stamps</Table.ColumnHeader>
    //     <Table.ColumnHeader textAlign="right">Value, $</Table.ColumnHeader>
    //     </Table.Row>
    // </Table.Header>
    // <Table.Body>
    //     {Object.entries(salesSummary.food_stamps).map(([key, value], index, array) => {
    //     const isTotalFoodStamps = key.includes("total_food_stamps");
    //     const isLastEntry = index === array.length - 1;
    //     const style = {
    //         ...(isTotalFoodStamps && { fontWeight: "bold", borderTop: "3px solid black" }),
    //         ...(isLastEntry && { marginTop: "10px", fontWeight: "bold" })
    //     };

    //     return (
    //         <Table.Row key={index} style={style}>
    //         <Table.Cell>{snakeToTitleCase(key)}</Table.Cell>
    //         <Table.Cell textAlign="right">{applyComma(value, 2)}</Table.Cell>
    //         </Table.Row>
    //     );
    //     })}
    // </Table.Body>
    // </Table.Root>
    
    // <Table.Root size="sm" variant="outline">
    // <Table.Header>
    //     <Table.Row>
    //     <Table.ColumnHeader>Adjusted Total Money Due</Table.ColumnHeader>
    //     <Table.ColumnHeader textAlign="right">{applyComma(salesSummary.totals.adjusted_total_money_due - salesSummary.credit_debit.fuel_discount, 2)}</Table.ColumnHeader>
    //     </Table.Row>
    // </Table.Header>
    // <Table.Body>
    //     <Table.Row>
    //         <Table.Cell>{(salesSummary.totals.adjusted_total_money_due - salesSummary.totals.total_sales) < 0 ? 'Short' : 'Over'}</Table.Cell>
    //         <Table.Cell textAlign="right">{salesSummary.totals.adjusted_total_money_due - salesSummary.totals.total_sales}</Table.Cell>
    //     </Table.Row>
    // </Table.Body>
    // </Table.Root>

    // <Spacer/>

    // </Stack>
    // ) : (
    //     <Text textAlign="center" mt="5">No data for selected date and location</Text>
    // )}