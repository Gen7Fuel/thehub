import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Building, Calendar, Mail, Loader2, FileText, CheckCircle2, Send, UtensilsCrossed } from 'lucide-react';
import { DatePicker } from '@/components/custom/datePicker';
import { LocationPicker } from '@/components/custom/locationPicker';
import { useSite } from '@/context/SiteContext';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

export const Route = createFileRoute(
  '/_navbarLayout/accounting-reports/end-of-day',
)({
  component: RouteComponent,
});

/**
 * Helper to format Javascript Date into YYYY-MM-DD
 */
function formatDateToYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function RouteComponent() {
  const { user } = useAuth();
  const { selectedSite } = useSite();
  const navigate = useNavigate();

  // Permission check for individual report downloads
  const canDownloadIndividualReports = Boolean(
    user?.access?.accounting?.accountingReports?.endOfDayReport?.downloadIndividualReports
  );

  // Location state synced with Auth/Site Context
  const [site, setSite] = useState<string>(
    selectedSite || user?.location || ''
  );

  // DatePicker States (Default: From = Yesterday, To = Today)
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const [fromDate, setFromDate] = useState<Date | undefined>(yesterday);
  const [toDate, setToDate] = useState<Date | undefined>(today);

  // Toggle states
  const [includeIndividualReports, setIncludeIndividualReports] = useState<boolean>(false);
  const [includeChickenDelight, setIncludeChickenDelight] = useState<boolean>(false);

  // UI state for loading & error feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if current selected location is "Wavers West"
  const isWaversWest = site.trim().toLowerCase() === 'wavers west';

  // Sync site local state if global selected Site changes
  useEffect(() => {
    if (selectedSite) {
      setSite(selectedSite);
    }
  }, [selectedSite]);

  // Reset Chicken Delight toggle if station is changed away from Wavers West
  useEffect(() => {
    if (!isWaversWest) {
      setIncludeChickenDelight(false);
    }
  }, [isWaversWest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!site) {
      setErrorMessage('Please select a station location.');
      return;
    }
    if (!fromDate || !toDate) {
      setErrorMessage('Please select both From and To dates.');
      return;
    }
    if (fromDate > toDate) {
      setErrorMessage('From Date cannot be after To Date.');
      return;
    }

    const startDateStr = formatDateToYYYYMMDD(fromDate);
    const endDateStr = formatDateToYYYYMMDD(toDate);
    const shouldIncludeIndividual = canDownloadIndividualReports && includeIndividualReports;
    const shouldIncludeChickenDelight = isWaversWest && includeChickenDelight;

    try {
      setLoading(true);
      setStatusMessage('Requesting End of Day reports...');

      const token = localStorage.getItem('token');

      const response = await axios.post(
        '/api/accounting-reports/eod-reports/cumulative',
        {
          stationName: site,
          startDate: startDateStr,
          endDate: endDateStr,
          includeIndividualReports: shouldIncludeIndividual,
          includeChickenDelight: shouldIncludeChickenDelight,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Required-Permission': 'accounting.accountingReports.endOfDayReport',
          },
        }
      );

      // Display response feedback message
      const targetEmail = user?.email || 'your email address';
      setStatusMessage(
        response.data?.message || `Reports generated! The reports will be emailed directly to ${targetEmail} shortly.`
      );
    } catch (err: any) {
      console.error('Error generating reports:', err);

      if (err.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }

      setErrorMessage(
        err.response?.data?.error || err.message || 'Failed to generate reports.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            End of Day Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Generate and dispatch cumulative and daily operational EOD reports directly to your email.
          </p>
        </div>
      </div>

      {/* Main Form Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* Station Location Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1">
                <Building className="w-3.5 h-3.5" /> Station Location
              </label>
              <LocationPicker
                setStationName={setSite}
                value="stationName"
                defaultValue={site}
              />
            </div>

            {/* From Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> From Date
              </label>
              <DatePicker
                date={fromDate}
                setDate={(val) =>
                  typeof val === 'function'
                    ? setFromDate(val(fromDate))
                    : setFromDate(val)
                }
              />
            </div>

            {/* To Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> To Date
              </label>
              <DatePicker
                date={toDate}
                setDate={(val) =>
                  typeof val === 'function'
                    ? setToDate(val(toDate))
                    : setToDate(val)
                }
              />
            </div>
          </div>

          {/* Toggle Option for Chicken Delight Report (Only for Wavers West) */}
          {isWaversWest && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <label htmlFor="chicken-delight-toggle" className="text-sm font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer">
                    Include Chicken Delight Report
                  </label>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Generate and attach the specialized Chicken Delight EOD report alongside standard EOD reports.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="chicken-delight-toggle"
                  type="checkbox"
                  checked={includeChickenDelight}
                  onChange={(e) => setIncludeChickenDelight(e.target.checked)}
                  disabled={loading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-zinc-600 peer-checked:bg-amber-600"></div>
              </label>
            </div>
          )}

          {/* Toggle Option for Individual Reports (Permission Restricted) */}
          {canDownloadIndividualReports && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <label htmlFor="individual-toggle" className="text-sm font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer">
                    Include Individual Daily Reports
                  </label>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    When enabled, individual daily PDF reports will be zipped and attached alongside the cumulative report.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="individual-toggle"
                  type="checkbox"
                  checked={includeIndividualReports}
                  onChange={(e) => setIncludeIndividualReports(e.target.checked)}
                  disabled={loading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-zinc-600 peer-checked:bg-amber-600"></div>
              </label>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
              {errorMessage}
            </div>
          )}

          {/* Status Banner during loading / completed */}
          {statusMessage && !errorMessage && (
            <div className="p-3 text-sm rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Email Notification Banner */}
          <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-amber-900 dark:text-amber-200 text-sm">
            <Mail className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Generated reports will be emailed directly to{" "}
              <strong className="font-semibold underline decoration-amber-300">
                {user?.email || "your email address"}
              </strong>
              .
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating & Dispatching...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit & Email Reports
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}