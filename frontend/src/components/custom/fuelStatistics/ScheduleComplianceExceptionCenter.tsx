import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Search, XCircle } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ComplianceStatus = "early" | "onTime" | "delayed";

interface EntityReference {
  _id?: string;
  name?: string;
  carrierName?: string;
  rackName?: string;
  terminalName?: string;
  rackLocation?: string;
  supplierName?: string;
  site?: string;
  stationName?: string;
}

interface DeliveryWindow {
  start?: string;
  end?: string;
}

interface OrderComment {
  text?: string;
  author?: string;
  timestamp?: string;
}

export interface ScheduleComplianceOrder {
  _id?: string;
  poNumber?: string;
  currentStatus?: string;
  originalDeliveryDate?: string;
  estimatedDeliveryDate?: string;
  originalDeliveryWindow?: DeliveryWindow;
  estimatedDeliveryWindow?: DeliveryWindow;
  carrier?: EntityReference | string | null;
  rack?: EntityReference | string | null;
  supplier?: EntityReference | string | null;
  station?: EntityReference | string | null;
  comments?: OrderComment[];
  items?: Array<{
    grade?: string;
    ltrs?: number | string;
  }>;
}

export interface CarrierComplianceDatum {
  id: string;
  carrierName: string;
  early: number;
  onTime: number;
  delayed: number;
  total: number;
  onTimeRate: number;
  delayedRate: number;
}

export interface OrderException {
  id: string;
  type: "Cancelled" | "Delayed";
  poNumber: string;
  carrierName: string;
  stationName: string;
  rackLabel: string;
  supplierName: string;
  scheduledLabel: string;
  estimatedLabel: string;
  comments: OrderComment[];
}

interface ScheduleComplianceExceptionCenterProps {
  orders: ScheduleComplianceOrder[];
  selectedGrades: string[];
  isLoading?: boolean;
}

const ALL_CARRIERS = "__all__";
const EXCEPTION_FILTERS = ["All", "Delayed", "Cancelled"] as const;
type ExceptionFilter = (typeof EXCEPTION_FILTERS)[number];

const STATUS_META: Record<
  ComplianceStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  early: { label: "Early", color: "#0d9488", icon: Clock3 },
  onTime: { label: "On-time", color: "#22c55e", icon: CheckCircle2 },
  delayed: { label: "Delayed", color: "#ef4444", icon: XCircle },
};

function hasSelectedGrade(order: ScheduleComplianceOrder, selectedGrades: string[]) {
  const selectedGradeSet = new Set(selectedGrades);

  return (order.items || []).some((item) => {
    const litres = Number(item.ltrs) || 0;
    return Boolean(item.grade) && selectedGradeSet.has(item.grade!) && litres > 0;
  });
}

function getReferenceName(
  entity: EntityReference | string | null | undefined,
  fallbackLabel: string,
  keys: Array<keyof EntityReference>,
) {
  if (entity && typeof entity === "object") {
    for (const key of keys) {
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

function getCarrierId(order: ScheduleComplianceOrder, carrierName: string) {
  if (order.carrier && typeof order.carrier === "object") {
    return String(order.carrier._id ?? `carrier:${carrierName}`);
  }

  if (typeof order.carrier === "string" && order.carrier) {
    return order.carrier;
  }

  return "unassigned-carrier";
}

function dateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function schedulePoint(dateValue?: string, timeValue?: string) {
  const key = dateKey(dateValue);
  const minutes = parseTimeToMinutes(timeValue);
  if (!key || minutes === null) return null;

  const day = Math.floor(new Date(`${key}T00:00:00Z`).getTime() / 60000);
  return day + minutes;
}

function classifySchedule(order: ScheduleComplianceOrder): ComplianceStatus | null {
  const originalStart = schedulePoint(
    order.originalDeliveryDate,
    order.originalDeliveryWindow?.start,
  );
  const originalEnd = schedulePoint(
    order.originalDeliveryDate,
    order.originalDeliveryWindow?.end,
  );
  const estimatedStart = schedulePoint(
    order.estimatedDeliveryDate,
    order.estimatedDeliveryWindow?.start,
  );
  const estimatedEnd = schedulePoint(
    order.estimatedDeliveryDate,
    order.estimatedDeliveryWindow?.end,
  );

  if (
    originalStart === null ||
    originalEnd === null ||
    estimatedStart === null ||
    estimatedEnd === null
  ) {
    return null;
  }

  if (estimatedEnd < originalStart) return "early";
  if (estimatedStart > originalEnd) return "delayed";
  return "onTime";
}

export function aggregateCarrierScheduleCompliance(
  orders: ScheduleComplianceOrder[],
  selectedGrades: string[],
): CarrierComplianceDatum[] {
  const carriers = new Map<string, CarrierComplianceDatum>();

  (orders || []).forEach((order) => {
    if (order.currentStatus !== "Delivered") return;
    if (!hasSelectedGrade(order, selectedGrades)) return;

    const status = classifySchedule(order);
    if (!status) return;

    const carrierName = getReferenceName(order.carrier, "Carrier", [
      "carrierName",
      "name",
    ]);
    const id = getCarrierId(order, carrierName);
    const current = carriers.get(id) ?? {
      id,
      carrierName,
      early: 0,
      onTime: 0,
      delayed: 0,
      total: 0,
      onTimeRate: 0,
      delayedRate: 0,
    };

    current[status] += 1;
    current.total += 1;
    carriers.set(id, current);
  });

  return Array.from(carriers.values())
    .map((carrier) => ({
      ...carrier,
      onTimeRate:
        carrier.total > 0
          ? ((carrier.early + carrier.onTime) / carrier.total) * 100
          : 0,
      delayedRate:
        carrier.total > 0 ? (carrier.delayed / carrier.total) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.onTimeRate - a.onTimeRate ||
        a.carrierName.localeCompare(b.carrierName),
    );
}

function formatDateLabel(value?: string) {
  if (!value) return "No date";
  try {
    const key = dateKey(value);
    return key ? format(parseISO(`${key}T12:00:00`), "MMM d, yyyy") : "No date";
  } catch {
    return "No date";
  }
}

function formatWindow(window?: DeliveryWindow) {
  if (!window?.start && !window?.end) return "No window";
  return `${window.start || "--:--"} - ${window.end || "--:--"}`;
}

function buildScheduleLabel(order: ScheduleComplianceOrder) {
  return `${formatDateLabel(order.originalDeliveryDate)} ${formatWindow(
    order.originalDeliveryWindow,
  )}`;
}

function buildEstimatedLabel(order: ScheduleComplianceOrder) {
  return `${formatDateLabel(order.estimatedDeliveryDate)} ${formatWindow(
    order.estimatedDeliveryWindow,
  )}`;
}

function buildOrderException(
  order: ScheduleComplianceOrder,
  type: OrderException["type"],
  index: number,
): OrderException {
  const rackName = getReferenceName(order.rack, "Rack", [
    "rackName",
    "terminalName",
    "name",
  ]);
  const rackLocation =
    order.rack && typeof order.rack === "object" ? order.rack.rackLocation : "";

  return {
    id: order._id ?? `${type.toLowerCase()}-${index}`,
    type,
    poNumber: order.poNumber ?? "No PO",
    carrierName: getReferenceName(order.carrier, "Carrier", [
      "carrierName",
      "name",
    ]),
    stationName: getReferenceName(order.station, "Station", [
      "site",
      "stationName",
      "name",
    ]),
    rackLabel: [rackName, rackLocation].filter(Boolean).join(" · "),
    supplierName: getReferenceName(order.supplier, "Supplier", [
      "supplierName",
      "name",
    ]),
    scheduledLabel: buildScheduleLabel(order),
    estimatedLabel: buildEstimatedLabel(order),
    comments: order.comments || [],
  };
}

export function getOrderExceptions(
  orders: ScheduleComplianceOrder[],
  selectedGrades: string[],
): OrderException[] {
  return (orders || [])
    .filter(
      (order) =>
        (order.currentStatus === "Cancelled" ||
          (order.currentStatus === "Delivered" &&
            classifySchedule(order) === "delayed")) &&
        hasSelectedGrade(order, selectedGrades),
    )
    .map((order, index) =>
      buildOrderException(
        order,
        order.currentStatus === "Cancelled" ? "Cancelled" : "Delayed",
        index,
      ),
    )
    .sort(
      (a, b) =>
        a.type.localeCompare(b.type) || a.poNumber.localeCompare(b.poNumber),
    );
}

function ComplianceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xl">
      <p className="mb-2 truncate text-xs font-black text-slate-800">{label}</p>
      <div className="space-y-1">
        {payload
          .filter((item) => Number(item.value) > 0)
          .map((item) => {
            const key = String(item.dataKey) as ComplianceStatus;
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {STATUS_META[key]?.label ?? key}
                </span>
                <span className="text-xs font-black text-slate-800">
                  {Number(item.value)} orders
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function ScheduleComplianceExceptionCenter({
  orders,
  selectedGrades,
  isLoading = false,
}: ScheduleComplianceExceptionCenterProps) {
  const [selectedCarrierId, setSelectedCarrierId] = useState(ALL_CARRIERS);
  const [exceptionSearch, setExceptionSearch] = useState("");
  const [exceptionFilter, setExceptionFilter] = useState<ExceptionFilter>("All");

  const complianceData = useMemo(
    () => aggregateCarrierScheduleCompliance(orders, selectedGrades),
    [orders, selectedGrades],
  );
  const orderExceptions = useMemo(
    () => getOrderExceptions(orders, selectedGrades),
    [orders, selectedGrades],
  );
  const selectedCarrier = complianceData.find(
    (carrier) => carrier.id === selectedCarrierId,
  );
  const visibleComplianceData = selectedCarrier ? [selectedCarrier] : complianceData;
  const filteredExceptions = useMemo(() => {
    const search = exceptionSearch.trim().toLowerCase();
    const carrierFilter = selectedCarrier?.carrierName;

    return orderExceptions.filter((order) => {
      const matchesCarrier = carrierFilter
        ? order.carrierName === carrierFilter
        : true;
      const matchesType =
        exceptionFilter === "All" ? true : order.type === exceptionFilter;
      const matchesSearch = search
        ? [
            order.poNumber,
            order.carrierName,
            order.stationName,
            order.rackLabel,
            order.supplierName,
            order.type,
            ...order.comments.map((comment) => comment.text || ""),
          ]
            .join(" ")
            .toLowerCase()
            .includes(search)
        : true;

      return matchesCarrier && matchesType && matchesSearch;
    });
  }, [exceptionFilter, orderExceptions, exceptionSearch, selectedCarrier]);

  const totals = useMemo(
    () =>
      complianceData.reduce(
        (sum, carrier) => ({
          early: sum.early + carrier.early,
          onTime: sum.onTime + carrier.onTime,
          delayed: sum.delayed + carrier.delayed,
          total: sum.total + carrier.total,
        }),
        { early: 0, onTime: 0, delayed: 0, total: 0 },
      ),
    [complianceData],
  );
  const reliabilityRate =
    totals.total > 0 ? ((totals.early + totals.onTime) / totals.total) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[430px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="animate-pulse text-xs font-bold text-slate-400">
          Loading schedule compliance and exceptions...
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(520px,1.05fr)_minmax(440px,0.95fr)]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                Delivery Schedule Adherence
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Carrier accuracy based on original vs final estimated delivery slot
              </p>
            </div>
          </div>

          <Select value={selectedCarrierId} onValueChange={setSelectedCarrierId}>
            <SelectTrigger className="h-10 w-[260px] bg-white text-xs font-bold">
              <SelectValue placeholder="Choose a carrier" />
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={ALL_CARRIERS}>All carriers</SelectItem>
              {complianceData.map((carrier) => (
                <SelectItem key={carrier.id} value={carrier.id}>
                  {carrier.carrierName} · {carrier.onTimeRate.toFixed(0)}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 py-4 sm:grid-cols-3">
          {(["early", "onTime", "delayed"] as ComplianceStatus[]).map(
            (status) => {
              const Icon = STATUS_META[status].icon;
              return (
                <div
                  key={status}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400">
                    <Icon className="h-3.5 w-3.5" />
                    {STATUS_META[status].label}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-800">
                    {totals[status]}
                  </p>
                </div>
              );
            },
          )}
        </div>

        {visibleComplianceData.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-400">
              <CalendarClock className="h-7 w-7" />
            </div>
            <p className="text-sm font-black text-slate-700">
              No delivered orders to score
            </p>
            <p className="max-w-md text-xs font-medium text-slate-400">
              Delivered orders with original and estimated delivery windows will appear here.
            </p>
          </div>
        ) : (
          <div className="min-h-[330px]">
            <ResponsiveContainer width="100%" height={330}>
              <BarChart
                data={visibleComplianceData}
                margin={{ top: 12, right: 20, bottom: 8, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="carrierName"
                  tick={{ fontSize: 10, fill: "#475569", fontWeight: 800 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ComplianceTooltip />} />
                <Legend
                  formatter={(value) =>
                    STATUS_META[value as ComplianceStatus]?.label ?? value
                  }
                />
                {(["early", "onTime", "delayed"] as ComplianceStatus[]).map(
                  (status) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      fill={STATUS_META[status].color}
                      radius={[6, 6, 0, 0]}
                    />
                  ),
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Carrier reliability
              </p>
              <p className="text-sm font-black text-slate-800">
                {selectedCarrier?.carrierName ?? "All carriers"}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xl font-black text-emerald-700">
                {(selectedCarrier?.onTimeRate ?? reliabilityRate).toFixed(1)}%
              </p>
              <p className="text-[10px] font-bold uppercase text-slate-400">
                early + on-time delivery rate
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                Order Exceptions
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                Cancelled and delayed orders with their workflow comments
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {EXCEPTION_FILTERS.map((filter) => {
                const active = exceptionFilter === filter;

                return (
                  <Button
                    key={filter}
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setExceptionFilter(filter)}
                    className={cn(
                      "h-8 px-3 text-[10px] font-black uppercase",
                      active
                        ? "bg-white text-rose-700 shadow-sm hover:bg-white"
                        : "text-slate-500",
                    )}
                  >
                    {filter}
                  </Button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-[240px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                value={exceptionSearch}
                onChange={(event) => setExceptionSearch(event.target.value)}
                placeholder="Search exceptions..."
                className="h-10 pl-9 text-xs font-semibold"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-[110px_minmax(0,1fr)_95px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-black uppercase tracking-wider text-slate-400">
            <span>PO</span>
            <span>Details</span>
            <span className="text-right">Comments</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {filteredExceptions.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-4 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <p className="text-sm font-black text-slate-700">
                  No order exceptions
                </p>
                <p className="max-w-sm text-xs font-medium text-slate-400">
                  Cancelled or delayed delivered orders matching the page filters will appear here.
                </p>
              </div>
            ) : (
              filteredExceptions.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[110px_minmax(0,1fr)_95px] gap-3 border-b border-slate-100 px-3 py-3 last:border-0"
                >
                  <div>
                    <p className="truncate text-xs font-black text-slate-800">
                      {order.poNumber}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] font-bold uppercase",
                        order.type === "Cancelled"
                          ? "text-rose-500"
                          : "text-amber-600",
                      )}
                    >
                      {order.type}
                    </p>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-xs font-black text-slate-700">
                      {order.carrierName} · {order.stationName}
                    </p>
                    <p className="truncate text-[11px] font-semibold text-slate-400">
                      {order.supplierName} · {order.rackLabel}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400">
                      Scheduled {order.scheduledLabel}
                    </p>
                    {order.type === "Delayed" && (
                      <p className="text-[10px] font-bold text-amber-600">
                        Estimated {order.estimatedLabel}
                      </p>
                    )}
                    <div className="mt-2 space-y-1.5">
                      {order.comments.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-400">
                          No exception comment captured.
                        </p>
                      ) : (
                        order.comments.map((comment, index) => (
                          <div
                            key={`${order.id}-${index}`}
                            className="rounded-lg bg-rose-50/70 px-2 py-1.5"
                          >
                            <p className="text-[11px] font-semibold text-slate-700">
                              {comment.text || "No comment text"}
                            </p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">
                              {comment.author || "Unknown"} ·{" "}
                              {comment.timestamp
                                ? formatDateLabel(comment.timestamp)
                                : "No timestamp"}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-black",
                        order.comments.length > 0
                          ? "bg-rose-100 text-rose-700"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      {order.comments.length}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScheduleComplianceExceptionCenter;
