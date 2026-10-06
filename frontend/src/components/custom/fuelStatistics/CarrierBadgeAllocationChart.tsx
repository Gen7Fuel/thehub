import { useEffect, useMemo, useState } from "react";
import { Check, CreditCard, Truck } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CarrierBadgeBasis = "delivered" | "ordered";

interface EntityReference {
  _id?: string;
  name?: string;
  carrierName?: string;
  supplierName?: string;
}

export interface CarrierBadgeOrder {
  _id?: string;
  currentStatus?: string;
  badgeNo?: string | null;
  carrier?: EntityReference | string | null;
  supplier?: EntityReference | string | null;
  items?: Array<{
    grade?: string;
    ltrs?: number | string;
  }>;
}

export interface BadgeAllocationDatum {
  id: string;
  carrierName: string;
  badgeNo: string;
  supplierName: string;
  label: string;
  litres: number;
  orderCount: number;
  grades: Record<string, number>;
}

interface CarrierBadgeAllocationChartProps {
  orders: CarrierBadgeOrder[];
  selectedGrades: string[];
  getGradeTheme: (grade: string) => { raw: string };
  isLoading?: boolean;
}

interface MutableBadgeAllocationDatum
  extends Omit<BadgeAllocationDatum, "orderCount"> {
  orderIds: Set<string>;
}

interface ChartDatum extends BadgeAllocationDatum {
  color: string;
  share: number;
}

type CarrierStackRow = {
  carrierName: string;
  totalLitres: number;
} & Record<string, number | string>;

const ALL_BADGES = "__all__";

const BADGE_COLORS = [
  "#2563eb",
  "#0d9488",
  "#7c3aed",
  "#ea580c",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#9333ea",
  "#dc2626",
  "#475569",
  "#0284c7",
  "#ca8a04",
];

const formatLitres = (litres: number) =>
  `${Math.round(litres).toLocaleString()} L`;

function getReferenceName(
  entity: EntityReference | string | null | undefined,
  fallbackLabel: string,
  nameKeys: Array<keyof EntityReference>,
) {
  if (entity && typeof entity === "object") {
    for (const key of nameKeys) {
      const value = entity[key];
      if (value) return String(value);
    }
    if (entity._id) return `${fallbackLabel} ${String(entity._id).slice(-6)}`;
  }

  if (typeof entity === "string" && entity) {
    return `${fallbackLabel} ${entity.slice(-6)}`;
  }

  return `Unassigned ${fallbackLabel}`;
}

function getCarrierId(order: CarrierBadgeOrder, carrierName: string) {
  if (order.carrier && typeof order.carrier === "object") {
    return String(order.carrier._id ?? `carrier:${carrierName}`);
  }

  if (typeof order.carrier === "string" && order.carrier) {
    return order.carrier;
  }

  return "unassigned-carrier";
}

export function aggregateCarrierBadgeAllocations(
  orders: CarrierBadgeOrder[],
  selectedGrades: string[],
  basis: CarrierBadgeBasis,
): BadgeAllocationDatum[] {
  const selectedGradeSet = new Set(selectedGrades);
  const badges = new Map<string, MutableBadgeAllocationDatum>();

  (orders || []).forEach((order, orderIndex) => {
    if (basis === "delivered" && order.currentStatus !== "Delivered") return;
    if (basis === "ordered" && order.currentStatus === "Cancelled") return;

    const matchingItems = (order.items || []).filter((item) => {
      const litres = Number(item.ltrs) || 0;
      return Boolean(item.grade) && selectedGradeSet.has(item.grade!) && litres > 0;
    });

    if (matchingItems.length === 0) return;

    const carrierName = getReferenceName(order.carrier, "Carrier", [
      "carrierName",
      "name",
    ]);
    const carrierId = getCarrierId(order, carrierName);
    const badgeNo = (order.badgeNo || "No Badge").trim() || "No Badge";
    const supplierName = getReferenceName(order.supplier, "Supplier", [
      "supplierName",
      "name",
    ]);
    const id = `${carrierId}:${badgeNo}:${supplierName}`;
    const current = badges.get(id) ?? {
      id,
      carrierName,
      badgeNo,
      supplierName,
      label: `${badgeNo} · ${supplierName}`,
      litres: 0,
      grades: {},
      orderIds: new Set<string>(),
    };

    matchingItems.forEach((item) => {
      const grade = item.grade!;
      const litres = Number(item.ltrs) || 0;
      current.litres += litres;
      current.grades[grade] = (current.grades[grade] || 0) + litres;
    });

    current.orderIds.add(order._id ?? `order-${orderIndex}`);
    badges.set(id, current);
  });

  return Array.from(badges.values())
    .map(({ orderIds, ...badge }) => ({
      ...badge,
      orderCount: orderIds.size,
    }))
    .sort(
      (a, b) =>
        b.litres - a.litres ||
        a.carrierName.localeCompare(b.carrierName) ||
        a.badgeNo.localeCompare(b.badgeNo) ||
        a.supplierName.localeCompare(b.supplierName),
    );
}

function CarrierBadgeTooltip({
  active,
  payload,
  allocationsById,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
  allocationsById: Map<string, ChartDatum>;
}) {
  if (!active || !payload?.[0]) return null;

  const visibleSegment = payload.find((item) => Number(item.value) > 0);
  const datum = visibleSegment
    ? allocationsById.get(String(visibleSegment.dataKey))
    : null;

  if (!datum) return null;

  return (
    <div className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: datum.color }}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-800">
            {datum.carrierName}
          </p>
          <p className="truncate text-[10px] font-bold uppercase text-slate-400">
            Badge {datum.badgeNo} · {datum.supplierName}
          </p>
        </div>
      </div>
      <p className="text-sm font-black text-slate-900">
        {formatLitres(datum.litres)}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {datum.share.toFixed(1)}% share · {datum.orderCount} order
        {datum.orderCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function CarrierBadgeAllocationChart({
  orders,
  selectedGrades,
  getGradeTheme,
  isLoading = false,
}: CarrierBadgeAllocationChartProps) {
  const [basis, setBasis] = useState<CarrierBadgeBasis>("delivered");
  const [selectedBadgeId, setSelectedBadgeId] = useState(ALL_BADGES);

  const badgeData = useMemo(
    () => aggregateCarrierBadgeAllocations(orders, selectedGrades, basis),
    [orders, selectedGrades, basis],
  );

  const totalVolume = useMemo(
    () => badgeData.reduce((sum, item) => sum + item.litres, 0),
    [badgeData],
  );

  const chartData = useMemo<ChartDatum[]>(
    () =>
      badgeData.map((item, index) => ({
        ...item,
        color: BADGE_COLORS[index % BADGE_COLORS.length],
        share: totalVolume > 0 ? (item.litres / totalVolume) * 100 : 0,
      })),
    [badgeData, totalVolume],
  );

  useEffect(() => {
    if (
      selectedBadgeId !== ALL_BADGES &&
      !chartData.some((item) => item.id === selectedBadgeId)
    ) {
      setSelectedBadgeId(ALL_BADGES);
    }
  }, [chartData, selectedBadgeId]);

  const selectedBadge = chartData.find((item) => item.id === selectedBadgeId);
  const focusVolume = selectedBadge?.litres ?? totalVolume;
  const allocationsById = useMemo(
    () => new Map(chartData.map((item) => [item.id, item])),
    [chartData],
  );
  const carrierRows = useMemo<CarrierStackRow[]>(() => {
    const rows = new Map<string, CarrierStackRow>();

    chartData.forEach((item) => {
      const row = rows.get(item.carrierName) ?? {
        carrierName: item.carrierName,
        totalLitres: 0,
      };

      row[item.id] = item.litres;
      row.totalLitres += item.litres;
      rows.set(item.carrierName, row);
    });

    return Array.from(rows.values()).sort(
      (a, b) => b.totalLitres - a.totalLitres,
    );
  }, [chartData]);
  const detailGrades = useMemo(() => {
    const gradeTotals: Record<string, number> = {};

    if (selectedBadge) {
      Object.assign(gradeTotals, selectedBadge.grades);
    } else {
      chartData.forEach((badge) => {
        Object.entries(badge.grades).forEach(([grade, litres]) => {
          gradeTotals[grade] = (gradeTotals[grade] || 0) + litres;
        });
      });
    }

    return selectedGrades
      .map((grade) => ({ grade, litres: gradeTotals[grade] || 0 }))
      .filter((item) => item.litres > 0);
  }, [chartData, selectedBadge, selectedGrades]);

  if (isLoading) {
    return (
      <div className="flex min-h-[430px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="animate-pulse text-xs font-bold text-slate-400">
          Loading carrier and badge allocations...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <Truck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
              Carrier Allocation &amp; Badge Tracking
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Litres by carrier, terminal badge, and supplier for the active filters
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={basis}
            onValueChange={(value) => setBasis(value as CarrierBadgeBasis)}
          >
            <SelectTrigger className="h-10 w-[165px] bg-white text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delivered">Delivered litres</SelectItem>
              <SelectItem value="ordered">Ordered litres</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
            <SelectTrigger className="h-10 w-[300px] bg-white text-xs font-bold">
              <SelectValue placeholder="Choose a badge" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={ALL_BADGES}>All carrier badges</SelectItem>
              {chartData.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.carrierName} · {item.badgeNo} · {item.supplierName} ·{" "}
                  {formatLitres(item.litres)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex min-h-[340px] flex-col items-center justify-center gap-2 text-center">
          <div className="rounded-full bg-slate-100 p-4 text-slate-400">
            <CreditCard className="h-7 w-7" />
          </div>
          <p className="text-sm font-black text-slate-700">
            No badge volume to show
          </p>
          <p className="max-w-md text-xs font-medium text-slate-400">
            No {basis} litres match the selected sites, months, and grades.
          </p>
        </div>
      ) : (
        <div className="grid min-h-[380px] grid-cols-1 gap-6 pt-5 xl:grid-cols-[minmax(460px,1.2fr)_minmax(360px,0.8fr)]">
          <div className="min-h-[360px] min-w-0">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart
                data={carrierRows}
                layout="vertical"
                margin={{ top: 10, right: 28, bottom: 10, left: 22 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    Number(value) >= 1000
                      ? `${Math.round(Number(value) / 1000)}k`
                      : String(value)
                  }
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="carrierName"
                  width={118}
                  tick={{ fontSize: 10, fill: "#475569", fontWeight: 800 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={
                    <CarrierBadgeTooltip allocationsById={allocationsById} />
                  }
                  cursor={false}
                />
                {chartData.map((item) => (
                  <Bar
                    key={item.id}
                    dataKey={item.id}
                    stackId="litres"
                    fill={item.color}
                    fillOpacity={
                      selectedBadgeId === ALL_BADGES ||
                      selectedBadgeId === item.id
                        ? 1
                        : 0.25
                    }
                    radius={[0, 8, 8, 0]}
                    barSize={28}
                    className="cursor-pointer outline-none transition-opacity"
                    onClick={() => setSelectedBadgeId(item.id)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {selectedBadge ? "Selected badge" : "Carrier portfolio"}
                  </p>
                  <p className="truncate text-base font-black text-slate-800">
                    {selectedBadge?.carrierName ?? "All carrier badges"}
                  </p>
                  {selectedBadge && (
                    <p className="truncate text-[11px] font-bold text-slate-400">
                      Badge {selectedBadge.badgeNo} · {selectedBadge.supplierName}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-lg font-black text-indigo-700">
                    {formatLitres(focusVolume)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {selectedBadge
                      ? `${selectedBadge.orderCount} order${selectedBadge.orderCount === 1 ? "" : "s"}`
                      : `${chartData.length} badges`}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {detailGrades.map(({ grade, litres }) => {
                  const share = focusVolume > 0 ? (litres / focusVolume) * 100 : 0;

                  return (
                    <div
                      key={grade}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-black text-slate-700">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: getGradeTheme(grade).raw }}
                          />
                          {grade}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-xs font-black text-slate-900">
                        {formatLitres(litres)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1fr)_95px_62px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
                <span>Carrier / badge / supplier</span>
                <span className="text-right">Litres</span>
                <span className="text-right">Share</span>
              </div>
              <div className="max-h-[210px] overflow-y-auto">
                {chartData.map((item) => {
                  const active = selectedBadgeId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedBadgeId(active ? ALL_BADGES : item.id)
                      }
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_95px_62px] items-center border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-indigo-50/60",
                        active && "bg-indigo-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-slate-700">
                            {item.carrierName}
                          </span>
                          <span className="block truncate text-[10px] font-semibold text-slate-400">
                            {item.badgeNo} · {item.supplierName}
                          </span>
                        </span>
                        {active && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                        )}
                      </span>
                      <span className="text-right text-xs font-black text-slate-800">
                        {formatLitres(item.litres)}
                      </span>
                      <span className="text-right text-[11px] font-bold text-slate-400">
                        {item.share.toFixed(1)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CarrierBadgeAllocationChart;
