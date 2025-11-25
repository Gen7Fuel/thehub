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

  return (
    <div className="overflow-x-auto touch-pan-x select-none p-4 rounded-xl bg-white shadow-sm border border-gray-200">
      <Dialog open={!!barcodeValue} onOpenChange={(open) => !open && setBarcodeValue(null)}>
        <table className={`min-w-full text-sm ${tableClassName}`}>
          <thead>
            <tr className={`bg-gray-50 text-gray-700 ${headerClassName}`}>
              <th className="border px-3 py-2 text-left font-medium">Name</th>
              <th className="border px-3 py-2 text-left font-medium">UPC</th>
              <th className="border px-3 py-2 text-left font-medium">BOH</th>
              <th className="border px-3 py-2 text-left font-medium">FOH</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item._id || idx}
                className={`transition hover:bg-gray-50 ${rowClassName}`}
              >
                <td className="border px-3 py-2">{item.name}</td>

                <td
                  className="border px-3 py-2 text-blue-600 cursor-pointer underline hover:text-blue-800"
                  onClick={() => setBarcodeValue(item.upc_barcode)}
                >
                  {item.upc_barcode}
                </td>

                <td className="border px-3 py-2">
                  <input
                    type="number"
                    className={`border rounded-lg px-2 py-1 w-20 transition shadow-sm focus:ring-2 focus:ring-blue-300 focus:outline-none ${
                      counts[item._id]?.boh ? "border-green-500" : "border-red-500"
                    }`}
                    value={counts[item._id]?.boh ?? ""}
                    onChange={(e) => onInputChange(item._id, "boh", e.target.value)}
                    onBlur={(e) => onInputBlur(item._id, "boh", e.target.value)}
                  />
                </td>

                <td className="border px-3 py-2">
                  <input
                    type="number"
                    className={`border rounded-lg px-2 py-1 w-20 transition shadow-sm focus:ring-2 focus:ring-blue-300 focus:outline-none ${
                      counts[item._id]?.foh ? "border-green-500" : "border-red-500"
                    }`}
                    value={counts[item._id]?.foh ?? ""}
                    onChange={(e) => onInputChange(item._id, "foh", e.target.value)}
                    onBlur={(e) => onInputBlur(item._id, "foh", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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