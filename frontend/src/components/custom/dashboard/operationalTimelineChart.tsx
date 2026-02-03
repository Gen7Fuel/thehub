// import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
// const MINUTES_IN_DAY = 1440;

// interface OperationalTiming {
//   date: string;
//   stationOpen: string | null;
//   stationClose: string | null;
//   firstRegTrans: string | null;
//   lastRegTrans: string | null;
//   firstCardlockTrans: string | null;
//   lastCardlockTrans: string | null;
//   isSubmitted: boolean;
//   chartMetrics: {
//     openMin: number | null;
//     closeMin: number | null;
//     regStartMin: number | null;
//     regEndMin: number | null;
//     clStartMin: number | null;
//     clEndMin: number | null;
//     isZombieShift: boolean;
//     isMissingClose: boolean;
//     hasActivityBeforeOpen: boolean;
//   };
// }

// function formatMinutes(min: number | null): string {
//   if (min == null) return "—";
//   const h = Math.floor(min / 60);
//   const m = min % 60;
//   return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
// }

// export default function OperationalTimelineCard({ data = [] }: { data: OperationalTiming[] }) {
//   return (
//     <Card className="col-span-1 md:col-span-2 lg:col-span-3">
//       <CardHeader>
//         <CardTitle>Operational Timeline (Last 7 Days)</CardTitle>
//         <CardDescription>
//           Shift vs Register vs Cardlock activity
//         </CardDescription>
//       </CardHeader>

//       <CardContent className="space-y-4">
//         {data.length === 0 && (
//           <div className="text-muted-foreground text-center py-8">
//             No operational data available
//           </div>
//         )}

//         {data.map((day) => {
//           const m = day.chartMetrics;

//           const shiftWidth = m.closeMin != null && m.openMin != null
//             ? m.closeMin - m.openMin
//             : 0;

//           const regWidth = m.regEndMin != null && m.regStartMin != null
//             ? m.regEndMin - m.regStartMin
//             : 0;

//           const clWidth = m.clEndMin != null && m.clStartMin != null
//             ? m.clEndMin - m.clStartMin
//             : 0;

//           return (
//             <div key={day.date} className="space-y-1">
//               {/* Day Label */}
//               <div className="flex justify-between text-xs font-medium text-muted-foreground">
//                 <span>{day.date}</span>
//                 <span>
//                   Shift: {formatMinutes(m.openMin)} → {formatMinutes(m.closeMin)}
//                 </span>
//               </div>

//               {/* Timeline Track */}
//               <div className="relative h-6 rounded bg-muted overflow-hidden">

//                 {/* Shift Bar */}
//                 {m.openMin != null && (
//                   <div
//                     className={`absolute h-full rounded ${
//                       m.isMissingClose ? "border-2 border-red-500 border-dashed" :
//                       m.isZombieShift ? "border-2 border-orange-400" :
//                       "bg-blue-500"
//                     }`}
//                     style={{
//                       left: `${(m.openMin / MINUTES_IN_DAY) * 100}%`,
//                       width: `${(shiftWidth / MINUTES_IN_DAY) * 100}%`
//                     }}
//                   />
//                 )}

//                 {/* Register Activity */}
//                 {m.regStartMin != null && (
//                   <div
//                     className="absolute h-2 top-1 rounded bg-green-500 opacity-90"
//                     style={{
//                       left: `${(m.regStartMin / MINUTES_IN_DAY) * 100}%`,
//                       width: `${(regWidth / MINUTES_IN_DAY) * 100}%`
//                     }}
//                   />
//                 )}

//                 {/* Cardlock Activity */}
//                 {m.clStartMin != null && (
//                   <div
//                     className="absolute h-2 bottom-1 rounded bg-purple-500 opacity-90"
//                     style={{
//                       left: `${(m.clStartMin / MINUTES_IN_DAY) * 100}%`,
//                       width: `${(clWidth / MINUTES_IN_DAY) * 100}%`
//                     }}
//                   />
//                 )}

//                 {/* Activity Before Open Marker */}
//                 {m.hasActivityBeforeOpen && (
//                   <div
//                     className="absolute top-0 bottom-0 w-[2px] bg-yellow-400"
//                     style={{
//                       left: `${(m.regStartMin || 0 / MINUTES_IN_DAY) * 100}%`
//                     }}
//                   />
//                 )}
//               </div>
//             </div>
//           );
//         })}
//       </CardContent>

//       <CardFooter className="flex flex-wrap gap-4 text-xs text-muted-foreground">
//         <span className="flex items-center gap-1">
//           <span className="w-3 h-3 bg-blue-500 rounded" /> Shift
//         </span>
//         <span className="flex items-center gap-1">
//           <span className="w-3 h-3 bg-green-500 rounded" /> Register
//         </span>
//         <span className="flex items-center gap-1">
//           <span className="w-3 h-3 bg-purple-500 rounded" /> Cardlock
//         </span>
//         <span className="flex items-center gap-1">
//           ⚠️ Zombie Shift
//         </span>
//         <span className="flex items-center gap-1">
//           ❌ Missing Close
//         </span>
//       </CardFooter>
//     </Card>
//   );
// }
// import { useState } from "react";
// import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";

// interface OperationalTiming {
//   date: string;
//   stationOpen: string | null;
//   stationClose: string | null;
//   firstRegTrans: string | null;
//   lastRegTrans: string | null;
//   firstCardlockTrans: string | null;
//   lastCardlockTrans: string | null;
//   isSubmitted: boolean;
//   chartMetrics: {
//     openMin?: number | null;
//     closeMin?: number | null;
//     regStartMin?: number | null;
//     regEndMin?: number | null;
//     clStartMin?: number | null;
//     clEndMin?: number | null;
//     isZombieShift: boolean;
//     isMissingClose: boolean;
//     hasActivityBeforeOpen: boolean;
//   };
// }

// const MINUTES_IN_DAY = 1440;

// function formatMinutes(min?: number | null): string {
//   if (min == null || Number.isNaN(min)) return "—";
//   const h = Math.floor(min / 60);
//   const m = Math.floor(min % 60);
//   return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
// }

// export default function OperationalTimelineCard({ data = [] }: { data: OperationalTiming[] }) {
//   const [index, setIndex] = useState(0);
//   const day = data[index];
//   if (!day) return null;

//   const m = day.chartMetrics;

//   const shiftStart = typeof m.openMin === "number" ? m.openMin : null;
//   const shiftEnd = typeof m.closeMin === "number"
//     ? m.closeMin
//     : shiftStart != null ? shiftStart + 60 : null;

//   const regStart = typeof m.regStartMin === "number" ? m.regStartMin : null;
//   const regEnd = typeof m.regEndMin === "number" ? m.regEndMin : null;

//   const clStart = typeof m.clStartMin === "number" ? m.clStartMin : null;
//   const clEnd = typeof m.clEndMin === "number" ? m.clEndMin : null;

//   const shiftDuration = shiftStart != null && shiftEnd != null
//     ? Math.max(shiftEnd - shiftStart, 0)
//     : 0;

//   const regDuration = regStart != null && regEnd != null
//     ? Math.max(regEnd - regStart, 0)
//     : 0;

//   const maxMinute = Math.max(
//     MINUTES_IN_DAY,
//     shiftEnd ?? 0,
//     regEnd ?? 0,
//     clEnd ?? 0
//   );

//   const totalRange = maxMinute + 60;

//   // Generate hour ticks
//   const hourTicks = Array.from({ length: Math.ceil(totalRange / 60) + 1 }, (_, i) => i * 60);

//   return (
//     <Card className="col-span-1 md:col-span-2 lg:col-span-3">
//       <CardHeader className="flex flex-row justify-between items-center">
//         <div>
//           <CardTitle>Operational Timeline</CardTitle>
//           <CardDescription>Shift, Register & Cardlock activity</CardDescription>
//         </div>

//         <div className="flex items-center gap-2">
//           <Button size="sm" variant="outline" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>
//             ◀ Previous
//           </Button>

//           <span className="text-sm font-semibold">{day.date}</span>

//           <Button size="sm" variant="outline" disabled={index === data.length - 1} onClick={() => setIndex(i => i + 1)}>
//             Next ▶
//           </Button>
//         </div>
//       </CardHeader>

//       <CardContent className="space-y-6">

//         {/* Axis Labels */}
//         <div className="relative text-xs text-muted-foreground">
//           {hourTicks.map((min) => (
//             <div
//               key={min}
//               className="absolute top-0"
//               style={{ left: `${(min / totalRange) * 100}%` }}
//             >
//               {formatMinutes(min)}
//             </div>
//           ))}
//         </div>

//         {/* Timeline Track */}
//         <div className="relative h-14 bg-muted rounded overflow-visible border">

//           {/* Hour Grid */}
//           {hourTicks.map((min) => (
//             <div
//               key={min}
//               className="absolute top-0 bottom-0 w-px bg-border opacity-40"
//               style={{ left: `${(min / totalRange) * 100}%` }}
//             />
//           ))}

//           {/* Shift Bar */}
//           {shiftStart != null && shiftEnd != null && (
//             <div
//               className={`absolute top-2 h-10 rounded ${m.isMissingClose
//                   ? "border-2 border-red-500 border-dashed"
//                   : m.isZombieShift
//                     ? "border-2 border-orange-400"
//                     : "bg-blue-500"
//                 }`}
//               style={{
//                 left: `${(shiftStart / totalRange) * 100}%`,
//                 width: `${(shiftDuration / totalRange) * 100}%`
//               }}
//             />
//           )}

//           {/* Register Bar */}
//           {regStart != null && regEnd != null && (
//             <div
//               className="absolute top-4 h-6 bg-green-500 rounded"
//               style={{
//                 left: `${(regStart / totalRange) * 100}%`,
//                 width: `${(regDuration / totalRange) * 100}%`
//               }}
//             />
//           )}

//           {/* Cardlock Markers */}
//           {clStart != null && (
//             <div
//               className="absolute -top-5 text-xs font-semibold text-purple-600"
//               style={{ left: `${(clStart / totalRange) * 100}%` }}
//             >
//               ▼ CL Start
//             </div>
//           )}

//           {clEnd != null && (
//             <div
//               className="absolute -top-5 text-xs font-semibold text-purple-600"
//               style={{ left: `${(clEnd / totalRange) * 100}%` }}
//             >
//               ▼ CL End
//             </div>
//           )}

//           {/* Early Activity Marker */}
//           {m.hasActivityBeforeOpen && regStart != null && (
//             <div
//               className="absolute top-0 bottom-0 w-[3px] bg-yellow-400"
//               style={{ left: `${(regStart / totalRange) * 100}%` }}
//             />
//           )}
//         </div>

//         {/* Summary */}
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
//           <div>Shift: {formatMinutes(m.openMin)} → {formatMinutes(m.closeMin)}</div>
//           <div>Register: {formatMinutes(m.regStartMin)} → {formatMinutes(m.regEndMin)}</div>
//           <div>Cardlock: {formatMinutes(m.clStartMin)} → {formatMinutes(m.clEndMin)}</div>
//           <div>
//             Status:
//             {m.isMissingClose ? " ❌ Missing Close" :
//               m.isZombieShift ? " ⚠️ Zombie Shift" :
//                 m.hasActivityBeforeOpen ? " 🟡 Activity Before Open" :
//                   " ✅ Normal"}
//           </div>
//         </div>

//       </CardContent>
//     </Card>
//   );
// }

import { useMemo, useState } from "react";
import {
  Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// const MINUTES_IN_DAY = 1440;
// const MIN_SEGMENT_MINUTES = 6; // ensures visibility

type Day = {
  date: string;
  stationOpen?: string | null;
  stationClose?: string | null;
  firstRegTrans?: string | null;
  lastRegTrans?: string | null;
  firstCardlockTrans?: string | null;
  lastCardlockTrans?: string | null;
  isSubmitted: boolean;
};

// Standardized to UTC to prevent "Timezone Shifting"
function minutesSinceMidnight(ts?: string | null) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  // Use UTC to match the raw database string
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

// Check if the event happened on a different calendar day than the row date
function isPreviousDay(ts?: string | null, baseDateStr?: string) {
  if (!ts || !baseDateStr) return false;
  // Extract YYYY-MM-DD from the ISO string
  const eventDate = ts.split('T')[0];
  return eventDate !== baseDateStr;
}

// This function needs to be absolutely consistent with buildSegments
function formatStoreTime(ts?: string | null) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

function buildSegments(day: Day) {
  const baseDate = day.date;

  const m = {
    open: minutesSinceMidnight(day.stationOpen),
    close: minutesSinceMidnight(day.stationClose),
    regS: minutesSinceMidnight(day.firstRegTrans),
    regE: minutesSinceMidnight(day.lastRegTrans),
    isZombie: isPreviousDay(day.stationOpen, baseDate)
  };

  const points = new Set<number>([0, 1440]);
  [m.open, m.close, m.regS, m.regE].forEach(v => {
    if (v !== null) points.add(Math.max(0, Math.min(1440, v)));
  });

  const sorted = [...points].sort((a, b) => a - b);
  const segments: { start: number; end: number; type: string }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const s = sorted[i];
    const e = sorted[i + 1];
    const mid = (s + e) / 2;
    let type = "idle";

    if (m.regS !== null && m.regE !== null && mid >= m.regS && mid <= m.regE) {
      type = "register";
    }
    else if (m.open !== null && m.close !== null && mid >= m.open && mid <= m.close) {
      type = "shift";
    }
    else if (m.isZombie && m.open !== null && mid < m.open) {
      type = "shift-prev";
    }

    if (type !== "idle") {
      segments.push({ start: s, end: e, type });
    }
  }
  return segments;
}

function getSegmentStyles(type: string) {
  const base = "h-full transition-all";
  switch (type) {
    case "register": return `${base} bg-green-500`;
    case "cardlock": return `${base} bg-orange-500`;
    case "shift-prev": return `${base} bg-red-600`;
    case "shift": return `${base} bg-blue-500`;
    default: return `${base} bg-transparent`;
  }
}

const formatDateSafe = (dateStr: string, options: Intl.DateTimeFormatOptions) => {
  // Splits '2026-01-30' into [2026, 0, 30] to avoid timezone rolling
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date);
};

export default function OperationalTimelineCard({ data }: { data: Day[] }) {
  const [selected, setSelected] = useState<Day | null>(null);

  const rows = useMemo(() => {
    // Sort data so the newest date is at index 0
    const sortedData = [...data].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return sortedData.map(day => ({
      ...day,
      segments: buildSegments(day)
    }));
  }, [data]);

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Store Activity Timeline (Past 7 Days)</CardTitle>
          <CardDescription>Daily operational windows and transaction activity</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="h-[260px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar w-full">

            {/* 1. STICKY HEADER - Updated to match row layout exactly */}
            <div className="sticky top-0 z-40 bg-white flex items-center gap-4 mb-3 pb-1 w-full">
              {/* Spacer must match the row's date width exactly (using w-12 here) */}
              <div className="w-12 shrink-0" />

              {/* The container for hours - overflow-visible ensures 12AM/24PM don't clip */}
              <div className="relative flex-1 h-5 overflow-visible">
                {[0, 6, 12, 18, 24].map((h) => (
                  <div
                    key={h}
                    className="absolute transform -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${(h / 24) * 100}%` }}
                  >
                    <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                      {h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`}
                    </span>
                    <div className="w-px h-1 bg-gray-200 mt-0.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* 2. ACTIVITY ROWS */}
            <div className="space-y-3">
              {rows.map((row, i) => {
                const clStart = minutesSinceMidnight(row.firstCardlockTrans);
                const clEnd = minutesSinceMidnight(row.lastCardlockTrans);

                return (
                  <div key={i} className="flex items-center gap-4 group">
                    {/* Date Label - Matching the w-12 spacer above */}
                    <div className="w-12 shrink-0 flex flex-col justify-center leading-none">
                      <span className="text-[11px] font-bold text-gray-800 uppercase">
                        {formatDateSafe(row.date, { weekday: 'short' })}
                      </span>
                      <span className="text-[10px] font-medium text-gray-400">
                        {formatDateSafe(row.date, { month: '2-digit', day: '2-digit' })}
                      </span>
                    </div>

                    {/* Timeline Track */}
                    <div
                      className="relative flex-1 h-7 rounded-md bg-gray-50 border border-gray-100 cursor-pointer hover:border-gray-300 transition-all overflow-visible"
                      onClick={() => setSelected(row)}
                    >
                      {/* Gridlines Layer */}
                      <div className="absolute inset-0 flex justify-between px-0 pointer-events-none opacity-5 overflow-hidden rounded-md">
                        {[...Array(25)].map((_, idxGrid) => (
                          <div key={idxGrid} className="w-px h-full bg-black" />
                        ))}
                      </div>

                      {/* Segments Layer */}
                      <div className="absolute inset-0 overflow-hidden rounded-md">
                        {row.segments.map((seg, idx) => (
                          <div
                            key={idx}
                            className={`absolute top-0 h-full ${getSegmentStyles(seg.type)}`}
                            style={{
                              left: `${(seg.start / 1440) * 100}%`,
                              width: `${((seg.end - seg.start) / 1440) * 100}%`
                            }}
                          />
                        ))}
                      </div>

                      {/* Cardlock Markers (Pointers) */}
                      {clStart !== null && (
                        <div
                          className="absolute top-[-1px] bottom-[-1px] w-0.5 bg-orange-500 z-30"
                          style={{ left: `${(clStart / 1440) * 100}%` }}
                        >
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-orange-500" />
                        </div>
                      )}
                      {clEnd !== null && (
                        <div
                          className="absolute top-[-1px] bottom-[-1px] w-0.5 bg-orange-700 z-30"
                          style={{ left: `${(clEnd / 1440) * 100}%` }}
                        >
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-orange-700" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ------------------ Legend (Matching Reference Style) ------------------ */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t mt-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-blue-500" />
              <span className="text-xs font-medium text-black">Shifts (Open - Close)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-green-500" />
              <span className="text-xs font-medium text-black">Sales (First - Last)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-0.5 shrink-0 bg-orange-500" />
              <span className="text-xs font-medium text-black">Cardlock Activity</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-red-600" />
              <span className="text-xs font-medium text-black">Zombie (Pre-Open Shifts from Previous Days)</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="text-xs text-muted-foreground">
          Visual representation of physical vs. transaction activity windows. Click on the bars for detailed timelines.
        </CardFooter>
      </Card>

      {/* Dialog remains same as before */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-bold">Timeline Audit — {formatDateSafe(selected.date, { month: 'long', day: 'numeric', year: 'numeric' })}</DialogTitle>
            </DialogHeader>
            <VerticalTimelineView day={selected} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function VerticalTimelineView({ day }: { day: Day }) {
  // 1. Define and filter events
  const events = [
    { label: "Shift Started", time: day.stationOpen, type: 'shift' },
    { label: "Shift Ended", time: day.stationClose, type: 'shift' },
    { label: "Register Sales Began", time: day.firstRegTrans, type: 'reg' },
    { label: "Register Sales Ended", time: day.lastRegTrans, type: 'reg' },
    { label: "First Cardlock Txn", time: day.firstCardlockTrans, type: 'cl' },
    { label: "Last Cardlock Txn", time: day.lastCardlockTrans, type: 'cl' }
  ]
    .filter(e => e.time)
    .sort((a, b) => new Date(a.time!).getTime() - new Date(b.time!).getTime());

  const getEventStyles = (type: string) => {
    switch (type) {
      case 'reg': return { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
      case 'cl': return { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
      default: return { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
    }
  };

  // Determine if shift details are missing
  const isMissingDetails = !day.isSubmitted || !day.stationOpen || !day.stationClose;

  return (
    <div className="relative py-4 px-2 max-h-[70vh] overflow-y-auto">
      
      {/* ⚠️ MISSING DETAILS CAUTION BANNER */}
      {isMissingDetails && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center gap-4">
          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full">
            <span className="text-xl">⚠️</span>
          </div>
          <div className="flex flex-col">
            <p className="text-amber-900 text-sm font-black uppercase tracking-tight">
              Shift Details Not Available
            </p>
            <p className="text-amber-700 text-[11px] font-bold leading-relaxed">
              Shift details missing. Kindly provide {formatDateSafe(day.date, { month: 'long', day: 'numeric', year: 'numeric' })} summaries.
            </p>
          </div>
        </div>
      )}

      {/* Central Connector Line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-1 bg-gray-100 rounded-full" />

      <div className="space-y-2">
        {events.map((e, i) => {
          const styles = getEventStyles(e.type);
          const isPrev = isPreviousDay(e.time, day.date);
          const shiftStartStr = isPrev ? formatDateSafe(new Date(e.time!).toISOString().split('T')[0], { month: 'short', day: 'numeric' }) : "";

          const nextEvent = events[i + 1];
          let gapText = "";
          if (nextEvent) {
            const diffMs = new Date(nextEvent.time!).getTime() - new Date(e.time!).getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins > 0) {
              gapText = diffMins >= 60
                ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m gap`
                : `${diffMins} min gap`;
            }
          }

          return (
            <div key={i} className="relative">
              <div className="relative flex items-center gap-4 group py-2">
                <div className={`z-10 w-5 h-5 rounded-full border-4 border-white shadow-md shrink-0 ${styles.dot} ${i === 0 ? 'ring-4 ring-blue-50' : ''}`} />

                <div className={`flex-1 flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:shadow-md ${styles.bg} ${styles.border}`}>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${styles.text}`}>
                      {e.label}
                    </span>
                    {isPrev && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-red-600 flex items-center gap-1">
                          <span className="animate-pulse text-sm leading-none">⚠️</span>
                          SHIFT ACTIVE FROM PREVIOUS DAY(S)
                        </span>
                        <span className="text-[9px] font-bold text-red-500/70 ml-4">
                          Shift opened on: {shiftStartStr} at {formatStoreTime(e.time)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-gray-900 tabular-nums tracking-tight">
                      {formatStoreTime(e.time)}
                    </div>
                  </div>
                </div>
              </div>

              {gapText && (
                <div className="ml-[19px] pl-8 py-1 border-l-2 border-dashed border-gray-200 my-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white px-2">
                    {gapText}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Existing Audit Warning Section */}
      <div className="mt-8 space-y-3">
        {day.firstRegTrans && day.stationOpen && new Date(day.firstRegTrans) < new Date(day.stationOpen) && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <p className="text-red-800 text-sm font-black uppercase tracking-tight">Sales Before Opening</p>
              <p className="text-red-600 text-xs font-medium">
                Sales were recorded at {formatStoreTime(day.firstRegTrans)} but the station was not officially open until {formatStoreTime(day.stationOpen)}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}