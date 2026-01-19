import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getStatusStyles } from "./requests"
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, Package, CheckCircle2, QrCode } from 'lucide-react'
import Barcode from 'react-barcode'
import axios from 'axios'

export const Route = createFileRoute('/_navbarLayout/write-off/$id')({
  component: WriteOffDetailsPage,
  loader: async ({ params }) => {
    const res = await axios.get(`/api/write-off/${params.id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    return res.data
  }
})

function WriteOffDetailsPage() {
  const data = Route.useLoaderData()
  const [writeOff, setWriteOff] = useState(data)
  const [barcodeValue, setBarcodeValue] = useState<string | null>(null)

  const handleToggleItem = async (itemId: string, currentVal: boolean) => {
    try {
      const res = await axios.patch(`/api/write-off/${writeOff._id}/items/${itemId}`, {
        completed: !currentVal
      })
      setWriteOff(res.data)
    } catch (err) {
      console.error("Failed to update item", err)
    }
  }

  return (
    <div className="min-w-4xl mx-auto p-6 flex flex-col h-[calc(100vh-80px)] font-sans antialiased">

      {/* Header Info Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {writeOff.listNumber}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border ${getStatusStyles(writeOff.status)}`}
            >
              {writeOff.status}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(writeOff.createdAt).toLocaleString()}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              {writeOff.items.length} Items
            </span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Item Name
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  UPC / Barcode
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">
                  Qty
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Reason
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {writeOff.items.map((item: any) => (
                <tr
                  key={item._id}
                  className={`hover:bg-slate-50/50 transition-colors ${
                    item.completed ? 'bg-slate-50/30' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {item.gtin || 'No GTIN'}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <button
                      onClick={() => setBarcodeValue(item.upc_barcode)}
                      className="flex items-center gap-2 text-sm font-mono text-blue-800 hover:text-blue-800 underline decoration-blue-200 underline-offset-4"
                    >
                      {item.upc_barcode}
                    </button>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 rounded-lg text-sm font-semibold text-slate-700">
                      {item.qty}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium uppercase tracking-wide border border-orange-100">
                      {item.reason}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() =>
                        handleToggleItem(item._id, item.completed)
                      }
                      className="h-6 w-6 rounded-md border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex justify-end">
        <Button
          disabled={writeOff.status !== 'Complete'}
          className="h-12 px-10 rounded-xl font-semibold text-sm uppercase tracking-wide shadow-lg shadow-primary/20"
        >
          {writeOff.status === 'Complete' && (
            <CheckCircle2 className="w-4 h-4 mr-2" />
          )}
          Finalize Write-Off
        </Button>
      </div>

      {/* Barcode Dialog */}
      <Dialog open={!!barcodeValue} onOpenChange={() => setBarcodeValue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>UPC Barcode</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-4">
            {barcodeValue && <Barcode value={barcodeValue} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}