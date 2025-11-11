import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { snakeCase } from 'lodash';
import axios from "axios"

export const Route = createFileRoute(
  '/_navbarLayout/reports/sales-summary/upload',
)({
  component: RouteComponent,
});

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate()
  interface FuelSales {
    [key: string]: { [key: string]: any };
  }

  interface OutputData {
    date: string;
    stationNumber: string;
    fuel_sales: FuelSales;
    totals: { [key: string]: any };
    credit_debit: { [key: string]: any };
    house_account: { [key: string]: any };
    cash: { [key: string]: any };
    coupons: { [key: string]: any };
    food_stamps: { [key: string]: any };
  }

  const [output, setOutput] = useState<OutputData>({
    date: "",
    stationNumber: "",
    fuel_sales: {},
    totals: {},
    credit_debit: {},
    house_account: {},
    cash: {},
    coupons: {},
    food_stamps: {}
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      setError('Only .xlsx files are allowed.');
      setFile(null);
    } else {
      setError(null);
      setFile(selectedFile || null);
    }
  };

 const handleSubmit = () => {
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", file);

    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      if (e.target && e.target.result instanceof ArrayBuffer) {
        data = new Uint8Array(e.target.result);
      } else {
        console.error("Error: FileReader result is not an ArrayBuffer.");
        return;
      }
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Access cell A3
      const cellA3 = worksheet['A3'] ? worksheet['A3'].v : "Cell A3 is empty";
      console.log("Cell A3:", cellA3);

      if (cellA3 !== "Cell A3 is empty") {
        // Extract dates and station number using regular expressions
        const dateRegex = /from (\d{2}\/\d{2}\/\d{4}) to (\d{2}\/\d{2}\/\d{4})/;
        const stationRegex = /Filter by Station: (\d+)/;

        const dateMatch = cellA3.match(dateRegex);
        const stationMatch = cellA3.match(stationRegex);

        if (dateMatch && stationMatch) {
          const startDate = dateMatch[1];
          const endDate = dateMatch[2];
          const stationNumber = stationMatch[1];

          // Check if the dates are the same
          if (startDate === endDate) {
            // Convert the date string to "yyyy-MM-dd" format
            const [month, day, year] = startDate.split('/')
            const formattedDate = `${year}-${month}-${day}`

            const outputData: OutputData = {
              date: formattedDate,
              stationNumber: stationNumber,
              fuel_sales: {},
              totals: {},
              credit_debit: {},
              house_account: {},
              cash: {},
              coupons: {},
              food_stamps: {}
            };

            // Look for the text "Fuel Sales" in column A
            let titleRow;
            for (let cell in worksheet) {
              if (cell.startsWith('A') && worksheet[cell].v === "Fuel Sales") {
                titleRow = parseInt(cell.slice(1));
                break;
              }
            }

            if (titleRow) {
              console.log("Found 'Fuel Sales' at row:", titleRow);

              // Extract the titles from the title row
              const titles = [];
              let col = 'B';
              while (worksheet[col + titleRow]) {
                titles.push(snakeCase(worksheet[col + titleRow].v));
                col = String.fromCharCode(col.charCodeAt(0) + 1);
              }

              // Extract the fuel sales data
              let row = titleRow + 1;
              while (worksheet['A' + row] && worksheet['A' + row].v !== "Total Self Service") {
                const fuelType: string = snakeCase(worksheet['A' + row].v);
                outputData.fuel_sales[fuelType] = {};
                col = 'B';
                for (let i = 0; i < titles.length; i++) {
                  outputData.fuel_sales[fuelType][titles[i]] = worksheet[col + row] ? worksheet[col + row].v : null;
                  col = String.fromCharCode(col.charCodeAt(0) + 1);
                }
                row++;
              }

              outputData.totals.total_volume_ss = worksheet['B' + row] ? worksheet['B' + row].v : 0;
              outputData.totals.total_sales_ss = worksheet['E' + row] ? worksheet['E' + row].v : 0;
              outputData.totals.total_fuel_loyalty_ss = worksheet['G' + row] ? worksheet['G' + row].v : 0;

              // Move to the row after "Total Self Service"
              row += 2;

              // Find the row which has "Total Fuel" in column A
              while (worksheet['A' + row] && worksheet['A' + row].v !== "Total Fuel") {
                row++;
              }

              // Start extracting the data from the following row until "Total Sales, $" is found
              row++;
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Sales, $".replace(/\s+/g, "")) {
                const totalType = snakeCase(worksheet['A' + row].v);
                outputData.totals[totalType] = worksheet['E' + row] ? worksheet['E' + row].v : null;
                row++;
                console.log("Row now:", row);
              }
//  && Object.keys(outputData.totals).length < 6

              // Extract the total sales data from column F
              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Sales, $".replace(/\s+/g, "")) {
                console.log("Found 'Total Sales, $' at row:", row);
                outputData.totals.total_sales = worksheet['F' + row] ? worksheet['F' + row].v : null;
              }

              // Find the row which has "Taxable Sales, $" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Taxable Sales, $".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Taxable Sales, $".replace(/\s+/g, "")) {
                console.log("Found 'Taxable Sales, $' at row:", row);
                const taxableSalesRow = row;

                // Find the cell containing "Taxes Collected On, $" to the right
                let taxesCollectedCol = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + taxableSalesRow] && (worksheet[col + taxableSalesRow].v).replace(/\s+/g, "") === "Taxes Collected On, $".replace(/\s+/g, "")) {
                    taxesCollectedCol = col;
                    break;
                  }
                }

                if (taxesCollectedCol) {
                  console.log(`Found 'Taxes Collected On, $' at cell ${taxesCollectedCol + taxableSalesRow}`);
                  outputData.totals.taxable_sales = worksheet['A' + (taxableSalesRow + 1)] ? worksheet['A' + (taxableSalesRow + 1)].v : null;
                  outputData.totals.taxes_collected = worksheet[taxesCollectedCol + (taxableSalesRow + 1)] ? worksheet[taxesCollectedCol + (taxableSalesRow + 1)].v : null;
                }
              }
              
              console.log("Current row:", row);

              // Find the row which has "Total Other Revenue, $" in column A
              while (worksheet['A' + row] && String(worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Other Revenue, $".replace(/\s+/g, "")) {
                row++;
                console.log("Row now:", row);
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Other Revenue, $".replace(/\s+/g, "")) {
                console.log("Found 'Total Other Revenue, $' at row:", row);

                // Move to the right in that row until you find the value
                let otherRevenue = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    otherRevenue = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.total_other_revenue = otherRevenue;
              }

              // Find the row which has "Total Revenue, $" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Revenue, $".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Revenue, $".replace(/\s+/g, "")) {
                console.log("Found 'Total Revenue, $' at row:", row);

                // Move to the right in that row until you find the value
                let totalRevenue = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    totalRevenue = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.total_revenue = totalRevenue;
              }
              
              // Find the row which has "Total Cash Pay Out, $" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Cash Pay Out, $".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Cash Pay Out, $".replace(/\s+/g, "")) {
                console.log("Found 'Total Cash Pay Out, $' at row:", row);

                // Move to the right in that row until you find the value
                let totalCashPayOut = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    totalCashPayOut = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.total_cash_pay_out = totalCashPayOut;
              }

              // Find the row which has "Total Store Expenses, $" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Store Expenses, $".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Store Expenses, $".replace(/\s+/g, "")) {
                console.log("Found 'Total Store Expenses, $' at row:", row);

                // Move to the right in that row until you find the value
                let totalStoreExpenses = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    totalStoreExpenses = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.total_store_expenses = totalStoreExpenses;
              }

              // Find the row which has "Paid In, $" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Paid In, $".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Paid In, $".replace(/\s+/g, "")) {
                console.log("Found 'Paid In, $' at row:", row);

                // Move to the right in that row until you find the value
                let paidIn = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    paidIn = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.paid_in = paidIn;
              }

              // Find the row which has "Total Money Due, $" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Money Due, $".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Money Due, $".replace(/\s+/g, "")) {
                console.log("Found 'Total Money Due, $' at row:", row);

                // Move to the right in that row until you find the value
                let totalMoneyDue = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    totalMoneyDue = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.total_money_due = totalMoneyDue;
              }

              // Find the row which has "Credit/Debit" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Credit/Debit".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Credit/Debit".replace(/\s+/g, "")) {
                console.log("Found 'Credit/Debit' at row:", row);

                // Move to the next row to start extracting values
                row++;
                outputData.credit_debit = {};

                // Extract values until "Total Credit" is found
                while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Credit".replace(/\s+/g, "")) {
                  const creditDebitType = snakeCase(worksheet['A' + row].v);
                  let value = null;
                  for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                    if (worksheet[col + row]) {
                      value = worksheet[col + row].v;
                      break;
                    }
                  }
                  outputData.credit_debit[creditDebitType] = value;
                  row++;
                }

                // Extract the "Total Credit" value
                if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Credit".replace(/\s+/g, "")) {
                  console.log("Found 'Total Credit' at row:", row);
                  let totalCredit = null;
                  for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                    if (worksheet[col + row]) {
                      totalCredit = worksheet[col + row].v;
                      break;
                    }
                  }
                  outputData.credit_debit.total_credit = totalCredit;
                }
              }

              // Find the row which has "Total House Account" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total House Account".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total House Account".replace(/\s+/g, "")) {
                console.log("Found 'Total House Account' at row:", row);

                // Move to the right in that row until you find the value
                let totalHouseAccount = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    totalHouseAccount = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.house_account.total = totalHouseAccount;
              }

              // Find the row which has "Cash" in column A
              while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Cash".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Cash".replace(/\s+/g, "")) {
                console.log("Found 'Cash' at row:", row);

                // Move to the next row to start extracting values
                row++;
                outputData.cash = {};

                // Extract values until "Total Cash" is found
                while (!worksheet['A' + row] || (worksheet['A' + row].v === undefined || (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Cash".replace(/\s+/g, ""))) {
                  if (!worksheet['A' + row]) {
                    console.log("Cell A" + row + " is empty");
                    row++;
                    continue;
                  }

                  if (worksheet['A' + row] && worksheet['A' + row].v !== undefined) {
                    const cashType = snakeCase(worksheet['A' + row].v);
                    console.log("Cash type:", cashType);
                    let value = null;
                    for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                      if (worksheet[col + row]) {
                        value = worksheet[col + row].v;
                        console.log("Value:", value);
                        break;
                      }
                    }

                    if (cashType !== "") { // Skip the "": null entry
                      outputData.cash[cashType] = value;
                    }
                  }
                  row++;
                }

                // Extract the "Total Cash" value
                if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Cash".replace(/\s+/g, "")) {
                  console.log("Found 'Total Cash' at row:", row);
                  let totalCash = null;
                  for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                    if (worksheet[col + row]) {
                      totalCash = worksheet[col + row].v;
                      break;
                    }
                  }
                  outputData.cash.total_cash = totalCash;
                }
              }

              // Find the row which has "Coupons" in column A
              while (!worksheet['A' + row] || worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Coupons".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Coupons".replace(/\s+/g, "")) {
                console.log("Found 'Coupons' at row:", row);

                // Move to two rows down to start extracting values
                row += 2;
                outputData.coupons = {};

                // Extract values until "Total Coupons" is found
                while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Coupons".replace(/\s+/g, "")) {
                  const couponType = snakeCase(worksheet['A' + row].v);
                  let value = worksheet['B' + row] ? worksheet['B' + row].v : null;
                  outputData.coupons[couponType] = value;
                  row++;
                }

                // Extract the "Total Coupons" value
                if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Coupons".replace(/\s+/g, "")) {
                  console.log("Found 'Total Coupons' at row:", row);
                  let totalCoupons = worksheet['B' + row] ? worksheet['B' + row].v : null;
                  outputData.coupons.total_coupons = totalCoupons;
                }
              }

              // Find the row which has "Food Stamps" in column A
              while (!worksheet['A' + row] ||worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Food Stamps".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Food Stamps".replace(/\s+/g, "")) {
                console.log("Found 'Food Stamps' at row:", row);

                // Move to two rows down to start extracting values
                row += 2;
                outputData.food_stamps = {};

                // Extract values until "Total Food Stamps" is found
                while (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Total Food Stamps".replace(/\s+/g, "")) {
                  const foodStampType = snakeCase(worksheet['A' + row].v);
                  let value = worksheet['B' + row] ? worksheet['B' + row].v : null;
                  outputData.food_stamps[foodStampType] = value;
                  row++;
                }

                // Extract the "Total Food Stamps" value
                if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Total Food Stamps".replace(/\s+/g, "")) {
                  console.log("Found 'Total Food Stamps' at row:", row);
                  let totalFoodStamps = worksheet['B' + row] ? worksheet['B' + row].v : null;
                  outputData.food_stamps.total_food_stamps = totalFoodStamps;
                }
              }

              // Find the row which has "Adjusted Total Money Due" in column A
              while (!worksheet['A' + row] || worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") !== "Adjusted Total Money Due".replace(/\s+/g, "")) {
                row++;
              }

              if (worksheet['A' + row] && (worksheet['A' + row].v).replace(/\s+/g, "") === "Adjusted Total Money Due".replace(/\s+/g, "")) {
                console.log("Found 'Adjusted Total Money Due' at row:", row);

                // Move to the right in that row until you find the value
                let adjustedTotalMoneyDue = null;
                for (let col = 'B'; col <= 'H'; col = String.fromCharCode(col.charCodeAt(0) + 1)) {
                  if (worksheet[col + row]) {
                    adjustedTotalMoneyDue = worksheet[col + row].v;
                    break;
                  }
                }

                outputData.totals.adjusted_total_money_due = adjustedTotalMoneyDue;
              }

              setOutput(outputData); // Set the output data

              // Save the data to the backend

              // add authorization header with bearer token
              axios.post('/api/sales-summary', outputData, {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`,
                  "X-Required-Permission": "reports"
                }
              })
                .then(response => {
                  console.log('Sent this:', output);
                  console.log('Success:', response.data);
                  setSuccessMessage("File uploaded successfully!");
                })
                .catch((error: any) => {
                  if (error.response?.status === 403) {
                    // Redirect to no-access page
                    navigate({ to: "/no-access" });
                  } else {
                    console.error('Error:', error);
                  }
                });

            } else {
              setError("Error: 'Fuel Sales' title row not found.");
            }
          } else {
            setError("Error: The report is not for a single day.");
          }
        } else {
          setError("Error: Unable to extract dates or station number from cell A3.");
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex items-center justify-center">
      <div className="max-w-md w-full p-4 border border-dashed border-gray-300 rounded-md space-y-4">
        <h2 className="text-lg font-bold">Upload Sales Summary</h2>
        <form className="space-y-4">
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700">
              Select File
            </label>
            <Input
              type="file"
              id="file"
              accept=".xlsx"
              onChange={handleFileChange}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {successMessage && <p className="text-sm text-green-500">{successMessage}</p>}
          <Button type="button" onClick={handleSubmit} className="w-full">
            Upload
          </Button>
        </form>
      </div>
    </div>
  );
}