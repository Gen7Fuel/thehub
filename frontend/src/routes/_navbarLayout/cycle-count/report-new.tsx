// routes/_navbarLayout/cycle-count/report-new.tsx
import { useState, useEffect, memo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { ArrowUp, ArrowDown, Image as ImageIcon, ChevronDown, Eye, ChevronRight, ScanBarcode, AlertCircle, CheckCircle2, Send, MessageSquare } from "lucide-react";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";
import { DatePicker } from '@/components/custom/datePicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  pk_in_crt: number;
  foh: number;
  foh_crt: number | null;
  boh: number;
  boh_crt: number | null;
  count_completed: boolean;
  priority: boolean;
}

interface ActiveBarcode {
  name: string;
  upc: string;
  image: string | null;
}

interface ThreadNote {
  id: number;
  note: string;
  createdAt: string;
  userName: string;
}

// Optimized sub-row component to cleanly display stacked values without conversion
const CrateBreakdown = ({ loosePacks, rawCrates }: { loosePacks: number; rawCrates: number }) => {
  return (
    <div className="mt-0.5 pt-0.5 border-t border-slate-100 text-[10px] text-left mx-auto w-max font-sans text-slate-500 space-y-0.5 leading-tight">
      <div><span className="font-semibold text-slate-400">Pks:</span> {loosePacks}</div>
      <div><span className="font-semibold text-slate-400">Crt:</span> {rawCrates}</div>
    </div>
  );
};

const ItemRow = memo(({
  item,
  onOpenBarcode
}: {
  item: ReportItem;
  onOpenBarcode: (name: string, upc: string, image: string | null) => void;
}) => {
  // Calculations apply to completed counts
  const fohCratePacks = (item.foh_crt || 0) * (item.pk_in_crt || 0);
  const bohCratePacks = (item.boh_crt || 0) * (item.pk_in_crt || 0);
  const computedTotalQty = item.foh + item.boh + fohCratePacks + bohCratePacks;

  const hasCSO = item.onHandCSO !== undefined && item.onHandCSO !== null;
  const variance = hasCSO ? computedTotalQty - item.onHandCSO : 0;
  const dollarVariance = variance * item.unitPrice;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);

  const hasFohCrates = item.foh_crt !== null && item.foh_crt !== undefined && item.foh_crt >= 0;
  const hasBohCrates = item.boh_crt !== null && item.boh_crt !== undefined && item.boh_crt >= 0;

  // Render logic variations if the sequence was bypassed or incomplete
  if (!item.count_completed) {
    return (
      <tr className="border-b border-rose-100/70 bg-rose-50/20 hover:bg-rose-50/40 transition-colors group text-xs text-slate-400">
        <td className="p-2.5 sticky left-0 z-10 align-middle text-center w-14 bg-[#fffafb] group-hover:bg-rose-50/40 transition-colors border-r border-rose-100/40">
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden border border-slate-200/40 mx-auto grayscale opacity-60">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ImageIcon className="w-4 h-4 opacity-30" />
              </div>
            )}
          </div>
        </td>
        <td className="p-3 sticky left-[56px] z-10 font-mono align-middle w-36 bg-[#fffafb] group-hover:bg-rose-50/40 transition-colors border-r border-rose-100/40">
          <button
            type="button"
            onClick={() => onOpenBarcode(item.name, item.upc_barcode, item.image_url)}
            className="flex items-center gap-1 font-mono text-slate-500 hover:bg-slate-100 px-1.5 py-1 rounded transition-colors text-left truncate w-full"
          >
            <ScanBarcode className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span className="font-semibold truncate">{item.upc_barcode || "NO UPC"}</span>
          </button>
        </td>
        <td className="p-3 sticky left-[200px] z-10 font-medium align-middle w-54 bg-[#fffafb] group-hover:bg-rose-50/40 transition-colors border-r border-rose-100/40 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.04)] italic text-slate-500" title={item.name}>
          <div className="line-clamp-2 leading-tight break-words pr-2">
            {item.name}
          </div>
        </td>
        <td className="p-3 text-center align-middle w-28 font-medium text-slate-300">-</td>
        <td className="p-3 text-center align-middle w-28 font-medium text-slate-300">-</td>
        <td className="p-3 text-center align-middle w-24 border-x border-rose-100/40 font-medium text-slate-300">-</td>
        <td className="p-3 font-mono text-center align-middle w-28 text-rose-900/80 font-bold bg-rose-50/30">
          {item.onHandCSO}
        </td>
        <td className="p-3 text-center align-middle w-28 font-medium text-slate-300">-</td>
        <td className="p-3 text-right pr-6 align-middle w-32 font-medium text-slate-300">$-</td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 bg-white hover:bg-slate-50/60 transition-colors group text-xs">
      {/* STICKY LOGISTICS IMAGE */}
      <td className="p-2.5 sticky left-0 z-10 align-middle text-center w-14 bg-white group-hover:bg-slate-50/60 transition-colors border-r border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden border border-slate-200/60 mx-auto">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <ImageIcon className="w-4 h-4 opacity-30" />
            </div>
          )}
        </div>
      </td>

      {/* STICKY INTERACTIVE UPC BUTTON */}
      <td className="p-3 sticky left-[56px] z-10 font-mono align-middle w-36 bg-white group-hover:bg-slate-50/60 transition-colors border-r border-slate-100">
        <button
          type="button"
          onClick={() => onOpenBarcode(item.name, item.upc_barcode, item.image_url)}
          className="flex items-center gap-1 font-mono text-blue-600 hover:bg-blue-50/80 px-1.5 py-1 rounded transition-colors text-left truncate w-full"
        >
          <ScanBarcode className="w-3.5 h-3.5 shrink-0 text-blue-500" />
          <span className="font-bold truncate">{item.upc_barcode || "NO UPC"}</span>
        </button>
      </td>

      {/* STICKY DESCRIPTION COLUMN WITH LINE CLAMP WRAPPING */}
      <td className="p-3 sticky left-[200px] z-10 font-medium text-slate-900 align-middle w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)] bg-white group-hover:bg-slate-50/60 transition-colors border-r border-slate-100" title={item.name}>
        <div className="line-clamp-2 leading-tight break-words font-semibold text-slate-800 pr-1">
          {item.name}
        </div>
      </td>

      {/* FOH COLUMN */}
      <td className="p-3 font-mono text-center align-top w-28 bg-white group-hover:bg-slate-50/60">
        {hasFohCrates ? (
          <CrateBreakdown loosePacks={item.foh} rawCrates={item.foh_crt!} />
        ) : (
          <span className="font-bold text-slate-900 block mt-1">{item.foh}</span>
        )}
      </td>

      {/* BOH COLUMN */}
      <td className="p-3 font-mono text-center align-top w-28 bg-white group-hover:bg-slate-50/60">
        {hasBohCrates ? (
          <CrateBreakdown loosePacks={item.boh} rawCrates={item.boh_crt!} />
        ) : (
          <span className="font-bold text-slate-900 block mt-1">{item.boh}</span>
        )}
      </td>

      {/* COMPILED PACK QUANTITIES */}
      <td className="p-3 font-mono text-center align-middle w-24 bg-slate-50/40 group-hover:bg-slate-50/80 font-black text-slate-900 border-r border-slate-100">
        {computedTotalQty}
      </td>

      <td className="p-3 font-mono text-center align-middle w-28 bg-white group-hover:bg-slate-50/60 text-slate-600 font-semibold">
        {item.onHandCSO}
      </td>

      {/* PIECE VARIANCE */}
      <td className="p-3 font-mono text-center align-middle w-28 bg-white group-hover:bg-slate-50/60">
        <span className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded ${variance === 0 ? "text-slate-500" : variance > 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
          {variance > 0 ? `+${variance}` : variance}
          {variance > 0 && <ArrowUp className="w-3 h-3 shrink-0" />}
          {variance < 0 && <ArrowDown className="w-3 h-3 shrink-0" />}
        </span>
      </td>

      {/* VALUATION VARIANCE */}
      <td className="p-3 font-mono text-right pr-6 align-middle w-32 bg-white group-hover:bg-slate-50/60">
        {dollarVariance === 0 ? (
          <span className="text-slate-400 font-medium">$0.00</span>
        ) : (
          <span className={`font-bold ${dollarVariance > 0 ? "text-emerald-600" : "text-rose-600"}`}>
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
  const [instanceId, setInstanceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [activeBarcodeItem, setActiveBarcodeItem] = useState<ActiveBarcode | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  // Thread Sub-states
  const [notes, setNotes] = useState<ThreadNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [postingNote, setPostingNote] = useState(false);

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

      // Supporting unified response payload containing the root instance container mapping
      setItems(res.data.data || []);
      setInstanceId(res.data.instanceId || null);

      if (res.data.instanceId) {
        fetchThreadNotes(res.data.instanceId);
      } else {
        setNotes([]);
      }
    } catch (err) {
      console.error("Error executing cycle variance calculations:", err);
    }
    setLoading(false);
  };

  const fetchThreadNotes = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`/api/cycle-count/instance-notes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes(res.data.data || []);
    } catch (err) {
      console.error("Error fetching instance notes list:", err);
    }
  };

  const handlePostNote = async () => {
    if (!instanceId || !newNoteText.trim() || postingNote) return;

    setPostingNote(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/cycle-count/instance-notes", {
        instanceId,
        note: newNoteText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNewNoteText("");
      await fetchThreadNotes(instanceId);
    } catch (err) {
      console.error("Error adding comment entry to instance log:", err);
    }
    setPostingNote(false);
  };

  useEffect(() => {
    if (hasAccess) {
      fetchReport();
    }
  }, [date, site, hasAccess]);

  const completedRecords = items.filter(i => i.count_completed);
  const uncompletedRecords = items.filter(i => !i.count_completed);

  const groupedCompleted = completedRecords.reduce<Record<string, ReportItem[]>>((acc, item) => {
    const catName = item.categoryName || "Unassigned Categories";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  const toggleCategoryCollapse = (categoryName: string) => {
    setCollapsedCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }));
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
        <div className="min-h-screen bg-slate-50/60 p-3 sm:p-4 lg:p-6 flex flex-col justify-start items-center select-none font-sans antialiased w-full max-w-full overflow-x-hidden">
          <div className="w-full max-w-full lg:max-w-[1400px]">

            {/* Header / Filter Module */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-2xs">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Cycle Count Analytics
                </h1>
              </div>

              {/* CENTER CONSOLE: EXPANDED COMMENT INSTANCE FIELD */}
              {instanceId ? (
                <div className="w-full md:flex-1 md:max-w-4xl bg-slate-50 border border-slate-200/80 rounded-xl p-2 flex items-center gap-2 mx-0 xl:mx-4">
                  <textarea
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add comments related to this count report....."
                    rows={1}
                    className="flex-1 bg-transparent text-xs p-1.5 px-2 focus:outline-hidden resize-none font-medium placeholder-slate-400 max-h-10 text-slate-800"
                  />
                  <button
                    onClick={handlePostNote}
                    disabled={!newNoteText.trim() || postingNote}
                    className="p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all disabled:opacity-30 disabled:hover:bg-slate-900 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <div className="h-6 w-[1px] bg-slate-200 mx-0.5 shrink-0" />
                  <button
                    onClick={() => setIsThreadOpen(true)}
                    title={`View Thread (${notes.length})`}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg transition-colors text-[11px] font-bold shrink-0 shadow-3xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>({notes.length})</span>
                  </button>
                </div>
              ) : (
                <div className="flex-1 max-w-2xl text-center py-2 text-xs italic text-slate-400 font-medium">
                  Select a location setup matching an active scheduled sequence to drop thread comments.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <DatePicker date={date} setDate={(val) => typeof val === 'function' ? setDate(val(date)) : setDate(val)} restrictToPast />
                <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
              </div>
            </div>

            {/* MAIN COMPLETED TRACKS TABLE */}
            <div className="w-full max-w-full bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden mb-8">
              <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Reconciled Core Matrix ({completedRecords.length})</h2>
              </div>

              <div className="overflow-x-auto w-full max-h-[60vh] block clear-both style-scrollbar">
                <table className="w-full text-left border-collapse text-sm table-fixed min-w-[1100px] md:min-w-full">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-30 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 sticky left-0 bg-slate-100 z-40 text-center w-14 border-r border-slate-200">Image</th>
                      <th className="p-3 sticky left-[56px] bg-slate-100 z-40 w-36 font-mono border-r border-slate-200">UPC</th>
                      <th className="p-3 sticky left-[200px] bg-slate-100 z-40 w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)] border-r border-slate-200">Description</th>
                      <th className="p-3 text-center w-28">FOH Count</th>
                      <th className="p-3 text-center w-28">BOH Count</th>
                      <th className="p-3 text-center w-24 bg-slate-200/50 text-slate-800 font-black">Total Pack</th>
                      <th className="p-3 text-center w-28">Expected (CSO)</th>
                      <th className="p-3 text-center w-28">Variance (Pcs)</th>
                      <th className="p-3 text-right pr-6 w-32">Variance (C$)</th>
                    </tr>
                  </thead>

                  {loading && (
                    <tbody>
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">Processing database records...</td>
                      </tr>
                    </tbody>
                  )}

                  {!loading && completedRecords.length === 0 && (
                    <tbody>
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400 font-medium">No verified completed sequences match parameters.</td>
                      </tr>
                    </tbody>
                  )}

                  {!loading && Object.entries(groupedCompleted).map(([categoryName, categoryRows]) => {
                    const isCollapsed = !!collapsedCategories[categoryName];
                    return (
                      <tbody key={`group-${categoryName}`} className="border-b border-slate-100 last:border-none">
                        <tr onClick={() => toggleCategoryCollapse(categoryName)} className="bg-slate-50/80 hover:bg-slate-100/70 cursor-pointer select-none transition-colors border-y border-slate-200/60">
                          <td colSpan={9} className="p-2.5 font-bold text-slate-700 text-[11px] uppercase tracking-wide sticky left-0 z-20 bg-slate-50/80">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                              <span>{categoryName}</span>
                              <span className="ml-1.5 px-2 py-0.5 rounded-full bg-white text-slate-500 text-[10px] font-bold border border-slate-200 shadow-3xs">
                                {categoryRows.length}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && categoryRows.map((item) => (
                          <ItemRow key={item._id} item={item} onOpenBarcode={handleOpenBarcodeDialog} />
                        ))}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            </div>

            {/* SECONDARY PENDING / UNCOMPLETED COUNTS SECTION */}
            <div className="w-full max-w-full bg-white rounded-2xl border border-rose-200 shadow-2xs overflow-hidden">
              <div className="p-4 bg-rose-50/40 border-b border-rose-100/80 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <h2 className="text-xs font-black text-rose-900 uppercase tracking-wider">Incomplete Counts ({uncompletedRecords.length})</h2>
              </div>

              <div className="overflow-x-auto w-full max-h-[45vh] block clear-both style-scrollbar">
                <table className="w-full text-left border-collapse text-sm table-fixed min-w-[1100px] md:min-w-full">
                  <thead className="bg-rose-50/20 text-rose-800 font-bold sticky top-0 z-30 shadow-[0_1px_0_0_rgba(225,29,72,0.06)] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 sticky left-0 bg-[#fff9f9] z-40 text-center w-14 border-r border-rose-100/50">Image</th>
                      <th className="p-3 sticky left-[56px] bg-[#fff9f9] z-40 w-36 font-mono border-r border-rose-100/50">UPC</th>
                      <th className="p-3 sticky left-[200px] bg-[#fff9f9] z-40 w-54 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.03)] border-r border-rose-100/50">Description</th>
                      <th className="p-3 text-center w-28">FOH Count</th>
                      <th className="p-3 text-center w-28">BOH Count</th>
                      <th className="p-3 text-center w-24 border-x border-rose-100/30">Total Pack</th>
                      <th className="p-3 text-center w-28">Expected (CSO)</th>
                      <th className="p-3 text-center w-28">Variance (Pcs)</th>
                      <th className="p-3 text-right pr-6 w-32">Variance (C$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && uncompletedRecords.map((item) => (
                      <ItemRow key={item._id} item={item} onOpenBarcode={handleOpenBarcodeDialog} />
                    ))}
                    {!loading && uncompletedRecords.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-slate-400 italic text-xs">
                          All scheduled items for this date range have successfully finalized core updates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DIALOG A: INSTANCE NOTES THREAD */}
      <Dialog open={isThreadOpen} onOpenChange={setIsThreadOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl overflow-hidden p-0 border-none bg-white">
          <DialogHeader className="p-5 bg-slate-50 border-b border-slate-100">
            <DialogTitle className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Instance Comment Logs Thread
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3.5 bg-slate-50/30">
            {notes.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-medium italic">
                No ledger exceptions noted for this instance record yet.
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-3xs flex flex-col gap-1 text-left">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1.5 mb-1">
                    <span className="font-bold text-slate-800 text-xs">{note.userName}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      {new Date(note.createdAt).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium font-sans whitespace-pre-wrap">{note.note}</p>
                </div>
              ))
            )}
          </div>
          <div className="p-4 bg-white border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setIsThreadOpen(false)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold transition-all hover:bg-black"
            >
              Close Thread Map
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Verification Dialog */}
      <Dialog open={!!activeBarcodeItem} onOpenChange={(open) => { if (!open) setActiveBarcodeItem(null); }}>
        <DialogContent className="sm:max-w-md rounded-3xl overflow-hidden p-0 border-none bg-white">
          <div className="w-full h-48 bg-slate-50 relative border-b border-slate-100">
            {activeBarcodeItem?.image ? (
              <img src={activeBarcodeItem.image} alt={activeBarcodeItem.name} className="w-full h-full object-contain p-4" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <ImageIcon className="w-12 h-12 mb-2 opacity-20" />
                <span className="text-xs font-bold uppercase tracking-widest opacity-40">No Image Available</span>
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center items-center p-8 pt-6">
            <div className="w-full p-6 bg-white rounded-2xl border-2 border-slate-100 mb-6 flex justify-center shadow-xs">
              {activeBarcodeItem?.upc && (
                <Barcode value={activeBarcodeItem.upc} width={2.2} height={100} displayValue={false} />
              )}
            </div>
            <div className="text-center px-4 w-full">
              <h3 className="text-sm font-black text-slate-900 mb-2 truncate">{activeBarcodeItem?.name}</h3>
              <div className="inline-block bg-blue-50 px-4 py-1.5 rounded-lg">
                <p className="text-xs font-mono font-black text-blue-700 tracking-[0.15em]">{activeBarcodeItem?.upc}</p>
              </div>
            </div>
            <button onClick={() => setActiveBarcodeItem(null)} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs">
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}