import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Toaster } from "sonner";
import { DatePicker } from "@/components/custom/datePicker";
import { LotteryComparisonTable } from "@/components/custom/LotteryComparisionTable";
import { SitePicker } from "@/components/custom/sitePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

const SITE_CONFIG = {
  waversCheques: ["Wavers West", "Wavers East"],
  excludeLottery: ["Wavers West", "Wavers East"],
  excludeAR: ["Oliver", "Osoyoos"],
  excludeAP: ["Oliver", "Osoyoos", "Wavers East", "Wavers West"],
};

type Search = { site: string; date: string };

type Row = {
  _id: string;
  shift_number: string;
  canadian_cash_collected?: number;
  item_sales?: number;
  cash_back?: number;
  loyalty?: number;
  cpl_bulloch?: number;
  exempted_tax?: number;
  report_canadian_cash?: number;
  payouts?: number;
  isChickenDelight?: boolean;
  chickenDelightTips?: number;
};

type Readiness = {
  canViewReport: boolean;
  shiftIssues: {
    hasShifts: boolean;
    missingCashShiftNumbers: string[];
    unreviewedShiftNumbers: string[];
  };
  lotteryIssue: {
    sellsLottery: boolean;
    hasLottery: boolean;
  };
};

type ReportData = {
  site: string;
  date: string;
  rows: Row[];
  totals: {
    count: number;
    canadian_cash_collected: number;
    item_sales: number;
    cash_back: number;
    loyalty: number;
    cpl_bulloch: number;
    exempted_tax: number;
    report_canadian_cash: number;
    payouts: number;
    voidedTransactionsAmount?: number;
    chequesCashedOut?: number;
  };
  chickenDelightTip?: number;
  report?: {
    notes?: string;
    submitted?: boolean;
    unsettledPrepays?: number;
    handheldDebit?: number;
  };
  readiness?: Readiness;
};

export type ArCustomerRow = {
  customerName: string;
  arIncurredTotal: number;
  transactionsTotal: number;
  match: boolean;
};

export type ArRegisterRow = {
  register: string;
  arIncurredTotal: number;
  transactionsTotal: number;
  match: boolean;
  customers?: ArCustomerRow[];
};

export type ArCheckData = {
  arIncurredTotal: number;
  transactionsTotal: number;
  match: boolean;
  byRegister?: ArRegisterRow[];
};

export const Route = createFileRoute("/_navbarLayout/cash-summary/report")({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): Search => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

    return {
      site: (search.site as string) || "",
      date: (search.date as string) || today,
    };
  },
  loaderDeps: ({ search: { site, date } }: { search: Search }) => ({
    site,
    date,
  }),
  loader: async ({ deps: { site, date } }: { deps: Search }) => {
    if (!site || !date) {
      return {
        report: null as ReportData | null,
        error: null as string | null,
        accessDenied: false,
        isManitoba: false,
      };
    }

    const token = localStorage.getItem("token") || "";
    let isManitoba = false;

    try {
      const locResp = await fetch(
        `/api/locations?stationName=${encodeURIComponent(site)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (locResp.ok) {
        const loc = await locResp.json();
        isManitoba = loc?.province?.trim().toLowerCase() === "manitoba";
      }
    } catch (locErr) {
      console.error("Failed to resolve site location profile info", locErr);
    }

    try {
      const res = await fetch(
        `/api/cash-summary/report?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Required-Permission": "accounting.cashSummary.report",
          },
        },
      );

      if (res.status === 403) {
        return { report: null, error: null, accessDenied: true, isManitoba };
      }

      if (!res.ok) {
        const msg = await res.text().catch(() => "Failed to load");
        return {
          report: null,
          error: msg || "Failed to load",
          accessDenied: false,
          isManitoba,
        };
      }

      return {
        report: (await res.json()) as ReportData,
        error: null,
        accessDenied: false,
        isManitoba,
      };
    } catch {
      return {
        report: null,
        error: "Network error",
        accessDenied: false,
        isManitoba,
      };
    }
  },
});

export function Card({
  title,
  value,
  dialogContent,
}: {
  title: ReactNode;
  value: ReactNode;
  dialogContent?: ReactNode;
}) {
  return <StatCard title={title} value={value} dialogContent={dialogContent} />;
}

function RouteComponent() {
  const { user } = useAuth();
  const { selectedSite } = useSite();
  const access = user?.access || {};
  const { site, date } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { report, error, accessDenied, isManitoba } = Route.useLoaderData() as {
    report: ReportData | null;
    error: string | null;
    accessDenied: boolean;
    isManitoba: boolean;
  };

  const [arData, setArData] = useState<ArCheckData | null>(null);
  const [arCheckMatch, setArCheckMatch] = useState<boolean | null>(null);
  const [payoutsCheckMatch, setPayoutsCheckMatch] = useState<boolean | null>(
    null,
  );
  const [voidedDetails, setVoidedDetails] = useState<any[]>([]);
  const [loadingVoided, setLoadingVoided] = useState(false);
  const [lottery, setLottery] = useState<any | null>(null);
  const [bullock, setBullock] = useState<any | null>(null);
  const [noteText, setNoteText] = useState("");
  const [unsettledPrepaysValue, setUnsettledPrepaysValue] = useState("");
  const [handheldDebitValue, setHandheldDebitValue] = useState("");
  // Add these numeric state variables inside RouteComponent:
  const [appliedPrepays, setAppliedPrepays] = useState<number>(0);
  const [appliedHandheld, setAppliedHandheld] = useState<number>(0);

  const rows = report?.rows ?? [];
  const totals = report?.totals;
  const regularRows = rows.filter((r) => !r.isChickenDelight);
  const cdRows = rows.filter((r) => r.isChickenDelight);
  const chickenDelightTip = report?.chickenDelightTip ?? 0;
  const notes = report?.report?.notes ?? "";
  const submitted = report?.report?.submitted === true;
  const unsettledPrepays = report?.report?.unsettledPrepays;
  const handheldDebit = report?.report?.handheldDebit;

  const skeletonCards = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-md border bg-muted/30 p-4"
        />
      )),
    [],
  );

  useEffect(() => {
    if (accessDenied) navigate({ to: "/no-access" });
  }, [accessDenied, navigate]);

  useEffect(() => {
    if (!site && selectedSite) {
      navigate({ search: (prev: Search) => ({ ...prev, site: selectedSite }) });
    }
  }, [navigate, selectedSite, site]);

  useEffect(() => setNoteText(notes), [notes]);
  useEffect(() => {
    setUnsettledPrepaysValue(
      typeof unsettledPrepays === "number" ? String(unsettledPrepays) : "",
    );
  }, [unsettledPrepays]);
  useEffect(() => {
    setHandheldDebitValue(
      typeof handheldDebit === "number" ? String(handheldDebit) : "",
    );
  }, [handheldDebit]);

  // Keep them synced when loader data loads/changes:
  useEffect(() => {
    setAppliedPrepays(
      typeof unsettledPrepays === "number" ? unsettledPrepays : 0,
    );
  }, [unsettledPrepays]);

  useEffect(() => {
    setAppliedHandheld(typeof handheldDebit === "number" ? handheldDebit : 0);
  }, [handheldDebit]);
  const [savingReportField, setSavingReportField] = useState<
    "notes" | "unsettledPrepays" | "handheldDebit" | null
  >(null);
  useEffect(() => setVoidedDetails([]), [site, date]);

  useEffect(() => {
    const check = async () => {
      setPayoutsCheckMatch(null);
      if (!site || !date || SITE_CONFIG.excludeAP.includes(site)) return;

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `/api/cash-summary/payouts-check?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
          {
            headers: {
              Authorization: `Bearer ${token || ""}`,
              "X-Required-Permission": "accounting.cashSummary.report",
            },
          },
        );
        if (res.status === 403) return navigate({ to: "/no-access" });
        if (res.ok) setPayoutsCheckMatch((await res.json()).match);
      } catch {
        setPayoutsCheckMatch(null);
      }
    };

    check();
  }, [date, navigate, site]);

  useEffect(() => {
    const check = async () => {
      setArCheckMatch(null);
      setArData(null);
      if (!site || !date || SITE_CONFIG.excludeAR.includes(site)) return;

      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `/api/cash-summary/ar-check?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
          {
            headers: {
              Authorization: `Bearer ${token || ""}`,
              "X-Required-Permission": "accounting.cashSummary.report",
            },
          },
        );
        if (res.status === 403) return navigate({ to: "/no-access" });
        if (res.ok) {
          const data = (await res.json()) as ArCheckData;
          setArCheckMatch(data.match);
          setArData(data);
        }
      } catch {
        setArCheckMatch(null);
        setArData(null);
      }
    };

    check();
  }, [date, navigate, site]);

  useEffect(() => {
    const fetchLottery = async () => {
      if (!site || !date) {
        setLottery(null);
        setBullock(null);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const resp = await fetch(
          `/api/cash-summary/lottery?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
          {
            headers: token
              ? {
                  Authorization: `Bearer ${token}`,
                  "X-Required-Permission": "accounting.cashSummary.report",
                }
              : {},
          },
        );
        if (resp.status === 403) return navigate({ to: "/no-access" });
        if (!resp.ok) {
          setLottery(null);
          setBullock(null);
          return;
        }
        const data = await resp.json();
        setLottery(data?.lottery ?? null);
        setBullock(data?.totals ?? null);
      } catch {
        setLottery(null);
        setBullock(null);
      }
    };

    fetchLottery();
  }, [date, navigate, site]);

  const saveReportField = async (
    endpoint: string,
    body: Record<string, unknown>,
    field: "notes" | "unsettledPrepays" | "handheldDebit",
  ): Promise<boolean> => {
    try {
      setSavingReportField(field);
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          "X-Required-Permission": "accounting.cashSummary.report",
        },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return false;
      }

      return res.ok;
    } catch {
      return false;
    } finally {
      setSavingReportField(null);
    }
  };

  const saveNotes = () => {
    if (!site || !date || submitted || !noteText.trim()) return;
    saveReportField(
      "/api/cash-summary/report/notes",
      { site, date, notes: noteText },
      "notes",
    );
  };

  const saveField = async (
    key: "unsettledPrepays" | "handheldDebit",
    value: string,
  ) => {
    if (!site || !date || submitted) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;

    const success = await saveReportField(
      key === "unsettledPrepays"
        ? "/api/cash-summary/report/unsettled-prepays"
        : "/api/cash-summary/report/handheld-debit",
      { site, date, [key]: num },
      key,
    );

    if (success) {
      if (key === "unsettledPrepays") {
        setAppliedPrepays(num);
      } else {
        setAppliedHandheld(num);
      }
    }
  };

  const fetchVoidedDetails = async () => {
    if (voidedDetails.length > 0 || loadingVoided || !site || !date) return;

    setLoadingVoided(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(
        `/api/cash-summary/voided-transactions-details?site=${encodeURIComponent(site)}&date=${encodeURIComponent(date)}`,
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                "X-Required-Permission": "accounting.cashSummary.report",
              }
            : {},
        },
      );
      if (resp.status === 403) return navigate({ to: "/no-access" });
      if (resp.ok) setVoidedDetails(await resp.json());
    } finally {
      setLoadingVoided(false);
    }
  };

  const updateSite = (newSite: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, site: newSite }) });
  const updateDate = (newDate: string) =>
    navigate({ search: (prev: Search) => ({ ...prev, date: newDate }) });

  const pickerDate = useMemo(() => {
    if (!date) return undefined;
    const [yy, mm, dd] = date.split("-").map(Number);
    return new Date(yy, mm - 1, dd);
  }, [date]);

  const handleDateChange: Dispatch<SetStateAction<Date | undefined>> = (
    value,
  ) => {
    const d = typeof value === "function" ? value(pickerDate) : value;
    if (!d) return;
    updateDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`,
    );
  };

  const safeBullock = bullock ?? {
    onlineSales: 0,
    scratchSales: 0,
    payouts: 0,
  };
  const safeLottery = lottery ?? {
    onlineLottoTotal: 0,
    onlineCancellations: 0,
    onlineDiscounts: 0,
    instantLottTotal: 0,
    scratchFreeTickets: 0,
    oldScratchTickets: 0,
    lottoPayout: 0,
  };
  const isWaversChequeSite = SITE_CONFIG.waversCheques.includes(site);
  const chequesValue = totals?.chequesCashedOut ?? 0;
  const overShort =
    (totals?.canadian_cash_collected ?? 0) +
    (isWaversChequeSite ? chequesValue : 0) -
    (totals?.report_canadian_cash ?? 0) +
    appliedHandheld +
    appliedPrepays;
  const onlineOverShort =
    (safeBullock.onlineSales || 0) -
    ((safeLottery.onlineLottoTotal ?? 0) -
      (safeLottery.onlineCancellations || 0) -
      (safeLottery.onlineDiscounts || 0));
  const scratchOverShort = isManitoba
    ? 0
    : (safeBullock.scratchSales || 0) -
      ((safeLottery.instantLottTotal ?? 0) +
        (safeLottery.scratchFreeTickets ?? 0) +
        (safeLottery.oldScratchTickets ?? 0));
  const payoutOverShort =
    (safeBullock.payouts || 0) - (safeLottery.lottoPayout ?? 0);
  const adjustedReportedCash =
    (totals?.report_canadian_cash ?? 0) + onlineOverShort + scratchOverShort;
  const adjustedItemSales =
    (totals?.item_sales ?? 0) + onlineOverShort + scratchOverShort;
  const adjustedPayouts = (totals?.payouts ?? 0) + payoutOverShort;
  const adjustedOverShort =
    (totals?.canadian_cash_collected ?? 0) +
    (isWaversChequeSite ? chequesValue : 0) -
    adjustedReportedCash +
    appliedHandheld +
    appliedPrepays;

  const effectiveOverShort =
    lottery && site !== "Wavers West" ? adjustedOverShort : overShort;
  const notesRequired = Math.abs(effectiveOverShort) > 25;
  const notesProvided = noteText.trim().length > 0;
  const readiness = report?.readiness;
  const shiftBlocked = Boolean(
    readiness &&
    !readiness.canViewReport &&
    (!readiness.shiftIssues.hasShifts ||
      readiness.shiftIssues.missingCashShiftNumbers.length > 0 ||
      readiness.shiftIssues.unreviewedShiftNumbers.length > 0),
  );
  const lotteryBlocked = Boolean(
    readiness &&
    !readiness.canViewReport &&
    !shiftBlocked &&
    readiness.lotteryIssue.sellsLottery &&
    !readiness.lotteryIssue.hasLottery,
  );
  const mismatchMessages = [
    arCheckMatch === false
      ? "A/R is not matching between Bulloch and the Hub."
      : null,
    payoutsCheckMatch === false
      ? "A/P is not matching between Bulloch payouts and Hub payables."
      : null,
  ].filter(Boolean);
  const canViewShiftReport = Boolean(
    access?.accounting?.cashSummary?.report?.viewShiftReport,
  );
  const showLotterySection = Boolean(
    lottery && !SITE_CONFIG.excludeLottery.includes(site),
  );
  const showARSection = Boolean(
    arData && !SITE_CONFIG.excludeAR.includes(site),
  );
  const osColor =
    overShort > 0
      ? "text-green-600"
      : overShort < 0
        ? "text-red-600"
        : "text-muted-foreground";
  const adjustedOsColor =
    adjustedOverShort > 0
      ? "text-green-600"
      : adjustedOverShort < 0
        ? "text-red-600"
        : "text-muted-foreground";

  if (accessDenied) return null;

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-slate-50/50 py-4">
      <Toaster />
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: relative; inset: 0; width: 100%; }
        }
      `}</style>

      <div className="w-full max-w-7xl space-y-6 px-4">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex w-full flex-wrap items-center gap-4 md:w-auto">
            <div className="w-full sm:w-[220px]">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Site
              </label>
              <SitePicker
                value={site}
                onValueChange={updateSite}
                placeholder="Pick a site"
                label="Site"
                className="w-full"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Date
              </label>
              <DatePicker date={pickerDate} setDate={handleDateChange} />
            </div>
            {mismatchMessages.length > 0 && (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:w-auto">
                {mismatchMessages.join(" ")}
              </div>
            )}
          </div>
        </div>

        {(shiftBlocked || lotteryBlocked) && (
          <PrerequisiteOverlay
            date={date}
            site={site}
            readiness={readiness}
            type={shiftBlocked ? "shift" : "lottery"}
            onContinue={() =>
              navigate({
                to: shiftBlocked
                  ? "/cash-summary/form"
                  : "/cash-summary/lottery",
                search: { site, date },
              })
            }
          />
        )}

        {!shiftBlocked && !lotteryBlocked && (
          <div
            id="print-area"
            className="overflow-hidden rounded-xl border bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b bg-slate-900 px-6 py-4 text-white">
              <div>
                <h2 className="text-base font-bold tracking-wide">
                  Cash Summary Report
                </h2>
                <p className="mt-0.5 text-xs text-slate-300">
                  Site:{" "}
                  <span className="font-semibold text-white">
                    {site || "-"}
                  </span>{" "}
                  | Date:{" "}
                  <span className="font-semibold text-white">
                    {date || "-"}
                  </span>
                </p>
              </div>
              {error && (
                <span className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200">
                  Error: {error}
                </span>
              )}
            </div>

            {!site || !date ? (
              <EmptyState>
                Please select a site and date to view the summary report.
              </EmptyState>
            ) : !report && !error ? (
              <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                {skeletonCards}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState>
                No cash summaries found for the selected date.
              </EmptyState>
            ) : (
              <div className="space-y-8 p-6">
                <TotalsSection
                  fetchVoidedDetails={fetchVoidedDetails}
                  fmtNum={fmtNum}
                  loadingVoided={loadingVoided}
                  osColor={osColor}
                  overShort={overShort}
                  showCheques={isWaversChequeSite}
                  totals={totals}
                  voidedDetails={voidedDetails}
                />

                {showLotterySection && (
                  <AdjustedTotalsSection
                    adjustedItemSales={adjustedItemSales}
                    adjustedOsColor={adjustedOsColor}
                    adjustedOverShort={adjustedOverShort}
                    adjustedPayouts={adjustedPayouts}
                    adjustedReportedCash={adjustedReportedCash}
                    fmtNum={fmtNum}
                    isManitoba={isManitoba}
                    totals={totals}
                  />
                )}

                <AdjustmentsSection
                  handheldDebitValue={handheldDebitValue}
                  onHandheldDebitChange={setHandheldDebitValue}
                  onSaveHandheldDebit={() =>
                    saveField("handheldDebit", handheldDebitValue)
                  }
                  onSaveUnsettledPrepays={() =>
                    saveField("unsettledPrepays", unsettledPrepaysValue)
                  }
                  onUnsettledPrepaysChange={setUnsettledPrepaysValue}
                  savingReportField={savingReportField}
                  submitted={submitted}
                  unsettledPrepaysValue={unsettledPrepaysValue}
                />

                {lottery && (
                  <section className="space-y-3">
                    <SectionTitle>Lottery Reconciliation</SectionTitle>
                    <LotteryComparisonTable
                      lotteryData={lottery}
                      bullockData={bullock}
                      isReadOnly
                      showImages={false}
                      isManitoba={isManitoba}
                    />
                  </section>
                )}

                {showARSection && (
                  <ArReconciliation
                    arData={arData}
                    date={date}
                    fmtNum={fmtNum}
                  />
                )}

                <ShiftCards
                  canViewShiftReport={canViewShiftReport}
                  fmtNum={fmtNum}
                  rows={regularRows}
                  site={site}
                />

                {cdRows.length > 0 && (
                  <ChickenDelightCards
                    canViewShiftReport={canViewShiftReport}
                    fmtNum={fmtNum}
                    rows={cdRows}
                    site={site}
                    totalTips={chickenDelightTip}
                  />
                )}

                <NotesSection
                  noteText={noteText}
                  notesProvided={notesProvided}
                  notesRequired={notesRequired}
                  onChange={setNoteText}
                  onSave={saveNotes}
                  savingReportField={savingReportField}
                  submitted={submitted}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PrerequisiteOverlay({
  date,
  site,
  readiness,
  type,
  onContinue,
}: {
  date: string;
  site: string;
  readiness?: Readiness;
  type: "shift" | "lottery";
  onContinue: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-bold text-slate-900">
              {type === "shift"
                ? "Shift data needs review"
                : "Lottery data is missing"}
            </h2>
          </div>
          {type === "shift" ? (
            <div className="space-y-1 text-sm text-slate-600">
              {!readiness?.shiftIssues.hasShifts && (
                <p>
                  No shifts were found for {site} on {date}.
                </p>
              )}
              {(readiness?.shiftIssues.unreviewedShiftNumbers.length ?? 0) >
                0 && (
                <p>
                  Shifts left to review:{" "}
                  {readiness?.shiftIssues.unreviewedShiftNumbers.join(", ")}
                </p>
              )}
              {/* {(readiness?.shiftIssues.missingCashShiftNumbers.length ?? 0) > 0 && (
                <p>Missing Canadian cash collected: {readiness?.shiftIssues.missingCashShiftNumbers.join(', ')}</p>
              )} */}
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              This store sells lottery, but no saved lottery entry exists for{" "}
              {site} on {date}.
            </p>
          )}
        </div>
        <Button type="button" onClick={onContinue} className="w-full sm:w-auto">
          Go to {type === "shift" ? "Form" : "Lottery"}
        </Button>
      </div>
    </div>
  );
}

function TotalsSection({
  totals,
  overShort,
  osColor,
  showCheques,
  fetchVoidedDetails,
  fmtNum,
  loadingVoided,
  voidedDetails,
}: {
  totals: ReportData["totals"] | undefined;
  overShort: number;
  osColor: string;
  showCheques: boolean;
  fetchVoidedDetails: () => void;
  fmtNum: (n?: number) => string;
  loadingVoided: boolean;
  voidedDetails: any[];
}) {
  return (
    <section>
      <SectionTitle>Standard Totals</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Canadian Cash Counted"
          value={fmtNum(totals?.canadian_cash_collected)}
        />
        <StatCard
          title="Total Canadian Cash Reported"
          value={fmtNum(totals?.report_canadian_cash)}
        />
        <StatCard
          title="Over / Short"
          value={
            <span className={`font-bold ${osColor}`}>{fmtNum(overShort)}</span>
          }
        />
        <StatCard title="Item Sales" value={fmtNum(totals?.item_sales)} />
        <StatCard title="Cash Back" value={fmtNum(totals?.cash_back)} />
        <StatCard title="Loyalty" value={fmtNum(totals?.loyalty)} />
        <StatCard title="Exempted Tax" value={fmtNum(totals?.exempted_tax)} />
        <StatCard title="Payouts" value={fmtNum(totals?.payouts)} />
        {showCheques && (
          <StatCard
            title="Cheques Cashed Out"
            value={
              <span className="font-bold text-amber-700">
                {fmtNum(totals?.chequesCashedOut)}
              </span>
            }
          />
        )}
        <StatCard
          title="Voided Transactions"
          value={
            <div className="flex items-center justify-between">
              <span
                className={`font-bold ${(totals?.voidedTransactionsAmount ?? 0) !== 0 ? "text-red-600" : "text-slate-800"}`}
              >
                {fmtNum(totals?.voidedTransactionsAmount)}
              </span>
              {(totals?.voidedTransactionsAmount ?? 0) > 0 && (
                <Dialog onOpenChange={(open) => open && fetchVoidedDetails()}>
                  <DialogTrigger asChild>
                    <button className="inline-flex items-center rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600">
                      <Info className="h-4 w-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col">
                    <DialogHeader>
                      <DialogTitle>Voided Transactions Summary</DialogTitle>
                    </DialogHeader>
                    <VoidedTransactionsTable
                      loading={loadingVoided}
                      rows={voidedDetails}
                      fmtNum={fmtNum}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        />
      </div>
    </section>
  );
}

function AdjustedTotalsSection({
  adjustedItemSales,
  adjustedOsColor,
  adjustedOverShort,
  adjustedPayouts,
  adjustedReportedCash,
  isManitoba,
  totals,
  fmtNum,
}: {
  adjustedItemSales: number;
  adjustedOsColor: string;
  adjustedOverShort: number;
  adjustedPayouts: number;
  adjustedReportedCash: number;
  isManitoba: boolean;
  totals: ReportData["totals"] | undefined;
  fmtNum: (n?: number) => string;
}) {
  const lotteryFormula = isManitoba
    ? "Bulloch reported cash + online lottery sales over/short"
    : "Bulloch reported cash + online and scratch lottery sales over/short";

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
      <SectionTitle>Adjusted Totals After Lottery</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Canadian Cash Counted"
          value={fmtNum(totals?.canadian_cash_collected)}
        />
        <StatCard
          title="Final Canadian Cash Reported"
          value={fmtNum(adjustedReportedCash)}
          dialogContent={<Formula>{lotteryFormula}</Formula>}
        />
        <StatCard
          title="Final Over / Short"
          value={
            <span className={`font-bold ${adjustedOsColor}`}>
              {fmtNum(adjustedOverShort)}
            </span>
          }
        />
        <StatCard
          title="Final Item Sales"
          value={fmtNum(adjustedItemSales)}
          dialogContent={
            <Formula>
              {lotteryFormula.replace("reported cash", "item sales")}
            </Formula>
          }
        />
        <StatCard
          title="Final Payouts"
          value={fmtNum(adjustedPayouts)}
          dialogContent={
            <Formula>Bulloch payouts + lottery payout over/short</Formula>
          }
        />
      </div>
    </section>
  );
}

function AdjustmentsSection({
  handheldDebitValue,
  savingReportField,
  submitted,
  unsettledPrepaysValue,
  onHandheldDebitChange,
  onSaveHandheldDebit,
  onSaveUnsettledPrepays,
  onUnsettledPrepaysChange,
}: {
  handheldDebitValue: string;
  savingReportField: "notes" | "unsettledPrepays" | "handheldDebit" | null;
  submitted: boolean;
  unsettledPrepaysValue: string;
  onHandheldDebitChange: (value: string) => void;
  onSaveHandheldDebit: () => void;
  onSaveUnsettledPrepays: () => void;
  onUnsettledPrepaysChange: (value: string) => void;
}) {
  return (
    <section>
      <SectionTitle>Adjustments</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EditableMoneyCard
          disabled={submitted}
          label="Unsettled Prepays"
          saving={savingReportField === "unsettledPrepays"}
          value={unsettledPrepaysValue}
          onChange={onUnsettledPrepaysChange}
          onSave={onSaveUnsettledPrepays}
        />
        <EditableMoneyCard
          disabled={submitted}
          label="Handheld Debit"
          saving={savingReportField === "handheldDebit"}
          value={handheldDebitValue}
          onChange={onHandheldDebitChange}
          onSave={onSaveHandheldDebit}
        />
      </div>
      {submitted && (
        <p className="mt-2 text-xs italic text-slate-400">
          Adjustments are locked because this report is submitted.
        </p>
      )}
    </section>
  );
}

// function ArReconciliation({
//   arData,
//   fmtNum,
// }: {
//   arData: ArCheckData | null;
//   fmtNum: (n?: number) => string;
// }) {
//   if (!arData) return null;

//   return (
//     <section
//       className={`space-y-4 rounded-xl border p-5 ${arData.match ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}
//     >
//       <div className="flex items-center justify-between">
//         <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
//           A/R Reconciliation{" "}
//           <span className="text-xs font-normal text-slate-500">
//             (Bulloch vs Hub)
//           </span>
//         </h3>
//         <span
//           className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${arData.match ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}
//         >
//           {arData.match ? (
//             <CheckCircle2 className="h-3.5 w-3.5" />
//           ) : (
//             <AlertTriangle className="h-3.5 w-3.5" />
//           )}
//           {arData.match ? "Matched" : "Mismatch Detected"}
//         </span>
//       </div>

//       <div className="grid gap-4 sm:grid-cols-2">
//         <SummaryBox
//           label="Bulloch Terminal A/R Total"
//           value={fmtNum(arData.arIncurredTotal)}
//         />
//         <SummaryBox
//           label="Hub Recorded A/R Total"
//           value={fmtNum(arData.transactionsTotal)}
//           tone={
//             arData.transactionsTotal === arData.arIncurredTotal
//               ? "good"
//               : arData.transactionsTotal > arData.arIncurredTotal
//                 ? "warn"
//                 : "bad"
//           }
//         />
//       </div>

//       {(arData.byRegister?.length ?? 0) > 0 && (
//         <div className="overflow-hidden rounded-lg border bg-white">
//           <table className="w-full text-sm">
//             <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
//               <tr>
//                 <th className="p-3 text-left">Register</th>
//                 <th className="p-3 text-right">Bulloch A/R</th>
//                 <th className="p-3 text-right">Hub A/R</th>
//                 <th className="p-3 text-right">Difference</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y">
//               {arData.byRegister?.map((row) => {
//                 const diff = row.transactionsTotal - row.arIncurredTotal;
//                 return (
//                   <tr
//                     key={row.register}
//                     className={row.match ? "bg-white" : "bg-amber-50/50"}
//                   >
//                     <td className="p-3 font-semibold text-slate-800">
//                       Register {row.register}
//                     </td>
//                     <td className="p-3 text-right font-medium text-slate-700">
//                       {fmtNum(row.arIncurredTotal)}
//                     </td>
//                     <td className="p-3 text-right font-medium text-slate-700">
//                       {fmtNum(row.transactionsTotal)}
//                     </td>
//                     <td
//                       className={`p-3 text-right font-bold ${diff === 0 ? "text-emerald-600" : "text-rose-600"}`}
//                     >
//                       {diff > 0 ? `+${fmtNum(diff)}` : fmtNum(diff)}
//                     </td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </section>
//   );
// }

export function ArReconciliation({
  arData,
  date,
  fmtNum,
}: {
  arData: ArCheckData | null;
  date: string;
  fmtNum: (n?: number) => string;
}) {
  const [expandedRegisters, setExpandedRegisters] = useState<
    Record<string, boolean>
  >({
    "1": true,
    "2": true,
    "3": true,
    "4": true,
  });

  if (!arData) return null;

  // Date Cutoff Check: September 1, 2026
  const isAfterCutoff = date >= "2026-09-01";

  const toggleRegister = (reg: string) => {
    setExpandedRegisters((prev) => ({ ...prev, [reg]: !prev[reg] }));
  };

  return (
    <section
      className={`space-y-4 rounded-xl border p-5 ${
        arData.match
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-rose-200 bg-rose-50/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          A/R Reconciliation{" "}
          <span className="text-xs font-normal text-slate-500">
            (Bulloch vs Hub)
          </span>
        </h3>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            arData.match
              ? "bg-emerald-100 text-emerald-800"
              : "bg-rose-100 text-rose-800"
          }`}
        >
          {arData.match ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          {arData.match ? "Matched" : "Mismatch Detected"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryBox
          label="Bulloch Terminal A/R Total"
          value={fmtNum(arData.arIncurredTotal)}
        />
        <SummaryBox
          label="Hub Recorded A/R Total"
          value={fmtNum(arData.transactionsTotal)}
          tone={
            arData.transactionsTotal === arData.arIncurredTotal
              ? "good"
              : arData.transactionsTotal > arData.arIncurredTotal
                ? "warn"
                : "bad"
          }
        />
      </div>

      {/* Show register and customer breakdown only on or after Sept 1, 2026 */}
      {isAfterCutoff && (arData.byRegister?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
              <tr>
                <th className="p-3 text-left">Register / Customer</th>
                <th className="p-3 text-right">Bulloch A/R</th>
                <th className="p-3 text-right">Hub A/R</th>
                <th className="p-3 text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {arData.byRegister?.map((regRow) => {
                const diff = regRow.transactionsTotal - regRow.arIncurredTotal;
                const isExpanded = expandedRegisters[regRow.register] ?? false;
                const hasCustomers = (regRow.customers?.length ?? 0) > 0;

                return (
                  <React.Fragment key={regRow.register}>
                    {/* Register Row */}
                    <tr
                      onClick={() => toggleRegister(regRow.register)}
                      className={`cursor-pointer transition-colors ${
                        regRow.match
                          ? "bg-slate-50/80 hover:bg-slate-100/80"
                          : "bg-amber-50/80 hover:bg-amber-100/80"
                      }`}
                    >
                      <td className="p-3 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {hasCustomers &&
                            (isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-slate-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-500" />
                            ))}
                          Register {regRow.register}
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">
                        {fmtNum(regRow.arIncurredTotal)}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">
                        {fmtNum(regRow.transactionsTotal)}
                      </td>
                      <td
                        className={`p-3 text-right font-extrabold ${
                          diff === 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {diff > 0 ? `+${fmtNum(diff)}` : fmtNum(diff)}
                      </td>
                    </tr>

                    {/* Nested Customer Rows */}
                    {isExpanded &&
                      regRow.customers?.map((custRow, idx) => {
                        const custDiff =
                          custRow.transactionsTotal - custRow.arIncurredTotal;
                        return (
                          <tr
                            key={`${regRow.register}-${custRow.customerName}-${idx}`}
                            className="bg-white hover:bg-slate-50/50"
                          >
                            <td className="py-2.5 pl-9 pr-3 text-xs font-medium text-slate-600">
                              {custRow.customerName}
                            </td>
                            <td className="p-2.5 text-right text-xs text-slate-600">
                              {fmtNum(custRow.arIncurredTotal)}
                            </td>
                            <td className="p-2.5 text-right text-xs text-slate-600">
                              {fmtNum(custRow.transactionsTotal)}
                            </td>
                            <td
                              className={`p-2.5 text-right text-xs font-semibold ${
                                custDiff === 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {custDiff > 0
                                ? `+${fmtNum(custDiff)}`
                                : fmtNum(custDiff)}
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ShiftCards({
  canViewShiftReport,
  rows,
  site,
  fmtNum,
}: {
  canViewShiftReport: boolean;
  rows: Row[];
  site: string;
  fmtNum: (n?: number) => string;
}) {
  return (
    <section>
      <SectionTitle>Shifts</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <ShiftCard
            key={r._id}
            canViewShiftReport={canViewShiftReport}
            fmtNum={fmtNum}
            row={r}
            site={site}
          />
        ))}
      </div>
    </section>
  );
}

function ChickenDelightCards({
  rows,
  totalTips,
  site,
  fmtNum,
  canViewShiftReport,
}: {
  rows: Row[];
  totalTips: number;
  site: string;
  fmtNum: (n?: number) => string;
  canViewShiftReport: boolean;
}) {
  return (
    <section>
      <SectionTitle>Chicken Delight</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const cashCollected = r.canadian_cash_collected ?? 0;
          const tips = r.chickenDelightTips ?? 0;
          const variance = cashCollected + tips - (r.report_canadian_cash ?? 0);

          return (
            <ShiftCard
              key={r._id}
              canViewShiftReport={canViewShiftReport}
              extraRows={[
                ["Cash Collected", fmtNum(cashCollected)],
                [
                  "Tips",
                  <span className="font-bold text-emerald-600">
                    {fmtNum(tips)}
                  </span>,
                ],
                ["Bulloch Reported", fmtNum(r.report_canadian_cash)],
                [
                  "Shift Over/Short",
                  <span
                    className={`font-bold ${variance < 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {variance > 0 ? `+${fmtNum(variance)}` : fmtNum(variance)}
                  </span>,
                ],
              ]}
              fmtNum={fmtNum}
              row={r}
              site={site}
            />
          );
        })}
        {rows.length > 1 && (
          <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-4">
            <span className="mb-1 text-xs font-semibold text-slate-500">
              Total Tips
            </span>
            <span className="text-lg font-bold text-emerald-600">
              {fmtNum(totalTips)}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function NotesSection({
  noteText,
  notesProvided,
  notesRequired,
  savingReportField,
  submitted,
  onChange,
  onSave,
}: {
  noteText: string;
  notesProvided: boolean;
  notesRequired: boolean;
  savingReportField: "notes" | "unsettledPrepays" | "handheldDebit" | null;
  submitted: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center px-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">
        Notes
        {notesRequired && !submitted && (
          <span className="ml-2 text-xs font-normal lowercase text-amber-600">
            *required
          </span>
        )}
      </h3>
      <textarea
        className={`min-h-[120px] w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          notesRequired && !notesProvided && !submitted
            ? "border-amber-500 focus:ring-amber-500"
            : "border-slate-200"
        }`}
        value={noteText}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          notesRequired
            ? "Required - explain the over/short variance..."
            : "Add notes for this cash summary..."
        }
        disabled={submitted}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          submitted || savingReportField === "notes" || !noteText.trim()
        }
        onClick={onSave}
        className="mt-2"
      >
        {savingReportField === "notes" ? "Saving..." : "Save Notes"}
      </Button>
      {notesRequired && !notesProvided && !submitted && (
        <p className="mt-1.5 text-xs font-medium text-amber-600">
          Manager's notes are required when the over/short exceeds $25.
        </p>
      )}
      {submitted && (
        <p className="mt-1.5 text-xs italic text-slate-400">
          Notes are locked because this report is submitted.
        </p>
      )}
    </section>
  );
}

function ShiftCard({
  canViewShiftReport,
  extraRows,
  fmtNum,
  row,
  site,
}: {
  canViewShiftReport: boolean;
  extraRows?: [string, ReactNode][];
  fmtNum: (n?: number) => string;
  row: Row;
  site: string;
}) {
  const rows =
    extraRows ??
    ([
      ["Canadian Cash Counted", fmtNum(row.canadian_cash_collected)],
      ["Canadian Cash Reported", fmtNum(row.report_canadian_cash)],
      ["Payouts", fmtNum(row.payouts)],
    ] as [string, ReactNode][]);

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b pb-2">
        <span className="text-xs font-semibold text-slate-400">
          Shift Number
        </span>
        <div className="text-sm font-bold">
          <ShiftNumber
            shiftNumber={row.shift_number}
            url={shiftReportUrl(site, row.shift_number)}
            clickable={canViewShiftReport}
          />
        </div>
      </div>
      <div className="space-y-2 text-xs">
        {rows.map(([k, v]) => (
          <KV key={k} k={k} v={v} />
        ))}
      </div>
    </div>
  );
}

function VoidedTransactionsTable({
  loading,
  rows,
  fmtNum,
}: {
  loading: boolean;
  rows: any[];
  fmtNum: (n?: number) => string;
}) {
  if (loading)
    return (
      <div className="mt-4 py-20 text-center text-slate-500 animate-pulse">
        Loading summary...
      </div>
    );
  if (rows.length === 0)
    return (
      <div className="mt-4 py-20 text-center text-slate-500">
        No records found.
      </div>
    );

  return (
    <div className="mt-4 flex-1 overflow-y-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 border-b bg-slate-50">
          <tr>
            <th className="p-3 text-left font-semibold text-slate-700">
              Transaction ID
            </th>
            <th className="p-3 text-left font-semibold text-slate-700">Time</th>
            <th className="p-3 text-left font-semibold text-slate-700">
              Items
            </th>
            <th className="p-3 text-right font-semibold text-slate-700">
              Total Refunded
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((tx) => (
            <tr
              key={tx.transactionId}
              className="transition-colors hover:bg-slate-50/80"
            >
              <td className="p-3 font-mono text-xs">{tx.transactionId}</td>
              <td className="p-3 text-xs text-slate-500">
                {tx.eventStartTime?.toString().split("T")[1]?.substring(0, 5) ||
                  tx.eventStartTime}
              </td>
              <td className="p-3">
                {Array.isArray(tx.items) ? tx.items.length : 0} Items
              </td>
              <td className="p-3 text-right font-bold text-red-600">
                {fmtNum(tx.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditableMoneyCard({
  disabled,
  label,
  saving,
  value,
  onChange,
  onSave,
}: {
  disabled: boolean;
  label: string;
  saving: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-white p-4 shadow-sm">
      <label className="block text-xs font-semibold text-slate-500">
        {label}
      </label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || saving}
        onClick={onSave}
        className="w-full"
      >
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-rose-600"
          : "text-slate-800";

  return (
    <div className="space-y-1 rounded-lg border bg-white p-4 shadow-sm">
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <span className={`text-xl font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  dialogContent,
}: {
  title: ReactNode;
  value: ReactNode;
  dialogContent?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{title}</span>
        {dialogContent && (
          <Dialog>
            <DialogTrigger asChild>
              <button className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <Info className="h-3.5 w-3.5" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  Calculation Breakdown
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2">{dialogContent}</div>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="text-base font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 px-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">
      {children}
    </h3>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="whitespace-pre-line text-xs leading-relaxed text-slate-600">
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="p-12 text-center text-sm text-slate-500">{children}</div>
  );
}

function ShiftNumber({
  shiftNumber,
  url,
  clickable,
}: {
  shiftNumber: string;
  url: string;
  clickable: boolean;
}) {
  if (!clickable) return <span>{shiftNumber}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline transition-colors hover:text-blue-800"
    >
      {shiftNumber}
    </a>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-slate-600">
      <span>{k}</span>
      <span className="font-medium text-slate-900">{v}</span>
    </div>
  );
}

function fmtNum(n?: number) {
  return typeof n === "number"
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
}

function shiftReportUrl(site: string, shiftNumber: string) {
  return `https://app.gen7fuel.com/sftp?site=${encodeURIComponent(site)}&type=sft&shift=${encodeURIComponent(
    `"${shiftNumber}"`,
  )}`;
}
