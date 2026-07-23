import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/custom/datePicker";
import { useSite } from "@/context/SiteContext";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Filter,
  Terminal,
  Bug,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_navbarLayout/upload-invoice/list")({
  component: RouteComponent,
});

export interface ExecutionLog {
  _id?: string;
  attemptNumber: number;
  timestamp: string;
  status: "uploaded_to_cso" | "failed_cso_upload" | "retry_phase";
  errorCategory: "USER_ERROR" | "SYSTEM_ERROR" | "RETRY_EVENT" | "NONE";
  message?: string | null;
  rawError?: string | null;
  errorScreenshotFilename?: string | null;
  executionStep?: string | null;
}

interface InvoiceItem {
  _id: string;
  site?: { _id?: string; stationName?: string; csoCode?: string };
  submittedByMongoId?: { name?: string; email?: string };
  invoiceDate: string;
  siteCsoCode: string;
  vendorCode: string;
  vendorName: string;
  docNumber: string;
  methodOfPayment:
    | "cash"
    | "credit"
    | "check"
    | "money_order"
    | "eft"
    | "credit_card";
  checkNumber?: string | null;
  totalCost: number;
  images: string[];
  status: "pending_api_upload" | "uploaded_to_cso" | "failed_cso_upload";
  csoUploadError?: string | null;
  logs?: ExecutionLog[];
  createdAt: string;
}

// Helper: Format Date objects safely into YYYY-MM-DD strings
const formatDateToString = (date?: Date): string => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function RouteComponent() {
  const { user } = useAuth();
  const { selectedSite } = useSite();

  // Permission check for viewing logs
  const canViewLogs = Boolean(user?.access?.uploadInvoice?.list?.viewErrorLogs);

  // Location Picker State synced with global Auth/Site context
  const [site, setSite] = useState<string>(
    selectedSite || user?.location || "",
  );

  // DatePicker States (Default: From = Yesterday, To = Today)
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const [fromDate, setFromDate] = useState<Date | undefined>(yesterday);
  const [toDate, setToDate] = useState<Date | undefined>(today);

  // List Data & Modal View States
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Dialog States
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(
    null,
  );
  const [selectedLogsInvoice, setSelectedLogsInvoice] =
    useState<InvoiceItem | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Expanded raw errors state for logs modal
  const [expandedRawErrors, setExpandedRawErrors] = useState<
    Record<number, boolean>
  >({});

  // Sync site local state if global selectedSite changes
  useEffect(() => {
    if (selectedSite) {
      setSite(selectedSite);
    }
  }, [selectedSite]);

  // Fetch Filtered Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (site) params.append("siteName", site);
      if (fromDate) params.append("fromDate", formatDateToString(fromDate));
      if (toDate) params.append("toDate", formatDateToString(toDate));

      const token = localStorage.getItem("token");

      const res = await fetch(`/api/invoice-upload/list?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json();
      if (json.success) {
        setInvoices(json.data);
      } else {
        console.error("Server returned operational failure:", json.error);
      }
    } catch (err) {
      console.error("Failed fetching filtered invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [site, fromDate, toDate]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const toggleRawError = (index: number) => {
    setExpandedRawErrors((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getStatusBadge = (
    status: InvoiceItem["status"],
    error?: string | null,
  ) => {
    switch (status) {
      case "uploaded_to_cso":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> Uploaded
          </span>
        );
      case "failed_cso_upload":
        return (
          <span
            title={error || "Upload failed"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
          >
            <XCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case "pending_api_upload":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> In Progress
          </span>
        );
    }
  };

  const getErrorCategoryBadge = (category: ExecutionLog["errorCategory"]) => {
    switch (category) {
      case "USER_ERROR":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            USER ERROR
          </span>
        );
      case "SYSTEM_ERROR":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            SYSTEM ERROR
          </span>
        );
      case "RETRY_EVENT":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            RETRY EVENT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" />
            Uploaded Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track and view background submission statuses to CStoreOffice.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchInvoices}
          className="inline-flex items-center gap-2 rounded-xl"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`}
          />
          Refresh List
        </Button>
      </div>

      {/* Filter Options Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm border-b border-slate-100 pb-3">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span>Filter Criteria</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Building className="w-3.5 h-3.5" /> Station Location
            </label>
            <LocationPicker
              setStationName={setSite}
              value="stationName"
              defaultValue={site}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> From Date
            </label>
            <DatePicker
              date={fromDate}
              setDate={(val) =>
                typeof val === "function"
                  ? setFromDate(val(fromDate))
                  : setFromDate(val)
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> To Date
            </label>
            <DatePicker
              date={toDate}
              setDate={(val) =>
                typeof val === "function"
                  ? setToDate(val(toDate))
                  : setToDate(val)
              }
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
            <p className="text-sm font-medium">Fetching invoice records...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="font-semibold text-slate-700">
              No matching invoices found
            </p>
            <p className="text-xs text-slate-400">
              Try adjusting your date range or station filter parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Doc #</th>
                  <th className="py-3.5 px-4">Vendor</th>
                  <th className="py-3.5 px-4">Total Cost</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr
                    key={inv._id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-4 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {inv.invoiceDate}
                    </td>
                    <td className="py-4 px-4 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {inv.docNumber}
                    </td>
                    <td className="py-4 px-4 text-slate-900 font-semibold">
                      <div className="truncate max-w-[180px] sm:max-w-xs">
                        {inv.vendorName}
                        <span className="block text-xs font-normal text-slate-400">
                          Code: {inv.vendorCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                      ${inv.totalCost.toFixed(2)}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap">
                      {getStatusBadge(inv.status, inv.csoUploadError)}
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Details Icon Button */}
                        <Button
                          size="icon"
                          variant="secondary"
                          title="View Details"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            if (inv.images && inv.images.length > 0) {
                              setActiveImage(inv.images[0]);
                            }
                          }}
                          className="w-8 h-8 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-none"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {/* Permission Controlled Execution Logs Button */}
                        {canViewLogs && (
                          <Button
                            size="icon"
                            variant="secondary"
                            title="View Execution & Error Logs"
                            onClick={() => {
                              setSelectedLogsInvoice(inv);
                              setExpandedRawErrors({});
                            }}
                            className="w-8 h-8 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 border-none relative"
                          >
                            <Terminal className="w-4 h-4" />
                            {inv.logs && inv.logs.length > 0 && (
                              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 text-[8px] text-white font-bold items-center justify-center">
                                  {inv.logs.length}
                                </span>
                              </span>
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Dialog */}
      <Dialog
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
      >
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="flex items-center gap-3 text-lg font-bold text-slate-900">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span>Invoice Details: #{selectedInvoice?.docNumber}</span>
                <p className="text-xs font-normal text-slate-400 mt-0.5">
                  Submitted:{" "}
                  {selectedInvoice &&
                    new Date(selectedInvoice.createdAt).toLocaleString()}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
              {selectedInvoice.status === "failed_cso_upload" &&
                selectedInvoice.csoUploadError && (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
                    <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">
                        Upload Issue Context
                      </h4>
                      <p className="text-xs text-rose-700 mt-0.5">
                        {selectedInvoice.csoUploadError}
                      </p>
                    </div>
                  </div>
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inside the View Details Dialog - Document Image Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Attached Document Images ({selectedInvoice.images.length})
                  </h3>
                  {activeImage ? (
                    <div className="space-y-2">
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 h-72 flex items-center justify-center relative">
                        <img
                          src={`/cdn/download/${activeImage}`}
                          alt="Invoice Document Copy"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
                        onClick={() =>
                          window.open(`/cdn/download/${activeImage}`, "_blank")
                        }
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                      </Button>
                    </div>
                  ) : (
                    <div className="h-72 border border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                      No Image Assets Found
                    </div>
                  )}

                  {selectedInvoice.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedInvoice.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImage(img)}
                          className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 bg-slate-100 ${
                            activeImage === img
                              ? "border-indigo-600"
                              : "border-slate-200 opacity-60"
                          }`}
                        >
                          <img
                            src={`/cdn/download/${img}`}
                            alt={`Thumbnail ${idx}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Invoice Metadata & Summary
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs font-medium">
                        Invoice Date
                      </span>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        {selectedInvoice.invoiceDate}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs font-medium">
                        Total Cost
                      </span>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        ${selectedInvoice.totalCost.toFixed(2)}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs font-medium">
                        Station Location
                      </span>
                      <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
                        {selectedInvoice.site?.stationName || "N/A"}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-xs font-medium">
                        Payment Mode
                      </span>
                      <p className="text-sm font-semibold text-slate-900 mt-1 uppercase">
                        {selectedInvoice.methodOfPayment.replace("_", " ")}
                      </p>
                      {selectedInvoice.checkNumber && (
                        <span className="text-[10px] text-indigo-600 font-mono block">
                          Check #: {selectedInvoice.checkNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Vendor Name:</span>
                      <span className="font-bold text-slate-800">
                        {selectedInvoice.vendorName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Vendor Code:</span>
                      <span className="font-mono text-slate-700">
                        {selectedInvoice.vendorCode}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Doc Number:</span>
                      <span className="font-mono text-slate-700">
                        {selectedInvoice.docNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100/70 border border-slate-200/60 text-xs">
                    <span className="text-slate-500 font-medium">
                      Current Status:
                    </span>
                    {getStatusBadge(
                      selectedInvoice.status,
                      selectedInvoice.csoUploadError,
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permission Controlled Admin Execution Logs Dialog */}
      <Dialog
        open={!!selectedLogsInvoice}
        onOpenChange={(open) => !open && setSelectedLogsInvoice(null)}
      >
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden rounded-2xl bg-white">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/80">
            <DialogTitle className="flex items-center gap-3 text-lg font-bold text-slate-900">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <span>Execution Audit & Error Logs</span>
                <p className="text-xs font-normal text-slate-500 mt-0.5">
                  Doc #:{" "}
                  <span className="font-mono text-amber-700 font-semibold">
                    {selectedLogsInvoice?.docNumber}
                  </span>{" "}
                  | Vendor: {selectedLogsInvoice?.vendorName}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6 bg-slate-50/50 text-slate-800">
            {!selectedLogsInvoice?.logs ||
            selectedLogsInvoice.logs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Bug className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">
                  No execution traces recorded
                </p>
                <p className="text-xs text-slate-400">
                  This task was either completed without logged retry events or
                  is awaiting dispatch.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedLogsInvoice.logs.map((log, index) => (
                  <div
                    key={log._id || index}
                    className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm"
                  >
                    {/* Log Attempt Top Bar */}
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-200 text-slate-800 font-bold">
                          Attempt #{log.attemptNumber}
                        </span>
                        {getErrorCategoryBadge(log.errorCategory)}
                        {log.executionStep && (
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            STEP: {log.executionStep}
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-5 space-y-4 text-xs">
                      {/* Formatted Message */}
                      {log.message && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Operational Context
                          </span>
                          <p className="text-slate-800 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {log.message}
                          </p>
                        </div>
                      )}

                      {/* Raw Error Stack Trace Toggle Section */}
                      {log.rawError && (
                        <div>
                          <button
                            onClick={() => toggleRawError(index)}
                            className="flex items-center justify-between w-full text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 transition-colors py-1"
                          >
                            <span className="flex items-center gap-1.5">
                              <Bug className="w-3.5 h-3.5" /> Technical Raw
                              Error / Stack Trace
                            </span>
                            {expandedRawErrors[index] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {expandedRawErrors[index] && (
                            <pre className="mt-2 p-3 bg-rose-50/50 rounded-lg border border-rose-200 text-rose-800 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                              {log.rawError}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Automation Error Screenshot */}
                      {log.errorScreenshotFilename && (
                        <div className="pt-2 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />{" "}
                            Automation Execution Snapshot
                          </span>
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 min-h-[350px] max-h-[500px] flex items-center justify-center p-2">
                            <img
                              src={`/cdn/download/${log.errorScreenshotFilename}`}
                              alt={`Error Attempt ${log.attemptNumber}`}
                              className="max-h-[480px] max-w-full object-contain rounded"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-700 bg-white border-slate-200 hover:bg-slate-50"
                            onClick={() =>
                              window.open(
                                `/cdn/download/${log.errorScreenshotFilename}`,
                                "_blank",
                              )
                            }
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Open
                            Screenshot in New Tab
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setSelectedLogsInvoice(null)}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
