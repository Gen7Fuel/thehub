import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import axios from 'axios'
import { domain } from '@/lib/constants'

export const Route = createFileRoute('/_navbarLayout/kardpoll/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const parser = new DOMParser();

      if (!e.target || typeof e.target.result !== "string") {
        alert("Failed to read the file.");
        return;
      }
      const xmlDoc = parser.parseFromString(e.target.result, "text/xml");

      const rows = Array.from(xmlDoc.getElementsByTagName("Row"));
      const cardNumberRegex = /^\d{16}$/;
      let transactions: { date: string; time: string; kardpollCode: string; trx: string; customerId: string; customerName: string; fleetCardNumber: string; driverInfo: string; productKardpollCode: string; quantity: string; amount: string }[] = [];

      rows.forEach(row => {
        const cells = Array.from(row.getElementsByTagName("Cell"));
        const rowData = cells.map(cell => cell.textContent || "");

        if (rowData.length > 7 && cardNumberRegex.test(rowData[7])) {
          transactions.push({
            date: rowData[0] || "",
            time: rowData[1] || "",
            kardpollCode: rowData[2] || "",
            trx: rowData[4] || "",
            customerId: rowData[5] || "",
            customerName: rowData[6] || "",
            fleetCardNumber: rowData[7] || "",
            driverInfo: rowData[8] || "",
            productKardpollCode: rowData[14] || "",
            quantity: rowData[15] || "",
            amount: rowData[17] || ""
          });
        }
      });

      console.log('Transactions', transactions);

      try {
        const response = await axios.post(`${domain}/api/kardpoll-transactions/upload`, transactions, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.status === 200) {
          alert("Records uploaded successfully.");
        } else {
          alert("Failed to upload records.");
        }
      } catch (error) {
        console.error("Error uploading records:", error);
        alert("Error uploading records.");
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 border border-dashed border-gray-300 rounded-md space-y-4">
      <h2 className="text-lg font-bold">Upload Kardpoll XMLSS Exports</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="file"
          accept=".xml,.xmlss"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
        />
        {file && <p className="text-sm text-gray-600">Selected file: {file.name}</p>}
        <Button type="submit" disabled={!file}>
          Upload
        </Button>
      </form>
    </div>
  )
}