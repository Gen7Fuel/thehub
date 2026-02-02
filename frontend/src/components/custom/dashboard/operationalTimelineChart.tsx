import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
const MINUTES_IN_DAY = 1440;

interface OperationalTiming {
  date: string;
  stationOpen: string | null;
  stationClose: string | null;
  firstRegTrans: string | null;
  lastRegTrans: string | null;
  firstCardlockTrans: string | null;
  lastCardlockTrans: string | null;
  isSubmitted: boolean;
  chartMetrics: {
    openMin: number | null;
    closeMin: number | null;
    regStartMin: number | null;
    regEndMin: number | null;
    clStartMin: number | null;
    clEndMin: number | null;
    isZombieShift: boolean;
    isMissingClose: boolean;
    hasActivityBeforeOpen: boolean;
  };
}

function formatMinutes(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function OperationalTimelineCard({ data = [] }: { data: OperationalTiming[] }) {
  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader>
        <CardTitle>Operational Timeline (Last 7 Days)</CardTitle>
        <CardDescription>
          Shift vs Register vs Cardlock activity
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {data.length === 0 && (
          <div className="text-muted-foreground text-center py-8">
            No operational data available
          </div>
        )}

        {data.map((day) => {
          const m = day.chartMetrics;

          const shiftWidth = m.closeMin != null && m.openMin != null
            ? m.closeMin - m.openMin
            : 0;

          const regWidth = m.regEndMin != null && m.regStartMin != null
            ? m.regEndMin - m.regStartMin
            : 0;

          const clWidth = m.clEndMin != null && m.clStartMin != null
            ? m.clEndMin - m.clStartMin
            : 0;

          return (
            <div key={day.date} className="space-y-1">
              {/* Day Label */}
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{day.date}</span>
                <span>
                  Shift: {formatMinutes(m.openMin)} → {formatMinutes(m.closeMin)}
                </span>
              </div>

              {/* Timeline Track */}
              <div className="relative h-6 rounded bg-muted overflow-hidden">

                {/* Shift Bar */}
                {m.openMin != null && (
                  <div
                    className={`absolute h-full rounded ${
                      m.isMissingClose ? "border-2 border-red-500 border-dashed" :
                      m.isZombieShift ? "border-2 border-orange-400" :
                      "bg-blue-500"
                    }`}
                    style={{
                      left: `${(m.openMin / MINUTES_IN_DAY) * 100}%`,
                      width: `${(shiftWidth / MINUTES_IN_DAY) * 100}%`
                    }}
                  />
                )}

                {/* Register Activity */}
                {m.regStartMin != null && (
                  <div
                    className="absolute h-2 top-1 rounded bg-green-500 opacity-90"
                    style={{
                      left: `${(m.regStartMin / MINUTES_IN_DAY) * 100}%`,
                      width: `${(regWidth / MINUTES_IN_DAY) * 100}%`
                    }}
                  />
                )}

                {/* Cardlock Activity */}
                {m.clStartMin != null && (
                  <div
                    className="absolute h-2 bottom-1 rounded bg-purple-500 opacity-90"
                    style={{
                      left: `${(m.clStartMin / MINUTES_IN_DAY) * 100}%`,
                      width: `${(clWidth / MINUTES_IN_DAY) * 100}%`
                    }}
                  />
                )}

                {/* Activity Before Open Marker */}
                {m.hasActivityBeforeOpen && (
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-yellow-400"
                    style={{
                      left: `${(m.regStartMin || 0 / MINUTES_IN_DAY) * 100}%`
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-500 rounded" /> Shift
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded" /> Register
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-purple-500 rounded" /> Cardlock
        </span>
        <span className="flex items-center gap-1">
          ⚠️ Zombie Shift
        </span>
        <span className="flex items-center gap-1">
          ❌ Missing Close
        </span>
      </CardFooter>
    </Card>
  );
}
