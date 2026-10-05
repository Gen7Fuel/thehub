import { useMemo } from "react";
import { AlertCircle, Cylinder, Gauge, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface TankRecord {
  _id: string;
  stationId?: string | { _id?: string };
  stationName?: string;
  tankNo?: number;
  grade?: string;
  tankCapacity?: number;
  maxVolumeCapacity?: number;
  minVolumeCapacity?: number;
  currentVolume?: number;
  lastUpdatedVolumeReadingDateTime?: string;
}

interface GradeTheme {
  color: string;
  label: string;
  raw: string;
  light: string;
}

interface GradeSummary {
  grade: string;
  tanks: TankRecord[];
  freshTanks: TankRecord[];
  tankCapacity: number;
  liveVolume: number;
  minCapacity: number;
  maxCapacity: number;
  availableUllage: number;
  averageDailySales: number;
  daysToCover: number | null;
}

interface CoverageForecast {
  byGrade?: Record<string, { averageDailySales?: number }>;
  forecastDays?: Array<{ offset: number; grades: Record<string, number> }>;
}

interface CurrentInventoryByGradeChartProps {
  tanks: TankRecord[];
  selectedStationIds: string[];
  selectedGrades: string[];
  coverageForecast?: CoverageForecast;
  getGradeTheme: (grade: string) => GradeTheme;
  isLoading?: boolean;
}

const GRADE_ORDER = ["Regular", "E15", "Premium", "Diesel", "Dyed Diesel"];

const formatLitres = (value: number) => `${Math.round(value).toLocaleString()} L`;

const formatDaysCover = (value: number | null) => {
  if (value === null) return "--";
  if (value >= 30) return "30+ days";
  if (value < 1) return "<1 day";
  return `${value.toFixed(1)} days`;
};

const getStationId = (tank: TankRecord) => {
  if (!tank.stationId) return "";
  return typeof tank.stationId === "string" ? tank.stationId : tank.stationId._id || "";
};

const isFreshTank = (tank: TankRecord) => {
  const reading = tank.lastUpdatedVolumeReadingDateTime;
  return Boolean(reading && reading !== "No latest reading available");
};

const gradeMatchesFilter = (tankGrade: string, selectedGrades: string[]) => {
  if (selectedGrades.includes(tankGrade)) return true;
  return tankGrade === "Regular" && selectedGrades.includes("E15");
};

export function CurrentInventoryByGradeChart({
  tanks,
  selectedStationIds,
  selectedGrades,
  coverageForecast,
  getGradeTheme,
  isLoading = false,
}: CurrentInventoryByGradeChartProps) {
  const gradeSummaries = useMemo<GradeSummary[]>(() => {
    const selectedStations = new Set(selectedStationIds);
    const summaryMap = new Map<string, GradeSummary>();

    (tanks || []).forEach((tank) => {
      const grade = tank.grade || "Unknown";
      const stationId = getStationId(tank);

      if (!selectedStations.has(stationId)) return;
      if (!gradeMatchesFilter(grade, selectedGrades)) return;

      const current = summaryMap.get(grade) ?? {
        grade,
        tanks: [],
        freshTanks: [],
        tankCapacity: 0,
        liveVolume: 0,
        minCapacity: 0,
        maxCapacity: 0,
        availableUllage: 0,
        averageDailySales: 0,
        daysToCover: null,
      };

      current.tanks.push(tank);

      if (isFreshTank(tank)) {
        current.freshTanks.push(tank);
        current.liveVolume += Number(tank.currentVolume) || 0;
        current.tankCapacity += Number(tank.tankCapacity) || 0;
        current.minCapacity += Number(tank.minVolumeCapacity) || 0;
        current.maxCapacity += Number(tank.maxVolumeCapacity) || 0;
      }

      summaryMap.set(grade, current);
    });

    const summaries = Array.from(summaryMap.values()).map((summary) => {
      const availableUllage = Math.max(summary.tankCapacity - summary.liveVolume, 0);
      const forecastDays = coverageForecast?.forecastDays || [];
      const averageDailySales = Number(coverageForecast?.byGrade?.[summary.grade]?.averageDailySales) || 0;
      let remainingVolume = summary.liveVolume;
      let daysToCover: number | null = null;

      if (averageDailySales > 0) {
        daysToCover = 0;
        for (const forecastDay of forecastDays) {
          const daySales = Number(forecastDay.grades?.[summary.grade]) || 0;
          if (daySales <= 0) continue;
          if (remainingVolume > daySales) {
            remainingVolume -= daySales;
            daysToCover += 1;
          } else {
            daysToCover += remainingVolume / daySales;
            remainingVolume = 0;
            break;
          }
        }

        if (remainingVolume > 0) {
          daysToCover += remainingVolume / averageDailySales;
        }
      }

      return {
        ...summary,
        availableUllage,
        averageDailySales,
        daysToCover,
      };
    });

    return summaries.sort((a, b) => {
      const aIndex = GRADE_ORDER.indexOf(a.grade);
      const bIndex = GRADE_ORDER.indexOf(b.grade);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
  }, [coverageForecast, tanks, selectedGrades, selectedStationIds]);

  const totals = useMemo(
    () =>
      gradeSummaries.reduce(
        (acc, grade) => ({
          tankCapacity: acc.tankCapacity + grade.tankCapacity,
          liveVolume: acc.liveVolume + grade.liveVolume,
          minCapacity: acc.minCapacity + grade.minCapacity,
          maxCapacity: acc.maxCapacity + grade.maxCapacity,
          availableUllage: acc.availableUllage + grade.availableUllage,
          tankCount: acc.tankCount + grade.tanks.length,
          freshTankCount: acc.freshTankCount + grade.freshTanks.length,
        }),
        {
          tankCapacity: 0,
          liveVolume: 0,
          minCapacity: 0,
          maxCapacity: 0,
          availableUllage: 0,
          tankCount: 0,
          freshTankCount: 0,
        },
      ),
    [gradeSummaries],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[430px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex items-center gap-3 text-xs font-bold text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          Loading current inventory...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Cylinder className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
              Current Inventory by Grade
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Live tank readings grouped by selected stations and fuel grades
            </p>
          </div>
        </div>

        <div className="space-y-1 xl:min-w-[760px]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <InventoryMetric label="Live volume" value={formatLitres(totals.liveVolume)} />
            <InventoryMetric label="Tank capacity" value={formatLitres(totals.tankCapacity)} />
            <InventoryMetric label="Min capacity" value={formatLitres(totals.minCapacity)} />
            <InventoryMetric label="Max capacity" value={formatLitres(totals.maxCapacity)} />
            <InventoryMetric label="Available ullage" value={formatLitres(totals.availableUllage)} />
          </div>
          <p className="text-right text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Totals include active tanks with current/yesterday/manual readings only.
          </p>
        </div>
      </div>

      {gradeSummaries.length === 0 ? (
        <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 text-center">
          <div className="rounded-full bg-slate-100 p-4 text-slate-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <p className="text-sm font-black text-slate-700">No inventory to show</p>
          <p className="max-w-md text-xs font-medium text-slate-400">
            Adjust the selected sites or grade filters above.
          </p>
        </div>
      ) : (
        <div className="grid min-h-[430px] grid-cols-1 gap-6 pt-5 xl:grid-cols-[minmax(420px,0.95fr)_minmax(420px,1.05fr)]">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Tank view
                </p>
                <p className="text-sm font-black text-slate-800">
                  Company inventory snapshot
                </p>
              </div>
              <p className="text-right text-[10px] font-bold uppercase text-slate-400">
                {totals.freshTankCount} / {totals.tankCount} live tanks
              </p>
            </div>

            <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
              {gradeSummaries.map((summary) => (
                <CompactGradeTank
                  key={summary.grade}
                  summary={summary}
                  getGradeTheme={getGradeTheme}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_88px_88px_88px_88px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
              <span>Grade</span>
              <span className="text-right">Live</span>
              <span className="text-right">Capacity</span>
              <span className="text-right">Min</span>
              <span className="text-right">Max</span>
              <span className="text-right">Ullage</span>
              <span className="text-right">Cover</span>
            </div>
            <div className="max-h-[390px] overflow-y-auto p-3">
              <div className="grid gap-3">
                {gradeSummaries.map((summary) => (
                  <GradeDetailCard
                    key={summary.grade}
                    summary={summary}
                    getGradeTheme={getGradeTheme}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function CompactGradeTank({
  summary,
  getGradeTheme,
}: {
  summary: GradeSummary;
  getGradeTheme: (grade: string) => GradeTheme;
}) {
  const theme = getGradeTheme(summary.grade);
  const fillPercent = summary.tankCapacity > 0 ? (summary.liveVolume / summary.tankCapacity) * 100 : 0;
  const minPercent = summary.tankCapacity > 0 ? (summary.minCapacity / summary.tankCapacity) * 100 : 0;
  const maxPercent = summary.tankCapacity > 0 ? (summary.maxCapacity / summary.tankCapacity) * 100 : 0;
  const isLow = summary.freshTanks.length > 0 && summary.liveVolume <= summary.minCapacity;
  const isHigh = summary.freshTanks.length > 0 && summary.liveVolume >= summary.maxCapacity;

  return (
    <div
      className={cn(
        "flex min-h-[172px] flex-col rounded-xl border bg-white p-3 transition-all",
        isLow
          ? "border-red-300 shadow-sm shadow-red-100"
          : isHigh
            ? "border-amber-300 shadow-sm shadow-amber-100"
            : "border-slate-200",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn("truncate text-[11px] font-black uppercase tracking-[0.16em]", theme.label)}>
            {summary.grade}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            {summary.freshTanks.length} live / {summary.tanks.length} tanks
          </p>
        </div>
        <Gauge className={cn("h-4 w-4 shrink-0", theme.label)} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700"
          style={{ height: `${Math.min(fillPercent, 100)}%`, backgroundColor: theme.raw }}
        />
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-red-500"
          style={{ bottom: `${Math.min(minPercent, 100)}%` }}
        />
        <div
          className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500"
          style={{ bottom: `${Math.min(maxPercent, 100)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm">
            {Math.round(fillPercent)}% full
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Live volume</p>
          <p className="text-sm font-black text-slate-900">{formatLitres(summary.liveVolume)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Cover</p>
          <p className="text-sm font-black text-slate-900">{formatDaysCover(summary.daysToCover)}</p>
        </div>
        {(isLow || isHigh) && (
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide",
              isLow ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600",
            )}
          >
            {isLow ? "Low" : "High"}
          </span>
        )}
      </div>
    </div>
  );
}

function GradeDetailCard({
  summary,
  getGradeTheme,
}: {
  summary: GradeSummary;
  getGradeTheme: (grade: string) => GradeTheme;
}) {
  const theme = getGradeTheme(summary.grade);
  const fillPercent = summary.tankCapacity > 0 ? (summary.liveVolume / summary.tankCapacity) * 100 : 0;
  const minShare = summary.tankCapacity > 0 ? (summary.minCapacity / summary.tankCapacity) * 100 : 0;
  const maxShare = summary.tankCapacity > 0 ? (summary.maxCapacity / summary.tankCapacity) * 100 : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_88px_88px_88px_88px_88px_88px] items-start gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: theme.raw }} />
            <p className="truncate text-sm font-black text-slate-800">{summary.grade}</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {summary.freshTanks.length} live / {summary.tanks.length} total tanks
          </p>
        </div>

        <MetricColumn label="Live" value={formatLitres(summary.liveVolume)} />
        <MetricColumn label="Capacity" value={formatLitres(summary.tankCapacity)} />
        <MetricColumn label="Min" value={formatLitres(summary.minCapacity)} />
        <MetricColumn label="Max" value={formatLitres(summary.maxCapacity)} />
        <MetricColumn label="Ullage" value={formatLitres(summary.availableUllage)} />
        <MetricColumn label="Cover" value={formatDaysCover(summary.daysToCover)} />
      </div>

      <div className="mt-4 space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(fillPercent, 100)}%`, backgroundColor: theme.raw }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>{fillPercent.toFixed(1)}% full</span>
          <span>Min {minShare.toFixed(0)}% · Max {maxShare.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}

function MetricColumn({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs font-black text-slate-900">{value}</p>
      <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
    </div>
  );
}

export default CurrentInventoryByGradeChart;



