// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import Barcode from "react-barcode";
// import React, { useState } from "react";

// interface TableWithInputsProps {
//   items: any[];
//   counts: { [id: string]: { foh: string; boh: string } };
//   onInputChange: (id: string, field: "foh" | "boh", value: string) => void;
//   onInputBlur: (id: string, field: "foh" | "boh", value: string) => void; // <-- Add this line
//   tableClassName?: string;
//   headerClassName?: string;
//   rowClassName?: string;
// }

// const TableWithInputs: React.FC<TableWithInputsProps> = ({
//   items,
//   counts,
//   onInputChange,
//   onInputBlur,
//   tableClassName = "",
//   headerClassName = "",
//   rowClassName = "",
// }) => {

//   const [barcodeValue, setBarcodeValue] = useState<string | null>(null);

//   return (
//     <div className="overflow-x-auto">
//       <Dialog open={!!barcodeValue} onOpenChange={open => !open && setBarcodeValue(null)}>
//         <table className={`min-w-full border text-sm ${tableClassName}`}>
//           <thead>
//             <tr className={headerClassName}>
//               <th className="border px-2 py-1">Name</th>
//               <th className="border px-2 py-1">UPC</th>
//               {/* <th className="border px-2 py-1">Category</th> */}
//               {/* <th className="border px-2 py-1">Grade</th> */}
//               <th className="border px-2 py-1">BOH</th>
//               <th className="border px-2 py-1">FOH</th>
//               {/* <th className="border px-2 py-1">Updated At</th> */}
//             </tr>
//           </thead>
//           <tbody>
//             {items.map((item, idx) => (
//               <tr key={item._id || idx} className={rowClassName}>
//                 <td className="border px-2 py-1">{item.name}</td>
//                 <td
//                   className="border px-2 py-1 text-blue-600 cursor-pointer underline"
//                   onClick={() => setBarcodeValue(item.upc_barcode)}
//                 >
//                   {item.upc_barcode}
//                 </td>
//                 {/* <td className="border px-2 py-1">{item.category}</td> */}
//                 {/* <td className="border px-2 py-1">{item.grade}</td> */}
//                 <td className="border px-2 py-1">
//                   <input
//                     type="text"
//                     // className="border rounded px-1 py-0.5 w-16"
//                     className={`border rounded px-1 py-0.5 w-16 ${
//                       counts[item._id]?.boh ? "border-green-500" : "border-red-500"
//                     }`}
//                     value={counts[item._id]?.boh ?? ""}
//                     onChange={e => onInputChange(item._id, "boh", e.target.value)}
//                     onBlur={e => onInputBlur(item._id, "boh", e.target.value)}
//                   />
//                 </td>
//                 <td className="border px-2 py-1">
//                   <input
//                     type="text"
//                     // className="border rounded px-1 py-0.5 w-16"
//                     className={`border rounded px-1 py-0.5 w-16 ${
//                       counts[item._id]?.foh ? "border-green-500" : "border-red-500"
//                     }`}
//                     value={counts[item._id]?.foh ?? ""}
//                     onChange={e => onInputChange(item._id, "foh", e.target.value)}
//                     onBlur={e => onInputBlur(item._id, "foh", e.target.value)}
//                   />
//                 </td>
//                 {/* <td className="border px-2 py-1">
//                   {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ""}
//                 </td> */}
//               </tr>
//             ))}
//           </tbody>
//         </table>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>UPC Barcode</DialogTitle>
//           </DialogHeader>
//           <div className="flex justify-center items-center py-4">
//             {barcodeValue && <Barcode value={barcodeValue} />}
//           </div>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// };

// export default TableWithInputs;

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Barcode from "react-barcode";
import { Check, AlertTriangle } from "lucide-react";
import axios from "axios";

interface TableWithInputsProps {
  items: any[];
  counts: { [id: string]: { foh: string; boh: string } };
  onInputChange: (id: string, field: "foh" | "boh", value: string) => void;
  onInputBlur: (id: string, field: "foh" | "boh", value: string) => void;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: string;
}

const TableWithInputs: React.FC<TableWithInputsProps> = ({
  items,
  counts,
  onInputChange,
  onInputBlur,
  tableClassName = "",
  headerClassName = "",
  rowClassName = "",
}) => {
  const [barcodeValue, setBarcodeValue] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [varianceMap, setVarianceMap] = useState<{ [key: number]: number }>({});

  // Fetch variance map on mount
  useEffect(() => {
    const fetchVariance = async () => {
      try {
        const res = await axios.get("/api/product-category/cycle-count-variance", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
            "X-Required-Permission": "cycleCount",
          },
        });
        setVarianceMap(res.data.varianceMap || {});
      } catch (err) {
        console.error("Failed to fetch variance map", err);
      }
    };
    fetchVariance();
  }, []);

  // Helper: get allowed variance for a given item
  const getVarianceForItem = (categoryNumber?: number) => {
    if (!categoryNumber) return 10; // fallback
    const variance = varianceMap[categoryNumber];
    return variance != null ? variance : 10;
  };

  return (
    <div className="overflow-x-auto touch-pan-x select-none p-4 rounded-xl bg-white shadow-sm border border-gray-200">
      <Dialog open={!!barcodeValue} onOpenChange={(open) => !open && setBarcodeValue(null)}>
        <div className="overflow-hidden rounded-lg border border-gray-300">
          <table className={`min-w-full text-sm border-collapse ${tableClassName}`}>
            <thead>
              <tr className={`bg-gray-50 text-gray-700 ${headerClassName}`}>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">UPC</th>
                <th className="px-3 py-2 text-left font-medium">BOH</th>
                <th className="px-3 py-2 text-left font-medium">FOH</th>
                <th className="px-3 py-2 text-left font-medium">Total</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item: any, idx: number) => {
                const fohStr = counts[item._id]?.foh;
                const bohStr = counts[item._id]?.boh;

                return (
                  <tr
                    key={item._id || idx}
                    className={`border-b border-gray-300 transition hover:bg-gray-50 ${rowClassName}`}
                  >
                    <td className="px-3 py-2 flex items-center gap-2">
                      <span>{item.name}</span>

                      {fohStr && bohStr && item.onHandCSO != null && (() => {
                        const foh = Number(fohStr);
                        const boh = Number(bohStr);
                        const total = foh + boh;
                        const varianceFlag = getVarianceForItem(item.categoryNumber);
                        console.log('category:', item.categoryNumber, 'variance:', varianceFlag);

                        if (Math.abs(total - item.onHandCSO) < varianceFlag) {
                          return <Check className="text-green-600 w-4 h-4" />;
                        }

                        return (
                          <>
                            <AlertTriangle
                              className="text-yellow-600 w-4 h-4 cursor-pointer"
                              onClick={() => setOpenDialog(item._id)}
                            />
                            <Dialog open={openDialog === item._id} onOpenChange={() => setOpenDialog(null)}>
                              <DialogContent className="max-w-[300px] rounded-xl">
                                <DialogHeader>
                                  <DialogTitle className="text-yellow-700 flex items-center gap-2 text-lg">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                    Variance Detected
                                  </DialogTitle>
                                </DialogHeader>
                                <p className="text-gray-700 text-base leading-relaxed mt-2">
                                  Please re-verify your count. If it's correct, you are not expected to do anything.
                                </p>
                                <button
                                  className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg"
                                  onClick={() => setOpenDialog(null)}
                                >
                                  OK
                                </button>
                              </DialogContent>
                            </Dialog>
                          </>
                        );
                      })()}
                    </td>

                    <td
                      className="px-3 py-2 text-blue-600 cursor-pointer underline hover:text-blue-800"
                      onClick={() => setBarcodeValue(item.upc_barcode)}
                    >
                      {item.upc_barcode}
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        className={`border rounded-lg px-2 py-1 w-20 transition shadow-sm focus:ring-2 focus:ring-blue-300 focus:outline-none ${counts[item._id]?.boh ? "border-green-500" : "border-red-500"
                          }`}
                        value={counts[item._id]?.boh ?? ""}
                        onChange={(e) => onInputChange(item._id, "boh", e.target.value)}
                        onBlur={(e) => onInputBlur(item._id, "boh", e.target.value)}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        className={`border rounded-lg px-2 py-1 w-20 transition shadow-sm focus:ring-2 focus:ring-blue-300 focus:outline-none ${counts[item._id]?.foh ? "border-green-500" : "border-red-500"
                          }`}
                        value={counts[item._id]?.foh ?? ""}
                        onChange={(e) => onInputChange(item._id, "foh", e.target.value)}
                        onBlur={(e) => onInputBlur(item._id, "foh", e.target.value)}
                      />
                    </td>

                    <td className="px-3 py-2 flex items-center justify-center">
                      {fohStr || bohStr ? <span>{Number(fohStr || 0) + Number(bohStr || 0)}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
  );
};

export default TableWithInputs;