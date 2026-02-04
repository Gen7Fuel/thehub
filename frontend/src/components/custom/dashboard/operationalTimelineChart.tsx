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
  firstShiftLogin?: string | null;
  lastShiftLogout?: string | null;
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

// function buildSegments(day: Day) {
//   const baseDate = day.date;

//   const m = {
//     open: minutesSinceMidnight(day.stationOpen),
//     close: minutesSinceMidnight(day.stationClose),
//     regS: minutesSinceMidnight(day.firstRegTrans),
//     regE: minutesSinceMidnight(day.lastRegTrans),
//     isZombie: isPreviousDay(day.stationOpen, baseDate)
//   };

//   const points = new Set<number>([0, 1440]);
//   [m.open, m.close, m.regS, m.regE].forEach(v => {
//     if (v !== null) points.add(Math.max(0, Math.min(1440, v)));
//   });

//   const sorted = [...points].sort((a, b) => a - b);
//   const segments: { start: number; end: number; type: string }[] = [];

//   for (let i = 0; i < sorted.length - 1; i++) {
//     const s = sorted[i];
//     const e = sorted[i + 1];
//     const mid = (s + e) / 2;
//     let type = "idle";

//     if (m.regS !== null && m.regE !== null && mid >= m.regS && mid <= m.regE) {
//       type = "register";
//     }
//     else if (m.open !== null && m.close !== null && mid >= m.open && mid <= m.close) {
//       type = "shift";
//     }
//     else if (m.isZombie && m.open !== null && mid < m.open) {
//       type = "shift-prev";
//     }

//     if (type !== "idle") {
//       segments.push({ start: s, end: e, type });
//     }
//   }
//   return segments;
// }
function isNextDay(dateStr: string | Date | null, baseDate: string) {
  if (!dateStr) return false;
  // baseDate is 'YYYY-MM-DD', so we compare ISO strings
  const dDate = new Date(dateStr).toISOString().split('T')[0];
  return dDate > baseDate;
}
function buildSegments(day: Day) {
  const baseDate = day.date;

  // Detect overflow status
  const startsBefore = isPreviousDay(day.stationOpen, baseDate);
  const endsAfter = isNextDay(day.stationClose || '', baseDate);

  const m = {
    // CLAMPING: If it starts before today, the 'open' for THIS bar is 0 (midnight)
    open: startsBefore ? 0 : minutesSinceMidnight(day.stationOpen),
    // CLAMPING: If it ends after today, the 'close' for THIS bar is 1440 (midnight)
    close: endsAfter ? 1440 : minutesSinceMidnight(day.stationClose),
    regS: minutesSinceMidnight(day.firstRegTrans),
    regE: minutesSinceMidnight(day.lastRegTrans),
  };

  const points = new Set<number>([0, 1440]);
  // Add points only if they fall within today's 0-1440 range
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

    // 1. REGISTER SALES (Priority: Green)
    if (m.regS !== null && m.regE !== null && mid >= m.regS && mid <= m.regE) {
      type = "register";
    } 
    // 2. SHIFT ACTIVITY
    else if (m.open !== null && m.close !== null && mid >= m.open && mid <= m.close) {
      // Determine if this specific segment is a "Ghost" period
      // It's a ghost if:
      // (It's before sales and shift started yesterday) OR 
      // (It's after sales and shift ends tomorrow)
      const isMorningGhost = startsBefore && (m.regS === null || mid < m.regS);
      const isEveningGhost = endsAfter && (m.regE === null || mid > m.regE);

      if (isMorningGhost || isEveningGhost) {
        type = "shift-prev"; // Red
      } else {
        type = "shift"; // Blue
      }
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
    case "register": return `${base} bg-green-400`;
    case "cardlock": return `${base} bg-gray-500`;
    case "shift-prev": return `${base} bg-red-300`;
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
                // const clStart = minutesSinceMidnight(row.firstCardlockTrans);
                // const clEnd = minutesSinceMidnight(row.lastCardlockTrans);
                const firstShift = minutesSinceMidnight(row.firstShiftLogin);
                const lastShift = minutesSinceMidnight(row.lastShiftLogout);

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
                      {/* {clStart !== null && (
                        <div
                          className="absolute top-[-1px] bottom-[-1px] w-0.5 bg-gray-700 z-30"
                          style={{ left: `${(clStart / 1440) * 100}%` }}
                        >
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-gray-700" />
                        </div>
                      )}
                      {clEnd !== null && (
                        <div
                          className="absolute top-[-1px] bottom-[-1px] w-0.5 bg-gray-700 z-30"
                          style={{ left: `${(clEnd / 1440) * 100}%` }}
                        >
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-gray-700" />
                        </div>
                      )} */}

                      {/* First and Last Shift Markers (Pointers) */}
                      {firstShift !== null && (
                        <div
                          className="absolute top-[-1px] bottom-[-1px] w-0.75 bg-purple-500 z-30"
                          style={{ left: `${(firstShift / 1440) * 100}%` }}
                        >
                          {/* <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-purple-700" /> */}
                        </div>
                      )}
                      {lastShift !== null && (
                        <div
                          className="absolute top-[-1px] bottom-[-1px] w-0.75 bg-purple-500 z-30"
                          style={{ left: `${(lastShift / 1440) * 100}%` }}
                        >
                          {/* <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[4px] border-b-purple-700" /> */}
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
              <div className="h-3 w-1 shrink-0 bg-purple-500" />
              <span className="text-xs font-medium text-black">Employee Activity (Not Includes Managers)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-red-300" />
              <span className="text-xs font-medium text-black">Zombie (Pre-Open Shifts from Previous Days/Post-Close Shifts on Next Day)</span>
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
  const events = [
    { label: "First Shift Started", time: day.stationOpen, type: 'shift' },
    { label: "Last Shift Ended", time: day.stationClose, type: 'shift' },
    { label: "Register Sales Began", time: day.firstRegTrans, type: 'reg' },
    { label: "Register Sales Ended", time: day.lastRegTrans, type: 'reg' },
    { label: "First Cardlock Txn", time: day.firstCardlockTrans, type: 'cl' },
    { label: "Last Cardlock Txn", time: day.lastCardlockTrans, type: 'cl' },
    { label: "First Employee Login", time: day.firstShiftLogin, type: 'el' },
    { label: "Last Employee Logout", time: day.lastShiftLogout, type: 'el' }
  ]
    .filter(e => e.time)
    .sort((a, b) => new Date(a.time!).getTime() - new Date(b.time!).getTime());

  const getEventStyles = (type: string) => {
    switch (type) {
      case 'reg': return { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
      case 'cl': return { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
      case 'el': return { dot: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" };
      default: return { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
    }
  };

  const isMissingDetails = !day.isSubmitted || !day.stationOpen || !day.stationClose;

  return (
    <div className="relative py-4 px-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
      {/* Missing Details Banner */}
      {isMissingDetails && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center gap-4">
          <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full">
            <span className="text-xl">⚠️</span>
          </div>
          <div className="flex flex-col">
            <p className="text-amber-900 text-sm font-black uppercase tracking-tight">Shift Details Not Available</p>
            <p className="text-amber-700 text-[11px] font-bold leading-relaxed">
              Kindly provide {formatDateSafe(day.date, { month: 'long', day: 'numeric', year: 'numeric' })} summaries.
            </p>
          </div>
        </div>
      )}

      {/* Central Connector Line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-1 bg-gray-100 rounded-full" />

      <div className="space-y-1">
        {events.map((e, i) => {
          const styles = getEventStyles(e.type);
          const isPrev = isPreviousDay(e.time, day.date);
          const isPost = isNextDay(e.time || '', day.date);
          
          const eventDateStr = formatDateSafe(new Date(e.time!).toISOString().split('T')[0], { month: 'short', day: 'numeric' });

          // Gap & Date Change Logic
          const nextEvent = events[i + 1];
          let gapText = "";
          let isDateFlip = false;

          if (nextEvent) {
            const currD = new Date(e.time!).getUTCDate();
            const nextD = new Date(nextEvent.time!).getUTCDate();
            isDateFlip = currD !== nextD;

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
              {/* Event Card */}
              <div className="relative flex items-center gap-4 group py-2">
                <div className={`z-10 w-5 h-5 rounded-full border-4 border-white shadow-md shrink-0 ${styles.dot}`} />

                <div className={`flex-1 flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:shadow-md ${styles.bg} ${styles.border}`}>
                  <div className="flex flex-col">
                    <span className={`text-[11px] font-black uppercase tracking-widest ${styles.text}`}>
                      {e.label}
                    </span>
                    
                    {/* Previous Day Warning */}
                    {isPrev && !isPost && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-red-600 flex items-center gap-1">
                          <span className="animate-pulse text-sm">⚠️</span> SHIFT STARTED PREVIOUS DAY(S)
                        </span>
                        <span className="text-[9px] font-bold text-red-500/70 ml-4">Shift opened on: {eventDateStr} at {formatStoreTime(e.time)}</span>
                      </div>
                    )}

                    {/* Next Day Warning (NEW) */}
                    {isPost && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-[10px] font-black text-orange-600 flex items-center gap-1">
                          <span className="text-sm">🌙</span> SHIFT ENDED ON NEXT DAY(S)
                        </span>
                        <span className="text-[9px] font-bold text-orange-500/70 ml-4">Shift ended on: {eventDateStr} at {formatStoreTime(e.time)}</span>
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

              {/* Enhanced Gap / Date Change Divider */}
              {nextEvent && (
                <div className={`ml-[19px] pl-8 py-2 border-l-2 border-dashed ${isDateFlip ? 'border-blue-300 my-4 py-6' : 'border-gray-200 my-1'}`}>
                  <div className="flex items-center gap-2">
                    {isDateFlip && <span className="text-lg">📅</span>}
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${isDateFlip ? 'bg-blue-600 text-white' : 'bg-white text-gray-400'}`}>
                      {isDateFlip ? `DATE CHANGE • ${gapText}` : gapText}
                    </span>
                  </div>
                  {isDateFlip && (
                    <p className="text-[9px] font-bold text-blue-400 mt-1 uppercase tracking-tighter">
                      Clock rolled over to {formatDateSafe(new Date(nextEvent.time!).toISOString().split('T')[0], { month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Audit Warning Section */}
      <div className="mt-8 space-y-3">
        {day.firstRegTrans && day.stationOpen && new Date(day.firstRegTrans) < new Date(day.stationOpen) && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
            <span className="text-xl">🚨</span>
            <div>
              <p className="text-red-800 text-sm font-black uppercase tracking-tight">Sales Before Opening</p>
              <p className="text-red-600 text-xs font-medium">
                Sales recorded at {formatStoreTime(day.firstRegTrans)} but station opened at {formatStoreTime(day.stationOpen)}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// function VerticalTimelineView({ day }: { day: Day }) {
//   // 1. Define and filter events
//   const events = [
//     { label: "First Shift Started", time: day.stationOpen, type: 'shift' },
//     { label: "Last Shift Ended", time: day.stationClose, type: 'shift' },
//     { label: "Register Sales Began", time: day.firstRegTrans, type: 'reg' },
//     { label: "Register Sales Ended", time: day.lastRegTrans, type: 'reg' },
//     { label: "First Cardlock Txn", time: day.firstCardlockTrans, type: 'cl' },
//     { label: "Last Cardlock Txn", time: day.lastCardlockTrans, type: 'cl' },
//     { label: "First Employee Login", time: day.firstShiftLogin, type: 'el' },
//     { label: "Last Employee Logout", time: day.lastShiftLogout, type: 'el' }
//   ]
//     .filter(e => e.time)
//     .sort((a, b) => new Date(a.time!).getTime() - new Date(b.time!).getTime());

//   const getEventStyles = (type: string) => {
//     switch (type) {
//       case 'reg': return { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" };
//       case 'cl': return { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200" };
//       case 'el': return { dot: "bg-purple-500", text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" };
//       default: return { dot: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" };
//     }
//   };

//   // Determine if shift details are missing
//   const isMissingDetails = !day.isSubmitted || !day.stationOpen || !day.stationClose;

//   return (
//     <div className="relative py-4 px-2 max-h-[70vh] overflow-y-auto">
      
//       {/* ⚠️ MISSING DETAILS CAUTION BANNER */}
//       {isMissingDetails && (
//         <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center gap-4">
//           <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-amber-100 rounded-full">
//             <span className="text-xl">⚠️</span>
//           </div>
//           <div className="flex flex-col">
//             <p className="text-amber-900 text-sm font-black uppercase tracking-tight">
//               Shift Details Not Available
//             </p>
//             <p className="text-amber-700 text-[11px] font-bold leading-relaxed">
//               Shift details missing. Kindly provide {formatDateSafe(day.date, { month: 'long', day: 'numeric', year: 'numeric' })} summaries.
//             </p>
//           </div>
//         </div>
//       )}

//       {/* Central Connector Line */}
//       <div className="absolute left-[19px] top-0 bottom-0 w-1 bg-gray-100 rounded-full" />

//       <div className="space-y-2">
//         {events.map((e, i) => {
//           const styles = getEventStyles(e.type);
//           const isPrev = isPreviousDay(e.time, day.date);
//           const shiftStartStr = isPrev ? formatDateSafe(new Date(e.time!).toISOString().split('T')[0], { month: 'short', day: 'numeric' }) : "";

//           const nextEvent = events[i + 1];
//           let gapText = "";
//           if (nextEvent) {
//             const diffMs = new Date(nextEvent.time!).getTime() - new Date(e.time!).getTime();
//             const diffMins = Math.floor(diffMs / 60000);
//             if (diffMins > 0) {
//               gapText = diffMins >= 60
//                 ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m gap`
//                 : `${diffMins} min gap`;
//             }
//           }

//           return (
//             <div key={i} className="relative">
//               <div className="relative flex items-center gap-4 group py-2">
//                 <div className={`z-10 w-5 h-5 rounded-full border-4 border-white shadow-md shrink-0 ${styles.dot} ${i === 0 ? 'ring-4 ring-blue-50' : ''}`} />

//                 <div className={`flex-1 flex items-center justify-between p-4 rounded-xl border-2 transition-all hover:shadow-md ${styles.bg} ${styles.border}`}>
//                   <div className="flex flex-col">
//                     <span className={`text-[11px] font-black uppercase tracking-widest ${styles.text}`}>
//                       {e.label}
//                     </span>
//                     {isPrev && (
//                       <div className="mt-1 flex flex-col gap-0.5">
//                         <span className="text-[10px] font-black text-red-600 flex items-center gap-1">
//                           <span className="animate-pulse text-sm leading-none">⚠️</span>
//                           SHIFT ACTIVE FROM PREVIOUS DAY(S)
//                         </span>
//                         <span className="text-[9px] font-bold text-red-500/70 ml-4">
//                           Shift opened on: {shiftStartStr} at {formatStoreTime(e.time)}
//                         </span>
//                       </div>
//                     )}
//                   </div>

//                   <div className="text-right">
//                     <div className="text-xl font-black text-gray-900 tabular-nums tracking-tight">
//                       {formatStoreTime(e.time)}
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {gapText && (
//                 <div className="ml-[19px] pl-8 py-1 border-l-2 border-dashed border-gray-200 my-1">
//                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white px-2">
//                     {gapText}
//                   </span>
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>

//       {/* Existing Audit Warning Section */}
//       <div className="mt-8 space-y-3">
//         {day.firstRegTrans && day.stationOpen && new Date(day.firstRegTrans) < new Date(day.stationOpen) && (
//           <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
//             <span className="text-xl">🚨</span>
//             <div>
//               <p className="text-red-800 text-sm font-black uppercase tracking-tight">Sales Before Opening</p>
//               <p className="text-red-600 text-xs font-medium">
//                 Sales were recorded at {formatStoreTime(day.firstRegTrans)} but the station was not officially open until {formatStoreTime(day.stationOpen)}.
//               </p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }