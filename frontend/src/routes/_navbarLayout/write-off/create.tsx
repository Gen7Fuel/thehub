import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from "@/context/AuthContext";
import { SitePicker } from '@/components/custom/sitePicker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Info, PlusCircle, Search, Trash2 } from 'lucide-react';
import axios from 'axios';
import { DatePicker } from '@/components/custom/datePicker';

export const Route = createFileRoute('/_navbarLayout/write-off/create')({
  component: RouteComponent,
  validateSearch: (search: { site: string }) => ({ site: search.site }),
  loaderDeps: ({ search: { site } }) => ({ site }),
});

interface WriteOffItem {
  gtin?: string;
  upc_barcode: string;
  name: string;
  qty: number;
  onHandAtWriteOff?: number;
  reason: string;
  isManualEntry?: boolean;
  tempId: number;
  expiryDate?: Date;
}

export const REASONS = ['Breakage', 'Spoilage', 'Store Use', 'Deli', 'Stolen', 'Damaged', 'Expired', 'Donation', 'About to Expire'];

export const REASON_COLORS: Record<string, string> = {
  Breakage: 'bg-amber-100 text-amber-700 border-amber-200',
  Spoilage: 'bg-orange-100 text-orange-700 border-orange-200',
  'Store Use': 'bg-blue-100 text-blue-700 border-blue-200',
  Deli: 'bg-pink-100 text-pink-700 border-pink-200',
  Stolen: 'bg-red-100 text-red-700 border-red-200',
  Damaged: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Expired: 'bg-purple-100 text-purple-700 border-purple-200',
  Donation: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'About to Expire': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Bistro: 'bg-green-100 text-green-800 border-green-200',
};

function RouteComponent() {
  const { user } = useAuth();
  const { site } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [draftList, setDraftList] = useState<WriteOffItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formQuery, setFormQuery] = useState('');
  const [formResults, setFormResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [formData, setFormData] = useState<Partial<WriteOffItem>>({
    name: '',
    upc_barcode: '',
    qty: 1,
    reason: 'Damaged'
  });
  const [entryMode, setEntryMode] = useState<'regular' | 'bistro'>('regular');

  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Define Date Constraints
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minExpiry = new Date();
  minExpiry.setDate(today.getDate() + 5); // 5 days from now
  const maxExpiry = new Date();
  maxExpiry.setDate(today.getDate() + 20); // 20 days from now

  useEffect(() => {
    if (!site && user?.location) {
      navigate({ search: { site: user.location } });
    }
  }, [site, user?.location]);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (formQuery.length > 2) {
        setIsSearching(true);
        try {
          const res = await axios.get(`/api/cycle-count/search`, {
            params: { site, q: formQuery },
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
              "X-Required-Permission": "writeOff.create"
            }
          });
          setFormResults(res.data);
        } catch (err: any) {
          if (err.response?.status === 403) navigate({ to: "/no-access" });
          setFormResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setFormResults([]);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [formQuery, site, navigate]);

  const selectFromSearch = (item: any) => {
    setFormData({
      ...formData,
      name: item.name,
      upc_barcode: item.upc_barcode,
      gtin: item.gtin,
      onHandAtWriteOff: item.onHandCSO
    });
    setFormQuery('');
    setFormResults([]);
  };

  const addItemToList = () => {
    if (!formData.name || !formData.upc_barcode) return;

    // Validation for ATE items
    if (formData.reason === 'About to Expire' && !expiryDate) {
      alert("Please select an expiry date for this item.");
      return;
    }

    setDraftList([
      {
        ...formData as WriteOffItem,
        name: formData.name!,
        upc_barcode: formData.upc_barcode!,
        qty: formData.qty || 1,
        reason: formData.reason || 'Damaged',
        expiryDate: formData.reason === 'About to Expire' ? expiryDate : undefined, // Attach date
        tempId: Math.random(),
      },
      ...draftList
    ]);

    // Reset
    setFormData({ name: '', upc_barcode: '', qty: 1, reason: 'Damaged' });
    setExpiryDate(undefined);
    setIsDialogOpen(false);
  };

  const updateDraftItem = (index: number, field: string, value: any) => {
    setDraftList(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const submitWriteOff = async () => {
    if (!draftList.length) return;
    if (!window.confirm("Are you sure you want to submit this write-off? The list cannot be edited after submission and the page will be reloaded.")) return;

    try {
      const res = await axios.post('/api/write-off', {
        site,
        submittedBy: user?.email,
        items: draftList, // Backend will split these
        timestamp: Date.now()
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "writeOff.create"
        }
      });

      // res.data.lists will be an array like ["WO-SITE-123", "ATE-SITE-123"]
      const listNames = res.data.lists.join(" and ");
      alert(`Successfully created: ${listNames}`);

      setDraftList([]);
      // Optional: navigate to the dashboard to see the new lists
      navigate({ to: '/write-off' });
    } catch (e: any) {
      if (e.response?.status === 403) navigate({ to: "/no-access" });
      alert("Submission failed. Please try again.");
    }
  };

  return (
    <div className="min-w-2xl mx-auto p-6 flex flex-col h-[calc(100vh-100px)] space-y-6 antialiased font-sans">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
        {/* Site Picker pinned to the left */}
        <div className="shrink-0">
          <SitePicker value={site} onValueChange={(s) => navigate({ search: { site: s } })} />
        </div>

        {/* Warning Message centered with equal gaps */}
        {draftList.length > 0 && (
          <div className="flex-1 max-w-md mx-auto px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
            <div className="bg-amber-100 p-1.5 rounded-full shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-[11px] text-amber-800 leading-tight">
              <strong className="font-semibold">Unsaved Progress:</strong> Your list is currently
              stored locally. You must <strong>Submit Write-Off Request</strong> to save these
              items. Refreshing or leaving this page will result in loss of work.
            </p>
          </div>
        )}
        {/* Add Item Button pinned to the right */}
        <div className="shrink-0">
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setFormQuery(''); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <PlusCircle className="w-4 h-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold tracking-tight">
                  Add Item for Write-Off
                </DialogTitle>
              </DialogHeader>

              {/* Mode Selector Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-lg mb-4">
                <button
                  onClick={() => {
                    setEntryMode('regular');
                    setFormData({ ...formData, reason: 'Damaged' });
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${entryMode === 'regular' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Regular Product
                </button>
                <button
                  onClick={() => {
                    setEntryMode('bistro');
                    setFormData({ ...formData, name: '', upc_barcode: 'Bistro', reason: 'Spoilage' });
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${entryMode === 'bistro' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  Bistro Item
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {/* Search - Only show for Regular mode */}
                {entryMode === 'regular' && (
                  <> {/* <--- ADD THIS FRAGMENT START */}
                    {/* Guidelines Callout */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-blue-900 uppercase tracking-tight">
                          Write-Off Guidelines (About to Expire)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[
                          { cat: "Deli / Fresh Food", days: "1–3 days" },
                          { cat: "Dairy", days: "5–7 days" },
                          { cat: "Bakery Items", days: "1–2 days" },
                          { cat: "Packaged Grocery", days: "14–30 days" },
                          { cat: "Beverages", days: "14–30 days" },
                        ].map((row) => (
                          <div key={row.cat} className="flex justify-between text-[11px] border-b border-blue-100/50 pb-0.5">
                            <span className="text-slate-600">{row.cat}</span>
                            <span className="font-bold text-blue-700">{row.days}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Search Input Group */}
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="Search by product name or barcode…"
                        value={formQuery}
                        onChange={(e) => setFormQuery(e.target.value)}
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-3 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      )}
                      {formResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-48 overflow-y-auto">
                          {formResults.map((item: any) => (
                            <div
                              key={item._id}
                              onClick={() => selectFromSearch(item)}
                              className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer border-b last:border-0"
                            >
                              <p className="font-medium text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{item.upc_barcode}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </> 
                )}
                {/* Form Fields */}
                <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Product Name
                    </label>
                    <Input
                      placeholder={entryMode === 'bistro' ? "e.g., Tomatoes, Onions, etc" : ""}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  {/* UPC - Only show for Regular mode */}
                  {entryMode === 'regular' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        UPC Barcode
                      </label>
                      <Input
                        value={formData.upc_barcode}
                        onChange={(e) => setFormData({ ...formData, upc_barcode: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Qty
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.qty}
                        onChange={(e) => setFormData({ ...formData, qty: Number(e.target.value) })}
                      />
                    </div>

                    {/* Reason - Hidden or Disabled for Bistro */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Reason
                      </label>
                      <Select
                        value={formData.reason}
                        onValueChange={(v) => setFormData({ ...formData, reason: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REASONS
                            // Filter out "About to Expire" if it's a Bistro item
                            .filter(r => entryMode === 'bistro' ? r !== 'About to Expire' : true)
                            .map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                  {/* Conditional Expiry Date Picker Fix */}
                  {formData.reason === 'About to Expire' && (
                    <div className="space-y-1 pt-1 animate-in fade-in slide-in-from-top-1 w-full">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 block">
                        Select Expiry Date
                      </label>
                      {/* Wrapping in a div to ensure the DatePicker doesn't flex-row with the label */}
                      <div className="w-full">
                        <DatePicker
                          date={expiryDate}
                          setDate={(date: any) => {
                            if (date && date <= today) {
                              alert("Please select a date in the future.");
                              return;
                            }
                            setExpiryDate(date);
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button className="w-full h-11 font-semibold" onClick={addItemToList} disabled={!formData.name}>
                  Add {entryMode === 'bistro' ? 'Bistro Item' : 'to Write-Off List'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Draft List */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b bg-slate-50 flex justify-between items-center">
          <h2 className="font-semibold tracking-tight text-slate-900">Write-Off List</h2>
          <span className="text-xs font-semibold bg-slate-200 px-2.5 py-1 rounded-full text-slate-700">
            {draftList.length} Items
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {draftList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Search className="w-10 h-10 opacity-20 mb-2" />
              <p className="text-sm italic">Your write-off list is empty</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-3">
              {draftList.map((item, idx) => (
                <AccordionItem key={item.tempId} value={`item-${idx}`} className="border rounded-xl bg-white">
                  <AccordionTrigger className="px-4 py-4 hover:no-underline">
                    <div className="flex justify-between w-full items-center pr-4">
                      <div className="space-y-1 text-left">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs font-mono text-slate-400">{item.upc_barcode}</p>
                      </div>

                      <div className="flex items-center gap-6">
                        {item.reason === 'About to Expire' && item.expiryDate && (
                          <div className="text-right border-r pr-4 border-slate-200">
                            <p className="text-[10px] text-indigo-500 uppercase font-bold">Expires On</p>
                            <p className="text-sm font-bold text-slate-900">
                              {new Date(item.expiryDate).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${REASON_COLORS[item.reason]}`}>
                          {item.reason}
                        </span>

                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 uppercase">Qty</p>
                          <p className="text-sm font-semibold text-slate-900">{item.qty}</p>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-4 pb-4 pt-2 border-t">
                    <div className="flex justify-between items-end">
                      <div className="w-32 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-slate-500">
                          Update Qty
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateDraftItem(idx, 'qty', Number(e.target.value))}
                        />
                      </div>

                      <Button
                        variant="ghost"
                        className="text-destructive font-semibold gap-2 hover:bg-red-50"
                        onClick={() => setDraftList(draftList.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {draftList.length > 0 && (
          <div className="p-6 border-t bg-white flex justify-end shadow-[0_-4px_16px_-10px_rgba(0,0,0,0.15)]">
            <Button className="px-10 h-11 rounded-xl font-semibold" onClick={submitWriteOff}>
              Submit Write-Off List ({draftList.length})
            </Button>
          </div>
        )}
      </div>
    </div >
  );
}