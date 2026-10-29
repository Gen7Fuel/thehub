import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building,
  Calendar,
  Mail,
  Loader2,
  CheckCircle2,
  Send,
} from "lucide-react";
import { DatePicker } from "@/components/custom/datePicker";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useSite } from "@/context/SiteContext";
import { useAuth } from "@/context/AuthContext";
import { accountingReportsService } from "@/api/accounting-reports/accounting-reports.service";
import { isApiError } from "@/api/core/errors";

export const Route = createFileRoute(
  "/_navbarLayout/accounting-reports/ap-customer-report",
)({ component: RouteComponent });
const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function RouteComponent() {
  const { user } = useAuth();
  const { selectedSite } = useSite();
  const navigate = useNavigate();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const [site, setSite] = useState(selectedSite || user?.location || "");
  const [fromDate, setFromDate] = useState<Date | undefined>(yesterday);
  const [toDate, setToDate] = useState<Date | undefined>(today);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (selectedSite) setSite(selectedSite);
  }, [selectedSite]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!site || !fromDate || !toDate)
      return setError("Please select a station and both dates.");
    if (fromDate > toDate)
      return setError("From Date cannot be after To Date.");
    try {
      setLoading(true);
      setStatus("Requesting A/P Customer report...");
      const response = await accountingReportsService.requestApCustomer({
        stationName: site,
        startDate: ymd(fromDate),
        endDate: ymd(toDate),
      });
      setStatus(response.message || "Report will be emailed shortly.");
    } catch (err: any) {
      if (isApiError(err) && err.status === 403) return navigate({ to: "/no-access" });
      setError(
        (isApiError(err) ? err.message : err?.message) ||
          "Failed to generate A/P report.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          A/P Customer Reports
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          Generate and dispatch Accounts Payable reports aggregated by vendor
          directly to your email.
        </p>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <form onSubmit={submit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1">
                <Building className="w-3.5 h-3.5" /> Station Location
              </label>
              <LocationPicker
                setStationName={setSite}
                value="stationName"
                defaultValue={site}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> From Date
              </label>
              <DatePicker
                date={fromDate}
                setDate={(v) =>
                  setFromDate(typeof v === "function" ? v(fromDate) : v)
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> To Date
              </label>
              <DatePicker
                date={toDate}
                setDate={(v) =>
                  setToDate(typeof v === "function" ? v(toDate) : v)
                }
              />
            </div>
          </div>
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-50 text-red-600 border border-red-200">
              {error}
            </div>
          )}
          {status && !error && (
            <div className="p-3 text-sm rounded-lg bg-amber-50 text-amber-800 flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              {status}
            </div>
          )}
          <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
            <Mail className="h-4 w-4" /> Generated reports will be emailed
            directly to <strong>{user?.email || "your email address"}</strong>.
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 text-white font-medium text-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit & Email Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
