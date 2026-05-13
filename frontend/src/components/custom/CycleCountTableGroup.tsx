import React from "react";
import { Check, AlertTriangle, Barcode as BarcodeIcon } from "lucide-react";

interface Props {
  items: any[];
  counts: any;
  isPriority: boolean;
  onInputChange: (id: string, field: "foh" | "boh", value: string) => void;
  onInputBlur: (id: string, field: "foh" | "boh", value: string) => void;
}

const CycleCountTableGroup: React.FC<Props> = ({
  items,
  counts,
  isPriority,
  onInputChange,
  onInputBlur
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className={`${isPriority ? 'bg-blue-100 text-blue-800' : 'bg-gray-50 text-gray-600'} text-xs uppercase font-bold`}>
            <th className="px-4 py-3">Product Info</th>
            <th className="px-4 py-3 w-28 text-center">BOH</th>
            <th className="px-4 py-3 w-28 text-center">FOH</th>
            <th className="px-4 py-3 w-20 text-center">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((item) => {
            const currentFoh = counts[item.entryId]?.foh || "";
            const currentBoh = counts[item.entryId]?.boh || "";
            const isItemDone = currentFoh !== "" && currentBoh !== "";
            const total = Number(currentFoh) + Number(currentBoh);

            // Custom styles based on Priority vs Regular and Done status
            const getRowStyle = () => {
              if (isPriority) {
                return isItemDone
                  ? "bg-blue-100/50 border-l-4 border-l-blue-600 opacity-90"
                  : "bg-blue-50/30 border-l-4 border-l-transparent";
              }
              return isItemDone
                ? "bg-green-50/30 opacity-60"
                : "bg-white";
            };

            return (
              <tr
                key={item.entryId}
                className={`transition-all duration-300 ${getRowStyle()}`}
              >
                <td className="px-4 py-4">
                  <div className={`font-bold leading-tight ${isItemDone && !isPriority ? 'text-gray-500' : 'text-gray-900'}`}>
                    {item.name}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-gray-400 border border-gray-200 px-1 rounded">
                      {item.upc_barcode}
                    </span>
                    {isItemDone && <Check className="w-4 h-4 text-green-600" />}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <input
                    type="number"
                    inputMode="numeric"
                    className={`w-full h-12 text-center text-lg border-2 rounded-lg transition-all outline-none
            ${isItemDone
                        ? 'border-green-500 bg-white'
                        : isPriority ? 'border-blue-200 focus:border-blue-500' : 'border-gray-200 focus:border-blue-500'}
          `}
                    value={currentBoh}
                    onChange={(e) => onInputChange(item.entryId, "boh", e.target.value)}
                    onBlur={(e) => onInputBlur(item.entryId, "boh", e.target.value)}
                  />
                </td>

                <td className="px-4 py-4">
                  <input
                    type="number"
                    inputMode="numeric"
                    className={`w-full h-12 text-center text-lg border-2 rounded-lg transition-all outline-none
            ${isItemDone
                        ? 'border-green-500 bg-white'
                        : isPriority ? 'border-blue-200 focus:border-blue-500' : 'border-gray-200 focus:border-blue-500'}
          `}
                    value={currentFoh}
                    onChange={(e) => onInputChange(item.entryId, "foh", e.target.value)}
                    onBlur={(e) => onInputBlur(item.entryId, "foh", e.target.value)}
                  />
                </td>

                <td className={`px-4 py-4 text-center font-bold ${isItemDone ? 'text-green-700' : 'text-gray-400'}`}>
                  {isItemDone ? total : "-"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default CycleCountTableGroup;