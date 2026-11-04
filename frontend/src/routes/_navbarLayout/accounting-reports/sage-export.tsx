import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building, Calendar, FileSpreadsheet, Mail, Pencil, Plus } from "lucide-react";
import { DatePicker } from "@/components/custom/datePicker";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useSite } from "@/context/SiteContext";
import { useAuth } from "@/context/AuthContext";
import { loadLocations } from "@/lib/locationsCache";
import { accountingReportsApi } from "@/api/accounting-reports/accounting-reports.api";
import { accountingReportsService } from "@/api/accounting-reports/accounting-reports.service";
import { SAGE_MAPPING_FIELDS, type SageAccountMap, type SageGlAccount } from "@/api/accounting-reports/accounting-reports.types";
import { isApiError } from "@/api/core/errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_navbarLayout/accounting-reports/sage-export")({ component: RouteComponent });
const permission = "accounting.accountingReports.sageExport";
const emptyRows = (): SageGlAccount[] => SAGE_MAPPING_FIELDS.map((mappingField) => ({ mappingField, accName: "", accNo: "" }));

const formatDateForRequest = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function RouteComponent() {
  const { user } = useAuth();
  const { selectedSite } = useSite();
  const [site, setSite] = useState(selectedSite || user?.location || "");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [locations, setLocations] = useState<Array<{ _id: string; stationName: string }>>([]);
  const [mapping, setMapping] = useState<SageAccountMap | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState({ depositAccName: "", depositAccountNumber: "", glaccount: emptyRows() });
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const locationId = useMemo(() => locations.find((location) => location.stationName === site)?._id, [locations, site]);

  useEffect(() => { loadLocations<{ _id: string; stationName: string }>().then(setLocations).catch(() => setLocations([])); }, []);
  useEffect(() => { if (selectedSite) setSite(selectedSite); }, [selectedSite]);
  useEffect(() => {
    if (!locationId) { setMapping(null); return; }
    setLoadingMapping(true);
    accountingReportsApi.getSageAccountMap(locationId, { permission }).then(setMapping).catch((err) => setError(isApiError(err) ? err.message : "Unable to load Sage account mapping.")).finally(() => setLoadingMapping(false));
  }, [locationId]);

  const openMapping = (isEditing: boolean) => {
    setError(null); setEditing(isEditing);
    setDraft(mapping ? { depositAccName: mapping.depositAccName, depositAccountNumber: mapping.depositAccountNumber, glaccount: SAGE_MAPPING_FIELDS.map((field) => mapping.glaccount.find((row) => row.mappingField === field) || { mappingField: field, accName: "", accNo: "" }) } : { depositAccName: "", depositAccountNumber: "", glaccount: emptyRows() });
    setDialogOpen(true);
  };

  const saveMapping = async () => {
    if (!locationId || !draft.depositAccName.trim() || !draft.depositAccountNumber.trim()) { setError("Complete the deposit account number and name before saving."); return; }
    setSaving(true); setError(null);
    try {
      const saved = mapping ? await accountingReportsApi.updateSageAccountMap(mapping._id, { depositAccName: draft.depositAccName, depositAccountNumber: draft.depositAccountNumber, glaccount: draft.glaccount }, { permission }) : await accountingReportsApi.createSageAccountMap({ site: locationId, depositAccName: draft.depositAccName, depositAccountNumber: draft.depositAccountNumber, glaccount: draft.glaccount }, { permission });
      setMapping(saved); setDialogOpen(false);
    } catch (err) { setError(isApiError(err) ? err.message : "Unable to save Sage account mapping."); } finally { setSaving(false); }
  };

  const updateRow = (index: number, key: "accName" | "accNo", value: string) => setDraft((current) => ({ ...current, glaccount: current.glaccount.map((row, i) => i === index ? { ...row, [key]: value } : row) }));

  const handleSubmit = async () => {
    if (!mapping || !date || !site) return;
    setSubmitting(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await accountingReportsService.requestSageExport({
        stationName: site,
        date: formatDateForRequest(date),
      });
      setStatusMessage(response.message || `The Sage import report will be emailed directly to ${user?.email || "your email address"} shortly.`);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Failed to generate the Sage export report.");
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="p-6 max-w-5xl mx-auto space-y-6">
    <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-zinc-800"><div><h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sage Export Report</h1><p className="text-sm text-slate-500 dark:text-zinc-400">Prepare a daily sales Excel import for Sage.</p></div><button type="button" onClick={() => openMapping(!mapping)} disabled={!locationId || loadingMapping} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">{mapping ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{mapping ? "View Sage Account Mapping" : "Add Sage Account Mapping"}</button></div>
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm"><div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end"><div className="space-y-1.5"><label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1"><Building className="w-3.5 h-3.5" /> Station Location</label><LocationPicker setStationName={setSite} value="stationName" defaultValue={site} /></div><div className="space-y-1.5"><label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Report Date</label><DatePicker date={date} setDate={(value) => typeof value === "function" ? setDate(value(date)) : setDate(value)} /></div></div>{error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{statusMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{statusMessage}</div>}<div className="flex items-center gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-amber-900 dark:text-amber-200 text-sm"><Mail className="h-4 w-4 shrink-0 text-amber-600" /><span>{mapping ? "Click to export a Sage Excel import to be emailed and uploaded to Sage for daily sales." : "Use the button above to add the Sage account information to continue."}</span></div><div className="flex justify-end pt-2"><button type="button" onClick={handleSubmit} disabled={!mapping || !date || submitting} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><FileSpreadsheet className="w-4 h-4" />{submitting ? "Generating & Emailing..." : "Export Sage Excel Import"}</button></div></div></div>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? (mapping ? "Edit Sage Account Mapping" : "Add Sage Account Mapping") : "Sage Account Mapping"}</DialogTitle></DialogHeader><div className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="space-y-1 text-sm font-medium">Deposit Account Number<input disabled={!editing} value={draft.depositAccountNumber} onChange={(e) => setDraft({ ...draft, depositAccountNumber: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 font-normal" /></label><label className="space-y-1 text-sm font-medium">Deposit Account Name<input disabled={!editing} value={draft.depositAccName} onChange={(e) => setDraft({ ...draft, depositAccName: e.target.value })} className="mt-1 w-full rounded-md border px-3 py-2 font-normal" /></label></div><section><h2 className="mb-3 text-base font-semibold">GL Account entry</h2><div className="space-y-3">{draft.glaccount.map((row, index) => <div key={row.mappingField} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3 items-end"><div className="rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium">{row.mappingField}</div><label className="text-xs text-slate-500">Sage account number<input disabled={!editing} value={row.accNo} onChange={(e) => updateRow(index, "accNo", e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-slate-900" /></label><label className="text-xs text-slate-500">Sage account name<input disabled={!editing} value={row.accName} onChange={(e) => updateRow(index, "accName", e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm text-slate-900" /></label></div>)}</div></section>{editing && <div className="flex justify-end"><button type="button" onClick={saveMapping} disabled={saving} className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button></div>}{!editing && mapping && <div className="flex justify-end"><button type="button" onClick={() => setEditing(true)} className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white">Edit</button></div>}</div></DialogContent></Dialog>
  </div>;
}
