// routes/_navbarLayout/cycle-count/report-new.tsx
import { useState, useEffect, memo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { ArrowUp, ArrowDown, Image as ImageIcon, ChevronDown, ChevronRight, ScanBarcode } from "lucide-react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";
import { DatePicker } from '@/components/custom/datePicker';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Barcode from "react-barcode";
import { useSite } from '@/context/SiteContext';
import { PasswordProtection } from "@/components/custom/PasswordProtection";

export const Route = createFileRoute("/_navbarLayout/cycle-count/report-new")({
  component: RouteComponent,
});

interface ReportItem {
  _id: string;
  productId: number;
  name: string;
  upc_barcode: string;
  image_url: string | null;
  unitPrice: number;
  onHandCSO: number;
  categoryId: number;
  categoryName: string;
  foh: number;
  foh_crt: number | null;
  foh_case: number | null;
  boh: number;
  boh_crt: number | null;
  boh_case: number | null;
  totalQty: number;
  count_completed: boolean;
  priority: boolean;
}

interface ActiveBarcode {
  name: string;
  upc: string;
  image: string | null;
}

const ItemRow = memo(({
  item,
  onOpenBarcode
}: {
  item: ReportItem;
  onOpenBarcode: (name: string, upc: string, image: string | null) => void;
}) => {
  const hasCSO = item.onHandCSO !== undefined && item.onHandCSO !== null;
  const variance = hasCSO ? item.totalQty - item.onHandCSO : 0;
  const dollarVariance = variance * item.unitPrice;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);

  return (
    <tr className="border-b hover:bg-gray-50/80 transition-colors group text-xs">
      {/* 1. FREEZED LOGISTICS IMAGE */}
      <td className="p-2 sticky left-0 z-10 align-middle text-center w-14 bg-white group-hover:bg-gray-50 transition-colors border-r border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200 mx-auto">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageIcon className="w-4 h-4 opacity-30" />
            </div>
          )}
        </div>
      </td>

      {/* 2. FREEZED INTERACTIVE UPC MONO BUTTON */}
      <td className="p-3 sticky left-[56px] z-10 font-mono align-middle w-36 bg-white group-hover:bg-gray-50 transition-colors border-r border-gray-100">
        <button
          type="button"
          onClick={() => onOpenBarcode(item.name, item.upc_barcode, item.image_url)}
          className="flex items-center gap-1 font-mono text-blue-600 hover:bg-blue-50 px-1.5 py-1 rounded transition-colors text-left truncate w-full"
        >
          <ScanBarcode className="w-3.5 h-3.5 shrink-0" />
          <span className="font-bold truncate">{item.upc_barcode || "NO UPC"}</span>
        </button>
      </td>

      {/* 3. FREEZED DESCRIPTION COLUMN WITH SHADOW EDGE */}
      <td className="p-3 sticky left-[200px] z-10 font-medium text-gray-900 align-middle w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.12)] bg-white group-hover:bg-gray-50 transition-colors" title={item.name}>
        <div className="line-clamp-2 leading-tight break-words font-semibold text-gray-800">
          {item.name}
        </div>
      </td>

      {/* SCROLLABLE DATA VALUES */}
      <td className="p-3 font-mono text-center text-gray-700 font-medium bg-white group-hover:bg-gray-50">
        <div className="flex flex-col items-center">
          <span className="font-bold text-gray-900">{item.foh}</span>
          {(item.foh_crt || item.foh_case) && (
            <span className="text-[10px] text-gray-400">
              ({item.foh_crt || 0}c / {item.foh_case || 0}Cs)
            </span>
          )}
        </div>
      </td>
      <td className="p-3 font-mono text-center text-gray-700 font-medium bg-white group-hover:bg-gray-50">
        <div className="flex flex-col items-center">
          <span className="font-bold text-gray-900">{item.boh}</span>
          {(item.boh_crt || item.boh_case) && (
            <span className="text-[10px] text-gray-400">
              ({item.boh_crt || 0}c / {item.boh_case || 0}Cs)
            </span>
          )}
        </div>
      </td>
      <td className="p-3 font-mono text-center text-gray-900 font-bold bg-gray-50/50 group-hover:bg-gray-50">
        {item.totalQty}
      </td>
      <td className="p-3 font-mono text-center text-gray-600 font-semibold bg-white group-hover:bg-gray-50">
        {item.onHandCSO}
      </td>

      <td className="p-3 font-mono text-center align-middle bg-white group-hover:bg-gray-50">
        <span className={`inline-flex items-center gap-0.5 font-bold ${variance === 0 ? "text-gray-500" : variance > 0 ? "text-green-600" : "text-red-600"}`}>
          {variance > 0 ? `+${variance}` : variance}
          {variance > 0 && <ArrowUp className="w-3 h-3 shrink-0" />}
          {variance < 0 && <ArrowDown className="w-3 h-3 shrink-0" />}
        </span>
      </td>

      <td className="p-3 font-mono text-right pr-6 align-middle bg-white group-hover:bg-gray-50">
        {dollarVariance === 0 ? (
          <span className="text-gray-500 font-medium">$0.00</span>
        ) : (
          <span className={`font-bold ${dollarVariance > 0 ? "text-green-600" : "text-red-600"}`}>
            {dollarVariance > 0 ? `+${formatCurrency(dollarVariance)}` : formatCurrency(dollarVariance)}
          </span>
        )}
      </td>
    </tr>
  );
});
ItemRow.displayName = 'ItemRow';

function RouteComponent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedSite } = useSite();

  const [date, setDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  });
  const [site, setSite] = useState<string>(selectedSite || user?.location || "");
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [activeBarcodeItem, setActiveBarcodeItem] = useState<ActiveBarcode | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    setShowPasswordDialog(true);
  }, []);

  const handlePasswordSuccess = () => {
    setHasAccess(true);
    setShowPasswordDialog(false);
  };

  const handlePasswordCancel = () => {
    setShowPasswordDialog(false);
    navigate({ to: '/cycle-count/count' });
  };

  const fetchReport = async () => {
    if (!date || !site) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const selectedDateStr = date.toISOString().slice(0, 10);

      const res = await axios.get("/api/cycle-count/daily-report", {
        headers: { Authorization: `Bearer ${token}` },
        params: { site, date: selectedDateStr },
      });

      setItems(res.data.data || []);
    } catch (err) {
      console.error("Error calling daily relational database reports:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) {
      fetchReport();
    }
  }, [date, site, hasAccess]);

  const groupedItems = items.reduce<Record<string, ReportItem[]>>((acc, item) => {
    const catName = item.categoryName || "Unassigned Categories";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  const toggleCategoryCollapse = (categoryName: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleOpenBarcodeDialog = (name: string, upc: string, image: string | null) => {
    setActiveBarcodeItem({ name, upc, image });
  };

  return (
    <>
      {!hasAccess && (
        <PasswordProtection
          isOpen={showPasswordDialog}
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
          userLocation={user?.location || "Rankin"}
        />
      )}

      {hasAccess && (
        <div className="p-6 max-w-[1600px] mx-auto transition-all duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cycle Count Variance Report</h1>
              <p className="text-xs text-gray-500 font-medium">Review stock deviations and currency impacts by category</p>
            </div>

            <div className="flex items-center gap-3">
              <DatePicker date={date} setDate={(val) => typeof val === 'function' ? setDate(val(date)) : setDate(val)} restrictToPast />
              <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-gray-200/80 bg-white shadow-sm max-h-[75vh]">
            <table className="w-full text-left border-collapse text-sm table-fixed min-w-[1150px]">
              <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.08)] uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 sticky left-0 bg-gray-50 z-40 text-center w-14 border-r border-gray-100">Image</th>
                  <th className="p-3 sticky left-[56px] bg-gray-50 z-40 w-36 font-mono border-r border-gray-100">UPC</th>
                  <th className="p-3 sticky left-[200px] bg-gray-50 z-40 w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.12)]">Description</th>
                  <th className="p-3 text-center w-28">FOH Count</th>
                  <th className="p-3 text-center w-28">BOH Count</th>
                  <th className="p-3 text-center w-24 bg-gray-100/40">Total Count</th>
                  <th className="p-3 text-center w-28">Expected (CSO)</th>
                  <th className="p-3 text-center w-28">Variance (Pcs)</th>
                  <th className="p-3 text-right pr-6 w-32">Variance (C$)</th>
                </tr>
              </thead>

              {loading && (
                <tbody className="text-gray-600">
                  <tr>
                    <td colSpan={9} className="text-center py-12 font-medium text-gray-400">
                      Processing relational operational records...
                    </td>
                  </tr>
                </tbody>
              )}

              {!loading && items.length === 0 && (
                <tbody className="text-gray-600">
                  <tr>
                    <td colSpan={9} className="text-center py-12 font-medium text-gray-400">
                      No matching calculated count metrics verified for this selection.
                    </td>
                  </tr>
                </tbody>
              )}

              {!loading && Object.entries(groupedItems).map(([categoryName, categoryRows]) => {
                const isCollapsed = !!collapsedCategories[categoryName];

                return (
                  <tbody key={`group-${categoryName}`} className="divide-y divide-gray-100 text-gray-600">
                    {/* Collapsible Category Label Banner */}
                    <tr
                      onClick={() => toggleCategoryCollapse(categoryName)}
                      className="bg-gray-100/80 hover:bg-gray-200/70 cursor-pointer select-none transition-colors border-y"
                    >
                      <td colSpan={9} className="p-3 font-bold text-gray-800 text-[11px] tracking-wide uppercase sticky left-0 z-20 bg-gray-100/80">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />}
                          <span>{categoryName}</span>
                          <span className="ml-1 px-2 py-0.5 rounded-full bg-white text-gray-600 text-[10px] font-bold border border-gray-200">
                            {categoryRows.length} {categoryRows.length === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Content Section Rows */}
                    {!isCollapsed && categoryRows.map((item) => (
                      <ItemRow
                        key={item._id}
                        item={item}
                        onOpenBarcode={handleOpenBarcodeDialog}
                      />
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>

          {/* Barcode Identity Dialog */}
          <Dialog open={!!activeBarcodeItem} onOpenChange={(open) => { if (!open) setActiveBarcodeItem(null); }}>
            <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden p-0 border-none bg-white">
              <div className="w-full h-48 bg-gray-50 relative border-b border-gray-100">
                <div className="absolute top-4 left-0 right-0 text-center z-10">
                  <span className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] uppercase tracking-tighter font-black text-gray-500 shadow-sm border border-white/50">
                    Verify Product Identity
                  </span>
                </div>
                {activeBarcodeItem?.image ? (
                  <img
                    src={activeBarcodeItem.image}
                    alt={activeBarcodeItem.name}
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Image Available</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center items-center p-8 pt-6">
                <div className="w-full p-6 bg-white rounded-2xl border-2 border-gray-100 mb-6 flex justify-center shadow-sm">
                  {activeBarcodeItem?.upc && (
                    <Barcode
                      value={activeBarcodeItem.upc}
                      width={2.2}
                      height={100}
                      displayValue={false}
                    />
                  )}
                </div>

                <div className="text-center px-4 w-full">
                  <h3 className="text-sm font-black text-gray-900 leading-tight mb-2 truncate" title={activeBarcodeItem?.name}>
                    {activeBarcodeItem?.name}
                  </h3>
                  <div className="inline-block bg-blue-50 px-4 py-1.5 rounded-lg">
                    <p className="text-xs font-mono font-black text-blue-700 tracking-[0.15em]">
                      {activeBarcodeItem?.upc}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveBarcodeItem(null)}
                  className="mt-6 w-full py-3 bg-gray-900 text-white rounded-2xl font-bold transition-all hover:bg-black active:scale-[0.98] text-xs"
                >
                  Close
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </>
  );
}