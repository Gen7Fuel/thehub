import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAuth } from "@/context/AuthContext";
import { SitePicker } from '@/components/custom/sitePicker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PlusCircle, Search, Trash2 } from 'lucide-react';
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
  Damaged: 'bg-rose-100 text-rose-700 border-rose-200',
  Expired: 'bg-purple-100 text-purple-700 border-purple-200',
  Donation: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'About to Expire': 'bg-indigo-100 text-indigo-700 border-indigo-200',
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

  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);

  // Define Date Constraints
  const today = new Date();
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
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <SitePicker value={site} onValueChange={(s) => navigate({ search: { site: s } })} />

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

            <div className="space-y-4 pt-2">
              {/* Search */}
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

              {/* Form */}
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                {[
                  ['Product Name', 'name'],
                  ['UPC Barcode', 'upc_barcode']
                ].map(([label, field]) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </label>
                    <Input
                      value={(formData as any)[field]}
                      onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    />
                  </div>
                ))}

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

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Reason
                    </label>
                    <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conditional Expiry Date Picker */}
                  {formData.reason === 'About to Expire' && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                      <label className="text-[8.5px] font-semibold uppercase tracking-wide text-orange-600 font-bold">
                        Select Expiry Date (5-20 days from now)
                      </label>
                      <DatePicker
                        date={expiryDate}
                        setDate={(date: any) => {
                          if (date && (date < minExpiry || date > maxExpiry)) {
                            alert("Please select a date between 5 and 20 days from today.");
                            return;
                          }
                          setExpiryDate(date);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <Button className="w-full h-11 font-semibold" onClick={addItemToList} disabled={!formData.name}>
                Add to Write-Off List
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
    </div>
  );
}