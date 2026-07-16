import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { getSocket } from "@/lib/websocket";
import { useAuth } from "@/context/AuthContext";

interface FuelGradePrice {
  grade: string;
  price: string;
  updatedAt: string;
}

interface TickerStationRecord {
  stationName: string;
  site?: string;
  grades: FuelGradePrice[];
}

const DISPLAY_LABELS: Record<string, string> = {
  REG: "Regular",
  MID: "Mid Grade",
  PNL: "Premium",
  DSL: "Diesel",
  DYED: "Dyed Diesel"
};

// Strict system-wide sequencing indices 
const GRADE_SEQUENCE_ORDER = ["REG", "MID", "PNL", "DSL", "DYED"];

// Helper to reliably sanitize database values for sequencing
const getNormalizedGradeKey = (gradeStr: string): string => {
  const upper = gradeStr.toUpperCase();
  if (upper.includes("REG")) return "REG";
  if (upper.includes("MID")) return "MID";
  if (upper.includes("PNL") || upper.includes("PREM")) return "PNL";
  if (upper.includes("DYED")) return "DYED";
  if (upper.includes("DSL") || upper.includes("DIESEL")) return "DSL";
  return upper;
};

const getGradeIndicatorBorder = (gradeKey: string) => {
  switch (gradeKey) {
    case "REG": return "border-l-2 border-green-500";
    case "PNL": return "border-l-2 border-red-500";
    case "DSL": return "border-l-2 border-amber-400";
    case "DYED": return "border-l-2 border-red-800";
    default: return "border-l-2 border-slate-400";
  }
};

export default function FuelPriceTicker() {
  const [allTickerData, setAllTickerData] = useState<TickerStationRecord[]>([]);
  const { user } = useAuth();

  const fetchTickerData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/fuel-pricing/prices-ticker', {
        headers: { Authorization: `Bearer ${token || ''}` }
      });
      setAllTickerData(data || []);
    } catch (err) {
      console.error("Failed fetching pricing ticker:", err);
    }
  }, []);

  useEffect(() => {
    fetchTickerData();
    const interval = setInterval(fetchTickerData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTickerData]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("retail-price-published", () => {
      fetchTickerData();
    });
    return () => {
      socket.off("retail-price-published");
    };
  }, [fetchTickerData]);

  const permittedTickerData = useMemo(() => {
    const siteAccess = user?.access?.site_access || {};
    return allTickerData.filter((station) => siteAccess[station.site ?? station.stationName] === true);
  }, [allTickerData, user]);

  if (!permittedTickerData || permittedTickerData.length === 0) return null;

  return (
    /* 
      The layout uses a twin-track layout pattern inside an overflow-hidden wrapper.
      This allows track 1 and track 2 to seamlessly append each other with no gaps or dead loops.
    */
    <div className="w-full overflow-hidden bg-slate-50 border-b border-slate-200 py-2 relative z-25 flex">
      <div 
        className="flex w-max animate-marquee pause-on-hover select-none items-center"
        style={{ animationDuration: '75s' }} // Consistent, highly readable crawling velocity
      >
        <TickerLayoutContent data={permittedTickerData} />
        <TickerLayoutContent data={permittedTickerData} />
      </div>
    </div>
  );
}

function TickerLayoutContent({ data }: { data: TickerStationRecord[] }) {
  return (
    // Clean, streamlined flow with equal spacing padding limits
    <div className="flex items-center gap-12 px-6 shrink-0 text-slate-600">
      {data.map((station, sIdx) => {
        
        // Comprehensive Normalizing Sequence Sort Engine
        const sortedGrades = [...station.grades].sort((a, b) => {
          const keyA = getNormalizedGradeKey(a.grade);
          const keyB = getNormalizedGradeKey(b.grade);
          
          const indexA = GRADE_SEQUENCE_ORDER.indexOf(keyA);
          const indexB = GRADE_SEQUENCE_ORDER.indexOf(keyB);
          
          const posA = indexA === -1 ? 99 : indexA;
          const posB = indexB === -1 ? 99 : indexB;
          return posA - posB;
        });

        return (
          <div key={`${station.site ?? station.stationName}-${sIdx}`} className="flex items-center gap-5">

            {/* Professional Station Identity Tag */}
            <div className="flex items-center gap-1 text-xs font-bold text-slate-800 tracking-tight shrink-0">
              <span className="text-slate-400 text-xs">🏢</span>
              <span className="uppercase font-mono tracking-wide">{station.site ?? station.stationName}</span>
            </div>
            
            {/* Sequential Pricing Streams */}
            <div className="flex items-center gap-4 border-l border-slate-200/80 pl-4">
              {sortedGrades.map((item, gIdx) => {
                const normalizedKey = getNormalizedGradeKey(item.grade);
                const parsedLabel = DISPLAY_LABELS[normalizedKey] || item.grade;
                const isMid = normalizedKey === 'MID';
                
                return (
                  <div 
                    key={`${item.grade}-${gIdx}`} 
                    className="flex items-center text-xs py-0.5 shrink-0"
                    style={{
                      borderLeft: isMid ? '2px solid transparent' : undefined,
                      borderImage: isMid ? 'linear-gradient(to bottom, #22c55e, #ef4444) 1' : undefined
                    }}
                  >
                    <div className={`flex items-center gap-1.5 pl-1.5 ${isMid ? '' : getGradeIndicatorBorder(normalizedKey)}`}>
                      <span className="font-medium text-slate-400">{parsedLabel}</span>
                      <span className="font-mono font-bold text-slate-900 text-[13px]">
                        ${Number(item.price).toFixed(3)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Splitter Icon node */}
            <span className="text-slate-300 select-none text-xs font-light">•</span>
          </div>
        );
      })}
    </div>
  );
}