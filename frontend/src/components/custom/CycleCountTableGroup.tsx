import React, { useState } from "react";
import { Check, AlertTriangle, Barcode as BarcodeIcon, Search, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Barcode from "react-barcode"; // Assuming you are using this package

interface Props {
  items: any[];
  counts: any;
  isPriority: boolean;
  onInputChange: (id: string, field: "foh" | "boh", value: string) => void;
  onInputBlur: (id: string, field: "foh" | "boh", value: string) => void;
  getVarianceForItem: (catNum?: number) => number;
}

const CycleCountTableGroup: React.FC<Props> = ({
  items,
  counts,
  isPriority,
  onInputChange,
  onInputBlur,
  getVarianceForItem
}) => {
  const [activeBarcodeItem, setActiveBarcodeItem] = useState<{ name: string, upc: string, image: string } | null>(null);
  const [openVarianceId, setOpenVarianceId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead>
          <tr className={`${isPriority ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-600'} text-xs uppercase font-bold`}>
            <th className="px-4 py-4 min-w-[200px]">Product Name</th>
            <th className="px-4 py-4 w-40">UPC / Barcode</th>
            <th className="px-4 py-4 w-28 text-center">BOH</th>
            <th className="px-4 py-4 w-28 text-center">FOH</th>
            <th className="px-4 py-4 w-20 text-center">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const fohStr = counts[item.entryId]?.foh ?? "";
            const bohStr = counts[item.entryId]?.boh ?? "";
            const hasBoth = fohStr !== "" && bohStr !== "";

            const total = Number(fohStr || 0) + Number(bohStr || 0);
            const isDone = hasBoth;

            // Variance Logic
            let varianceIndicator = null;
            if (hasBoth && item.onHandCSO != null) {
              const allowedVariance = getVarianceForItem(item.category_id);
              const diff = Math.abs(total - item.onHandCSO);

              if (diff <= allowedVariance) {
                varianceIndicator = <Check className="text-green-600 w-5 h-5 shrink-0" />;
              } else {
                varianceIndicator = (
                  <AlertTriangle
                    className="text-amber-500 w-5 h-5 shrink-0 cursor-pointer animate-pulse"
                    onClick={() => setOpenVarianceId(item.entryId)}
                  />
                );
              }
            }

            return (
              <tr key={item.entryId} className={`transition-colors ${isDone ? 'bg-gray-50/30' : 'bg-white'}`}>
                {/* 1. Name + Indicator */}
                {/* <td className="px-4 py-4 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className={`font-bold text-sm md:text-base break-words leading-snug ${isDone ? 'text-gray-400' : 'text-gray-900'}`}>
                        {item.name}
                      </span>
                    </div>
                    {varianceIndicator}
                  </div>
                </td> */}
                <td className="px-4 py-4 min-w-[250px] max-w-[350px]">
                  <div className="flex items-center gap-4">
                    {/* 1. PRODUCT IMAGE THUMBNAIL */}
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=No+Img'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <ImageIcon className="w-6 h-6 opacity-20" />
                        </div>
                      )}
                    </div>

                    {/* 2. NAME & INFO */}
                    <div className="flex flex-col min-w-0">
                      <span className={`font-bold text-sm break-words leading-snug ${isDone ? 'text-gray-400' : 'text-gray-900'}`}>
                        {item.name}
                      </span>
                    </div>
                    {varianceIndicator}
                  </div>
                </td>

                {/* 2. UPC/Barcode (As discussed before) */}
                <td className="px-4 py-4">
                  <button
                    // Inside your table row button:
                    onClick={() => setActiveBarcodeItem({
                      name: item.name,
                      upc: item.upc_barcode,
                      image: item.image_url // Pass the image here
                    })} className="flex items-center gap-2 text-xs font-mono text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors group"
                  >
                    <BarcodeIcon className="w-3.5 h-3.5" />
                    <span>{item.upc_barcode || "NO UPC"}</span>
                    <Search className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </td>

                {/* 3. BOH Input - Restored Red/Green logic and Width */}
                <td className="px-4 py-4 w-32">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="BOH"
                    className={`w-full h-12 text-center text-lg font-bold border-2 rounded-xl transition-all outline-none
                                ${bohStr !== ""
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-inner'
                        : 'border-red-200 bg-red-50/50 text-red-900 placeholder:text-red-300 focus:border-red-400'}
                    `}
                    value={bohStr}
                    onChange={(e) => onInputChange(item.entryId, "boh", e.target.value)}
                    onBlur={(e) => onInputBlur(item.entryId, "boh", e.target.value)}
                  />
                </td>

                {/* 4. FOH Input - Restored Red/Green logic and Width */}
                <td className="px-4 py-4 w-32">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    placeholder="FOH"
                    className={`w-full h-12 text-center text-lg font-bold border-2 rounded-xl transition-all outline-none
                                ${fohStr !== ""
                        ? 'border-green-500 bg-green-50 text-green-700 shadow-inner'
                        : 'border-red-200 bg-red-50/50 text-red-900 placeholder:text-red-300 focus:border-red-400'}
                    `}
                    value={fohStr}
                    onChange={(e) => onInputChange(item.entryId, "foh", e.target.value)}
                    onBlur={(e) => onInputBlur(item.entryId, "foh", e.target.value)}
                  />
                </td>

                {/* 5. Total */}
                <td className={`px-4 py-4 text-center font-black ${isDone ? 'text-gray-700' : 'text-gray-300'}`}>
                  {isDone ? total : "--"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* --- BARCODE ZOOM DIALOG --- */}
      <Dialog open={!!activeBarcodeItem} onOpenChange={() => setActiveBarcodeItem(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden p-0 border-none">
          {/* Product Image Header */}
          <div className="w-full h-48 bg-gray-50 relative border-b border-gray-100">
            {activeBarcodeItem?.image ? (
              <img
                src={activeBarcodeItem.image}
                alt={activeBarcodeItem.name}
                className="w-full h-full object-contain p-4" // object-contain ensures we see the whole product
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Image Available</span>
              </div>
            )}
            <div className="absolute top-4 left-0 right-0 text-center">
              <span className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] uppercase tracking-tighter font-black text-gray-500 shadow-sm border border-white/50">
                Verify Product Identity
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center items-center p-8 pt-6">
            {/* Barcode Section - Optimized for Scanning */}
            <div className="w-full p-6 bg-white rounded-2xl border-2 border-gray-100 mb-6 flex justify-center shadow-sm">
              {activeBarcodeItem?.upc && (
                <Barcode
                  value={activeBarcodeItem.upc}
                  width={2.2} // Slightly wider for easier scanner pickup
                  height={100}
                  displayValue={false}
                />
              )}
            </div>

            {/* Item Details */}
            <div className="text-center px-4">
              <h3 className="text-xl font-black text-gray-900 leading-tight mb-2">
                {activeBarcodeItem?.name}
              </h3>
              <div className="inline-block bg-blue-50 px-4 py-1.5 rounded-lg">
                <p className="text-sm font-mono font-black text-blue-700 tracking-[0.15em]">
                  {activeBarcodeItem?.upc}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveBarcodeItem(null)}
              className="mt-8 w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all hover:bg-black"
            >
              Close & Return to Count
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Variance Alert Dialog */}
      <Dialog open={!!openVarianceId} onOpenChange={() => setOpenVarianceId(null)}>
        <DialogContent className="max-w-[320px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Count Variance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-gray-600 text-sm leading-relaxed">
              The total count for this item differs significantly from the expected system stock.
            </p>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs font-bold text-amber-800">
              Please double-check Back on Hand and Front on Hand. If your count is correct, no further action is needed.
            </div>
            <button
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
              onClick={() => setOpenVarianceId(null)}
            >
              I've Verified My Count
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CycleCountTableGroup;