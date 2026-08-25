import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Building, Calendar, FileDown, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { DatePicker } from '@/components/custom/datePicker';
import { LocationPicker } from '@/components/custom/locationPicker';
import { useSite } from '@/context/SiteContext';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios'; // Or your app's custom api client instance

export const Route = createFileRoute(
  '/_navbarLayout/accounting-reports/end-of-day',
)({
  component: RouteComponent,
});

/**
 * Helper to download base64 string directly as a PDF file
 */
function downloadBase64Pdf(base64Data: string, fileName: string) {
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

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
  const { selectedSite, setSelectedSite } = useSite();

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

  // Toggle state for individual reports
  const [includeIndividualReports, setIncludeIndividualReports] = useState<boolean>(false);

  // UI state for loading & error feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync site state with global site context changes
  useEffect(() => {
    if (selectedSite) {
      setSite(selectedSite);
    }
  }, [selectedSite]);

  // Handle location picker changes and propagate to global SiteContext
  const handleSiteChange = (newSite: string) => {
    setSite(newSite);
    if (setSelectedSite) {
      setSelectedSite(newSite);
    }
  };

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

    try {
      setLoading(true);
      setStatusMessage('Generating End of Day reports on server...');

      const response = await axios.post('/api/eod-reports/cumulative', {
        stationName: site,
        startDate: startDateStr,
        endDate: endDateStr,
        includeIndividualReports,
      });

      const { cumulativeReport, individualReports } = response.data;

      setStatusMessage('Reports generated! Downloading files...');

      // 1. Download Cumulative Report
      if (cumulativeReport?.bufferBase64) {
        downloadBase64Pdf(cumulativeReport.bufferBase64, cumulativeReport.fileName);
      }

      // 2. Download Individual Reports if requested and available
      if (includeIndividualReports && Array.isArray(individualReports)) {
        individualReports.forEach((report: { bufferBase64: string; fileName: string }) => {
          if (report.bufferBase64) {
            downloadBase64Pdf(report.bufferBase64, report.fileName);
          }
        });
      }

      setStatusMessage('All reports downloaded successfully!');
    } catch (err: any) {
      console.error('Error generating reports:', err);
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
            Generate and download cumulative and daily operational EOD reports.
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
                setStationName={handleSiteChange}
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

          {/* Toggle Option for Individual Reports */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <label htmlFor="individual-toggle" className="text-sm font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer">
                  Include Individual Daily Reports
                </label>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  When enabled, individual daily PDF reports will be downloaded alongside the cumulative PDF report.
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
                  Generating Reports...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Generate & Download Reports
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}