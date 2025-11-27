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

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Barcode from "react-barcode";
import React, { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Check, AlertTriangle } from "lucide-react"


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

  // Example variance rules (you can modify or load from DB later)
  const VARIANCE_RULES: Record<string, number> = {
    "Candy": 0,
    "Grocery Cooler": 0,
    "Beverages Energy": 0,
    "Beverages Dispensed": 0,
    "Snacks Sweet": 0,
    "Apparel": 0,
    "Non Alc Beverages": 0,
    "Beverages Tea & Coffee": 0,
    "Grocery House & Disposables": 0,

    "Cannabis Pre Rolls": 25,
    "Vape Refill Pods": 3,

    "Bistro Fresh Foods": 0,
    "Gen Merch Automotive": 0,
    "GenMerch Automotive": 10,
    "Smoke Accessories": 3,
    "Bistro Bakery": 0,
    "Bistro Breakfast": 0,
    "GenMerch Electronics": 0,
    "HBC Pharma": 0,
    "Chips": 0,
    "Grocery Pantry": 0,
    "Snacks nuts seeds other": 0,
    "HBC Other": 0,
    "GenMerch Misc": 0,

    "Quota Cigarettes": 18,
    "Cannabis Others": 5,
    "Snacks Meat": 0,
    "Cookies & Crackers Prepacked": 0,
    "Gen Merch other (non-native)": 0,
    "Cannabis Flower": 5,
    "Chocolate": 0,
    "Cigarettes Quota": 18,
    "Cannabis Concentrates": 5,
    "Snacks Salty": 0,
    "Cigarettes FN": 45,
    "Cannabis Vapes": 3,
    "Gen Merch Electronics": 0,
    "Cannabis Edibles": 10,
    "GenMerch Hardware": 0,
    "Vape Disposable Dvcs": 5,
    "Beverages Sports": 0,
    "Chew Quota": 3,
    "Vape Reusable Dvcs": 3,
    "Snacks Healthy": 0,
    "Vape Juice": 3,
    "Frozen": 0,
    "Bistro Fresh Bakery": 0,
    "Ice cream popsicles": 0,
    "Cigars FN": 8,
    "Beverages Soda Pop": 0,
    "Gum": 0,
    "Beverages Juice": 0,
    "Snacks Frozen Treats": 0,
    "Snacks Meats": 0,
    "GenMerch Seasonal": 0,
    "Grocery Frozen": 0,
    "Beverages Water": 0,
    "Cigarettes GRE": 45,
    "Beverages Milk": 0,
    "Grocery House Care": 0,
    "HBC Baby Care": 0,
    "Beverages Enhanced water": 0,
    "Grocery Deli Cooler": 0,
    "Chew FN": 5,
    "Kitchen Supplies": 0,
    "Cigars Quota": 3,
    "HBC Personal Care": 0,
    "Grocery Pet Care": 0
  };


  /**
   * Get allowed variance for a given product category.
   * @param {string} category 
   * @returns {number} variance
   */
  function getVarianceForCategory(category: string = ""): number {
    const key = category.trim();
    if (VARIANCE_RULES[key] == 0){
      return 3;
    }
    return VARIANCE_RULES[key] ?? 10;
  }

  return (
    <div className="overflow-x-auto touch-pan-x select-none p-4 rounded-xl bg-white shadow-sm border border-gray-200">

      <Dialog open={!!barcodeValue} onOpenChange={(open) => !open && setBarcodeValue(null)}>

        {/* NEW wrapper around the table — THIS gives the table rounded corners */}
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
              {items.map((item, idx) => (
                <tr
                  key={item._id || idx}
                  className={`border-b border-gray-300 transition hover:bg-gray-50 ${rowClassName}`}
                >

                  {/* <td className="border px-3 py-2">{item.name}</td> */}
                  <td className="px-3 py-2 flex items-center gap-2">

                    {/* Item Name */}
                    <span>{item.name}</span>

                    {/* Status Icon */}
                    {(() => {
                      const fohStr = counts[item._id]?.foh;
                      const bohStr = counts[item._id]?.boh;

                      // Don't show icon until BOTH values exist
                      if (!fohStr || !bohStr) return null;

                      const foh = Number(fohStr);
                      const boh = Number(bohStr);
                      const total = foh + boh;

                      const cso = item.onHandCSO ?? null;

                      if (cso === null) return null; // no CSO → no icon

                      const variance = Math.abs(total - cso);

                      // variance flag - different for different categories
                      const variance_flag = getVarianceForCategory(item.category)
                      console.log('variance flag for cat', item.category, 'is', variance_flag)
                      if (variance < variance_flag) {
                        return (
                          <Check className="text-green-600 w-4 h-4" />
                        );
                      }

                      // Bad (variance >= variance_flag)
                      return (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="text-yellow-600 w-4 h-4 cursor-pointer" />
                            </TooltipTrigger>

                            <TooltipContent
                              className="max-w-[240px] p-4 text-base  leading-relaxedbg-white rounded-xl
                                shadow-lg border animate-in fade-in zoom-in-95  "
                            >
                              <p>Please re-verify your count. If it's correct, you are not expected to do anything.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </td>


                  <td
                    className=" px-3 py-2 text-blue-600 cursor-pointer underline hover:text-blue-800"
                    onClick={() => setBarcodeValue(item.upc_barcode)}
                  >
                    {item.upc_barcode}
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min='0'
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
                      min='0'
                      className={`border rounded-lg px-2 py-1 w-20 transition shadow-sm focus:ring-2 focus:ring-blue-300 focus:outline-none ${counts[item._id]?.foh ? "border-green-500" : "border-red-500"
                        }`}
                      value={counts[item._id]?.foh ?? ""}
                      onChange={(e) => onInputChange(item._id, "foh", e.target.value)}
                      onBlur={(e) => onInputBlur(item._id, "foh", e.target.value)}
                    />
                  </td>

                  <td className="px-3 py-2 flex items-center justify-center">
                    {(counts[item._id]?.foh || counts[item._id]?.boh) ? (
                      <span>
                        {Number(counts[item._id]?.foh || 0) + Number(counts[item._id]?.boh || 0)}
                      </span>
                    ) : null}
                  </td>


                </tr>
              ))}
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