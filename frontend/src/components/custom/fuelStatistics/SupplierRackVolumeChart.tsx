import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Droplets, Warehouse } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type VolumeDimension = "supplier" | "rack";
export type VolumeBasis = "delivered" | "ordered";

interface EntityReference {
  _id?: string;
  name?: string;
  supplierName?: string;
  rackName?: string;
  terminalName?: string;
  rackLocation?: string;
}

export interface SupplierRackOrder {
  _id?: string;
  currentStatus?: string;
  supplier?: EntityReference | string | null;
  rack?: EntityReference | string | null;
  items?: Array<{
    grade?: string;
    ltrs?: number | string;
  }>;
}

export interface VolumeShareDatum {
  id: string;
  name: string;
  detail: string;
  litres: number;
  orderCount: number;
  grades: Record<string, number>;
}

interface SupplierRackVolumeChartProps {
  orders: SupplierRackOrder[];
  selectedGrades: string[];
  getGradeTheme: (grade: string) => { raw: string };
  isLoading?: boolean;
}

interface MutableVolumeShareDatum extends Omit<VolumeShareDatum, "orderCount"> {
  orderIds: Set<string>;
}

interface ChartDatum extends VolumeShareDatum {
  color: string;
  share: number;
}

const ALL_ENTITIES = "__all__";

const ENTITY_COLORS = [
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
];

const formatLitres = (litres: number) =>
  `${Math.round(litres).toLocaleString()} L`;

function getEntityIdentity(
  order: SupplierRackOrder,
  dimension: VolumeDimension,
) {
  const entity = order[dimension];
  const label = dimension === "supplier" ? "Supplier" : "Rack";

  if (entity && typeof entity === "object") {
    const name =
      (dimension === "supplier"
        ? entity.supplierName ?? entity.name
        : entity.rackName ?? entity.terminalName ?? entity.name) ||
      `Unnamed ${label}`;
    const rack =
      order.rack && typeof order.rack === "object" ? order.rack : null;
    const supplier =
      order.supplier && typeof order.supplier === "object"
        ? order.supplier
        : null;
    const rackName =
      rack?.rackName ?? rack?.terminalName ?? rack?.name ?? "Unassigned Rack";
    const rackLocation = rack?.rackLocation;
    const supplierName =
      supplier?.supplierName ?? supplier?.name ?? "Unassigned Supplier";

    return {
      id: String(entity._id ?? `${dimension}:${name}`),
      name,
      detail:
        dimension === "supplier"
          ? [rackName, rackLocation].filter(Boolean).join(" · ")
          : [supplierName, rackLocation].filter(Boolean).join(" · "),
    };
  }

  if (typeof entity === "string" && entity) {
    return {
      id: entity,
      name: `${label} ${entity.slice(-6)}`,
      detail: "",
    };
  }

  return {
    id: `unassigned-${dimension}`,
    name: `Unassigned ${label}`,
    detail: "",
  };
}

export function aggregateSupplierRackVolumes(
  orders: SupplierRackOrder[],
  selectedGrades: string[],
  dimension: VolumeDimension,
  basis: VolumeBasis,
): VolumeShareDatum[] {
  const selectedGradeSet = new Set(selectedGrades);
  const entities = new Map<string, MutableVolumeShareDatum>();

  (orders || []).forEach((order, orderIndex) => {
    if (basis === "delivered" && order.currentStatus !== "Delivered") return;
    if (basis === "ordered" && order.currentStatus === "Cancelled") return;

    const matchingItems = (order.items || []).filter((item) => {
      const litres = Number(item.ltrs) || 0;
      return Boolean(item.grade) && selectedGradeSet.has(item.grade!) && litres > 0;
    });

    if (matchingItems.length === 0) return;

    const { id, name, detail } = getEntityIdentity(order, dimension);
    const current = entities.get(id) ?? {
      id,
      name,
      detail,
      litres: 0,
      grades: {},
      orderIds: new Set<string>(),
    };
    if (detail && !current.detail.includes(detail)) {
      current.detail = current.detail ? `${current.detail}; ${detail}` : detail;
    }

    matchingItems.forEach((item) => {
      const grade = item.grade!;
      const litres = Number(item.ltrs) || 0;
      current.litres += litres;
      current.grades[grade] = (current.grades[grade] || 0) + litres;
    });

    current.orderIds.add(order._id ?? `order-${orderIndex}`);
    entities.set(id, current);
  });

  return Array.from(entities.values())
    .map(({ orderIds, ...entity }) => ({
      ...entity,
      orderCount: orderIds.size,
    }))
    .sort((a, b) => b.litres - a.litres || a.name.localeCompare(b.name));
}

function VolumeShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}) {
  if (!active || !payload?.[0]) return null;

  const datum = payload[0].payload;

  return (
    <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: datum.color }}
        />
        <p className="max-w-[190px] truncate text-xs font-black text-slate-800">
          {datum.name}
        </p>
      </div>
      {datum.detail && (
        <p className="mb-1 truncate text-[10px] font-bold text-slate-400">
          {datum.detail}
        </p>
      )}
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

export function SupplierRackVolumeChart({
  orders,
  selectedGrades,
  getGradeTheme,
  isLoading = false,
}: SupplierRackVolumeChartProps) {
  const [dimension, setDimension] = useState<VolumeDimension>("supplier");
  const [basis, setBasis] = useState<VolumeBasis>("delivered");
  const [selectedEntityId, setSelectedEntityId] = useState(ALL_ENTITIES);

  const volumeData = useMemo(
    () =>
      aggregateSupplierRackVolumes(orders, selectedGrades, dimension, basis),
    [orders, selectedGrades, dimension, basis],
  );

  const totalVolume = useMemo(
    () => volumeData.reduce((sum, item) => sum + item.litres, 0),
    [volumeData],
  );

  const chartData = useMemo<ChartDatum[]>(
    () =>
      volumeData.map((item, index) => ({
        ...item,
        color: ENTITY_COLORS[index % ENTITY_COLORS.length],
        share: totalVolume > 0 ? (item.litres / totalVolume) * 100 : 0,
      })),
    [volumeData, totalVolume],
  );

  useEffect(() => {
    if (
      selectedEntityId !== ALL_ENTITIES &&
      !chartData.some((item) => item.id === selectedEntityId)
    ) {
      setSelectedEntityId(ALL_ENTITIES);
    }
  }, [chartData, selectedEntityId]);

  const selectedEntity = chartData.find(
    (item) => item.id === selectedEntityId,
  );

  const detailGrades = useMemo(() => {
    const gradeTotals: Record<string, number> = {};

    if (selectedEntity) {
      Object.assign(gradeTotals, selectedEntity.grades);
    } else {
      chartData.forEach((entity) => {
        Object.entries(entity.grades).forEach(([grade, litres]) => {
          gradeTotals[grade] = (gradeTotals[grade] || 0) + litres;
        });
      });
    }

    return selectedGrades
      .map((grade) => ({ grade, litres: gradeTotals[grade] || 0 }))
      .filter((item) => item.litres > 0);
  }, [chartData, selectedEntity, selectedGrades]);

  const focusVolume = selectedEntity?.litres ?? totalVolume;
  const dimensionLabel = dimension === "supplier" ? "supplier" : "rack";
  const DimensionIcon = dimension === "supplier" ? Building2 : Warehouse;

  const changeDimension = (nextDimension: VolumeDimension) => {
    setDimension(nextDimension);
    setSelectedEntityId(ALL_ENTITIES);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[430px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="animate-pulse text-xs font-bold text-slate-400">
          Loading supplier and rack volumes...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Droplets className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                Supplier &amp; Rack Volume Share
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Litres by {dimensionLabel} for the active dashboard filters
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["supplier", "rack"] as VolumeDimension[]).map((option) => {
              const Icon = option === "supplier" ? Building2 : Warehouse;
              const active = dimension === option;

              return (
                <Button
                  key={option}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => changeDimension(option)}
                  className={cn(
                    "h-8 gap-1.5 px-3 text-[10px] font-black uppercase",
                    active
                      ? "bg-white text-blue-700 shadow-sm hover:bg-white"
                      : "text-slate-500",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {option === "supplier" ? "Suppliers" : "Racks"}
                </Button>
              );
            })}
          </div>

          <Select
            value={basis}
            onValueChange={(value) => setBasis(value as VolumeBasis)}
          >
            <SelectTrigger className="h-10 w-[165px] bg-white text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delivered">Delivered litres</SelectItem>
              <SelectItem value="ordered">Ordered litres</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger className="h-10 w-[220px] bg-white text-xs font-bold">
              <SelectValue
                placeholder={`Choose a ${dimensionLabel}`}
              />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={ALL_ENTITIES}>
                All {dimension === "supplier" ? "suppliers" : "racks"}
              </SelectItem>
              {chartData.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                  {item.detail ? ` · ${item.detail}` : ""} ·{" "}
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
            <DimensionIcon className="h-7 w-7" />
          </div>
          <p className="text-sm font-black text-slate-700">No volume to show</p>
          <p className="max-w-md text-xs font-medium text-slate-400">
            No {basis} litres match the selected sites, months, and grades.
            Adjust the dashboard filters or choose another volume type.
          </p>
        </div>
      ) : (
        <div className="grid min-h-[360px] grid-cols-1 gap-6 pt-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]">
          <div className="relative min-h-[320px] min-w-0">
            <ResponsiveContainer width="100%" height={330}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="litres"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={82}
                  outerRadius={126}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {chartData.map((item) => (
                    <Cell
                      key={item.id}
                      fill={item.color}
                      opacity={
                        selectedEntityId === ALL_ENTITIES ||
                        selectedEntityId === item.id
                          ? 1
                          : 0.22
                      }
                      className="cursor-pointer outline-none transition-opacity"
                      onClick={() => setSelectedEntityId(item.id)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<VolumeShareTooltip />} />
                <text
                  x="50%"
                  y="47%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-900 text-xl font-black"
                >
                  {focusVolume >= 1_000_000
                    ? `${(focusVolume / 1_000_000).toFixed(1)}M L`
                    : focusVolume >= 1_000
                      ? `${(focusVolume / 1_000).toFixed(1)}k L`
                      : formatLitres(focusVolume)}
                </text>
                <text
                  x="50%"
                  y="56%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400 text-[10px] font-bold uppercase"
                >
                  {selectedEntity ? `${selectedEntity.share.toFixed(1)}% share` : "Total volume"}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {selectedEntity ? `Selected ${dimensionLabel}` : "Portfolio"}
                  </p>
                  <p className="truncate text-base font-black text-slate-800">
                    {selectedEntity?.name ??
                      `All ${dimension === "supplier" ? "suppliers" : "racks"}`}
                  </p>
                  {selectedEntity?.detail && (
                    <p className="truncate text-[11px] font-bold text-slate-400">
                      {selectedEntity.detail}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-lg font-black text-blue-700">
                    {formatLitres(focusVolume)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    {selectedEntity
                      ? `${selectedEntity.orderCount} order${selectedEntity.orderCount === 1 ? "" : "s"}`
                      : `${chartData.length} ${dimension === "supplier" ? "suppliers" : "racks"}`}
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
              <div className="grid grid-cols-[minmax(0,1fr)_100px_66px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
                <span>{dimension === "supplier" ? "Supplier" : "Rack"}</span>
                <span className="text-right">Litres</span>
                <span className="text-right">Share</span>
              </div>
              <div className="max-h-[190px] overflow-y-auto">
                {chartData.map((item) => {
                  const active = selectedEntityId === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSelectedEntityId(active ? ALL_ENTITIES : item.id)
                      }
                      className={cn(
                        "grid w-full grid-cols-[minmax(0,1fr)_100px_66px] items-center border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-blue-50/60",
                        active && "bg-blue-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-xs font-bold text-slate-700">
                          {item.name}
                        </span>
                        {item.detail && (
                          <span className="hidden truncate text-[10px] font-semibold text-slate-400 xl:inline">
                            {item.detail}
                          </span>
                        )}
                        {active && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />
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

export default SupplierRackVolumeChart;
