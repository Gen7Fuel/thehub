import { useState, useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useSite } from "@/context/SiteContext";
import FuelPricingContext from "@/context/FuelPricingContext";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Car,
  Zap,
  Truck,
  Fuel,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/_navbarLayout/fuel-pricing")({
  component: FuelPricingDashboard,
});

const GRADES = [
  { id: "REG", label: "Regular", lookup: "Regular" },
  { id: "DSL", label: "Diesel", lookup: "Diesel" },
  { id: "PNL", label: "Premium", lookup: "Premium" },
  { id: "DYED", label: "Dyed Diesel", lookup: "Dyed Diesel" },
];

export const getGradeTheme = (grade: string) => {
  switch (grade) {
    case "Regular":
      return {
        color: "bg-green-500",
        label: "text-green-700",
        border: "border-green-500",
        icon: Car,
        light: "bg-green-50/50",
      };
    case "Premium":
      return {
        color: "bg-red-500",
        label: "text-red-700",
        border: "border-red-500",
        icon: Zap,
        light: "bg-red-50/50",
      };
    case "Diesel":
      return {
        color: "bg-amber-400",
        label: "text-amber-700",
        border: "border-amber-400",
        icon: Truck,
        light: "bg-amber-50/50",
      };
    case "Dyed Diesel":
      return {
        color: "bg-red-800",
        label: "text-red-950",
        border: "border-red-800",
        icon: Truck,
        light: "bg-red-50/30",
      };
    default:
      return {
        color: "bg-slate-600",
        label: "text-slate-700",
        border: "border-slate-600",
        icon: Car,
        light: "bg-slate-50",
      };
  }
};

// const suggestedPriceDefinitions = [
//   { label: "MBP Margin", description: "Target base margin applied directly over the landed costs to get the Suggested Price." },
//   { label: "Low Indexed Price", description: "Calculated using today's market low threshold adjusted down by $0.01." },
//   { label: "LIP Margin", description: "The explicit margin yielded when evaluating LIP positioning against true landed costs." }
// ];

const marketPriceDefinitions = [
  {
    label: "Market Price",
    description:
      "Current daily benchmark price evaluated across regional providers.",
  },
  {
    label: "Variance Badge",
    description: "Net movement versus yesterday's locked market calculations.",
  },
];

function FuelPricingDashboard() {
  const [selectedCso, setSelectedCso] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("REG");

  const { setSelectedSite } = useSite();

  const authHeader = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "X-Required-Permission": "fuelPricing",
    },
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fuel-pricing-matrix"],
    queryFn: async () => {
      const localSystemDate = new Date();
      const yyyy = localSystemDate.getFullYear();
      const mm = String(localSystemDate.getMonth() + 1).padStart(2, "0");
      const dd = String(localSystemDate.getDate()).padStart(2, "0");
      const systemDateSK = `${yyyy}${mm}${dd}`;

      const res = await axios.get(
        `/api/fuel-pricing?date=${systemDateSK}`,
        authHeader,
      );
      return res.data;
    },
  });

  const stations = (data?.stations || [])
  // .filter(
  //   (station: any) => station.stationName !== "Test Lab",
  // );
  const pricingData = data?.pricingData || {};

  // 3. Keep site context perfectly synchronized on initial render
  useEffect(() => {
    if (stations.length > 0 && !selectedCso) {
      setSelectedCso(stations[0].csoCode);
      setSelectedSite(stations[0].stationName); // Set initial global site matching the selected CSO
    }
  }, [stations, selectedCso, setSelectedSite]);

  const currentStationData = pricingData[selectedCso] || {};
  const recommendedPrices = Object.entries(currentStationData).reduce(
    (acc: Record<string, number>, [gradeId, gradeData]: any) => {
      acc[gradeId] = gradeData?.metrics?.recPrice ?? 0;
      return acc;
    },
    {},
  );
  const activeGradesAtStation = Object.keys(currentStationData);
  const currentGradeData = currentStationData[selectedGrade];

  if (isLoading) {
    return (
      <div className="p-8 text-center font-medium text-slate-500 animate-pulse">
        Loading Pricing Context Grid...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center font-medium text-rose-500">
        Failed to load the fuel pricing asset matrix.
      </div>
    );
  }

  return (
    // 1. PLACE PROVIDER AROUND EVERYTHING AT THE ROOT RETURN
    <FuelPricingContext.Provider value={{ selectedCso, recommendedPrices }}>
      <div
        className="grid h-full w-full bg-[#f8fafc] overflow-hidden"
        style={{ gridTemplateColumns: "minmax(0, 1fr) 380px" }}
      >
        <div className="min-w-0 p-6 border-r border-slate-200 flex flex-col space-y-5 overflow-hidden">
          {/* TOP: HORIZONTAL GRADE SELECTOR ROW */}
          <div className="grid grid-cols-4 gap-4 w-full">
            {GRADES.map((grade) => {
              const isAvailable = activeGradesAtStation.includes(grade.id);
              const isSelected = selectedGrade === grade.id;
              const theme = getGradeTheme(grade.lookup);
              const IconComponent = theme.icon;

              return (
                <button
                  key={grade.id}
                  onClick={() => isAvailable && setSelectedGrade(grade.id)}
                  disabled={!isAvailable}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start justify-between relative overflow-hidden ${
                    isSelected
                      ? `${theme.color} text-white border-transparent shadow-md transform scale-[1.01]`
                      : isAvailable
                        ? "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                        : "bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed text-slate-400"
                  }`}
                >
                  <div className="z-10">
                    <div
                      className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-white/80" : "text-slate-400"}`}
                    >
                      Grade Configuration
                    </div>
                    <div className="text-xl font-black mt-0.5">
                      {grade.label}
                    </div>
                    <div
                      className={`text-[10px] mt-2 font-semibold tracking-wide ${isSelected ? "text-white/90" : theme.label}`}
                    >
                      {isAvailable ? "● Grade Available" : "✕ Not Available"}
                    </div>
                  </div>
                  <IconComponent
                    className={`w-8 h-8 shrink-0 mt-1 opacity-25 ${isSelected ? "text-white" : theme.label}`}
                  />
                </button>
              );
            })}
          </div>

          {/* WORKSPACE AREA */}
          <div className="flex flex-row items-start space-x-4 w-full min-w-0 overflow-hidden text-slate-700">
            {/* LEFT COMPONENT: STATION LIST */}
            <div className="w-[280px] shrink-0 flex flex-col gap-2 max-h-[82vh] overflow-y-auto pr-1 scrollbar-thin">
              <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest pl-1 pb-1 border-b border-slate-100">
                Station Locations
              </div>
              {stations.map((station: any) => {
                const isSelected = selectedCso === station.csoCode;
                return (
                  <button
                    key={station.csoCode}
                    onClick={() => {
                      setSelectedCso(station.csoCode);
                      setSelectedSite(station.stationName); // 4. Update global site context when clicked
                      const targetStationData =
                        pricingData[station.csoCode] || {};
                      const available = Object.keys(targetStationData);
                      if (
                        available.length > 0 &&
                        !available.includes(selectedGrade)
                      ) {
                        setSelectedGrade(available[0]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col space-y-1 relative group ${
                      isSelected
                        ? "bg-slate-900 border-slate-900 text-white shadow-md"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-black uppercase tracking-wide line-clamp-1 flex-1">
                        {station.stationName}
                      </span>
                      <div
                        className={`p-1 rounded-md ${isSelected ? "bg-slate-800 text-sky-400" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500"}`}
                      >
                        <Fuel className="w-3.5 h-3.5 shrink-0" />
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-medium leading-normal ${isSelected ? "text-slate-300" : "text-slate-400"}`}
                    >
                      {station.address || "No location configured"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* RIGHT COMPONENT: DATA CARDS & TABLES */}
            <div className="flex-1 min-w-0 overflow-visible">
              {!currentGradeData ? (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="flex flex-col items-center justify-center p-8 text-center text-amber-800">
                    <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
                    <p className="font-bold uppercase tracking-wider text-xs mb-1">
                      Grade Context Warning
                    </p>
                    <p className="text-[11px] max-w-md text-amber-700 leading-relaxed">
                      Kindly change the grade to view data. This specific fuel
                      grade configuration is not available for this individual
                      station interface.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4 w-full overflow-visible">
                  {/* HORIZONTAL SECTIONS: COMPACT 3x2 METRIC CARDS GRID */}
                  <div className="grid grid-cols-3 gap-3 items-start w-full overflow-visible relative">
                    {/* ================= ROW 1: FUEL SPECS ================= */}
                    <h2 className="col-span-3 text-[13px] font-bold tracking-widest text-slate-400 uppercase pl-0.5 mt-2 flex items-center justify-between">
                      <span>Fuel Specs</span>
                      <span className="text-[11px] font-medium text-slate-400/80 normal-case tracking-normal pr-1">
                        (
                        {getHoursSinceLastFeedUpdate(
                          currentGradeData?.updatedAt,
                        )}
                        )
                      </span>
                    </h2>
                    <MetricCard
                      title="Rack Price"
                      current={currentGradeData.metrics.rackPrice}
                      yesterday={currentGradeData.metrics.prevRackPrice}
                      variant="rack"
                      tooltipContent={marketPriceDefinitions}
                    />
                    <MetricCard
                      title="Landed Cost"
                      current={currentGradeData.metrics.landedCost}
                      yesterday={currentGradeData.metrics.prevLandedCost}
                      variant="landed"
                      tooltipContent={marketPriceDefinitions}
                    />
                    <MetricCard
                      title="Suggested Price"
                      current={currentGradeData.metrics.recPrice}
                      yesterday={currentGradeData.metrics.recPrice}
                      isSuggested
                      selectedGrade={selectedGrade}
                      lowMarketPrice={currentGradeData.metrics.low}
                      landedCost={currentGradeData.metrics.landedCost}
                      priceExplanation={
                        currentGradeData.metrics.priceExplanation
                      } // <--- Pass the backend text here
                    />

                    {/* ================= ROW 2: LOCAL MARKET PRICES ================= */}
                    <h2 className="col-span-3 text-[13px] font-bold tracking-widest text-slate-400 uppercase pl-0.5 flex items-center justify-between">
                      <span>Local Market Price</span>
                      <span className="text-[11px] font-medium text-slate-400/80 normal-case tracking-normal pr-1">
                        (
                        {getHoursSinceLastFeedUpdate(
                          currentGradeData?.updatedAt,
                        )}
                        )
                      </span>
                    </h2>

                    <MetricCard
                      title="Low Price"
                      current={currentGradeData.metrics.low}
                      yesterday={currentGradeData.metrics.prevLow}
                      variant="market"
                      tooltipContent={marketPriceDefinitions}
                    />
                    <MetricCard
                      title="Average Price"
                      current={currentGradeData.metrics.avg}
                      yesterday={currentGradeData.metrics.prevAvg}
                      variant="market"
                      tooltipContent={marketPriceDefinitions}
                    />
                    <MetricCard
                      title="High Price"
                      current={currentGradeData.metrics.high}
                      yesterday={currentGradeData.metrics.prevHigh}
                      variant="market"
                      tooltipContent={marketPriceDefinitions}
                    />
                  </div>

                  {/* COMPETITOR TABLES FRAME */}
                  <div className="space-y-1.5 w-full">
                    <h2 className="text-[13px] font-bold tracking-widest text-slate-400 uppercase pl-0.5">
                      Competitor Pricing
                    </h2>
                    <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm w-full">
                      <div>
                        <h4 className="text-[11px] font-extrabold text-sky-700 tracking-wider uppercase mb-1 pl-0.5">
                          Reserve Area
                        </h4>
                        <CompetitorTable
                          data={currentGradeData.competitors.filter(
                            (c: any) => c.type === "Reserve Area",
                          )}
                        />
                      </div>

                      <div className="border-t border-slate-100 pt-2">
                        <h4 className="text-[11px] font-extrabold text-indigo-700 tracking-wider uppercase mb-1 pl-0.5">
                          City Area
                        </h4>
                        <CompetitorTable
                          data={currentGradeData.competitors.filter(
                            (c: any) => c.type === "City Area",
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: OUTLET VIEW */}
        <aside className="w-[380px] min-w-0 border-l border-slate-200 bg-slate-50/50 overflow-y-auto">
          <Outlet />
        </aside>
      </div>
    </FuelPricingContext.Provider>
  );
}

// interface TooltipItem {
//   label: string;
//   description: string;
// }

// function MetricCard({
//   title,
//   current,
//   yesterday,
//   isSuggested,
//   lowMarketPrice,
//   landedCost,
//   selectedGrade,
//   variant,
//   tooltipContent
// }: {
//   title: string;
//   current: number;
//   yesterday: number;
//   isSuggested?: boolean;
//   lowMarketPrice?: number;
//   landedCost?: number;
//   rackPrice?: number;
//   selectedGrade?: string;
//   variant?: 'landed' | 'rack' | 'market';
//   tooltipContent?: TooltipItem[];
// }) {
//   const currentVal = current || 0
//   const yesterdayVal = yesterday || 0
//   const variance = currentVal - yesterdayVal

//   let colorClasses = "border-slate-200 bg-white"
//   if (variant === 'market') colorClasses = "border-amber-200 border-l-[5px] border-l-amber-500 bg-white"
//   if (variant === 'landed') colorClasses = "border-indigo-200 border-l-[5px] border-l-indigo-500 bg-white"
//   if (variant === 'rack') colorClasses = "border-violet-200 border-l-[5px] border-l-violet-500 bg-white"

//   // CHANGED: Tooltip flips downwards (top-full mt-2) to completely side-step stacking conflicts with the upper rows.
//   const renderTooltip = () => {
//     if (!tooltipContent || tooltipContent.length === 0) return null;
//     return (
//       <div className="relative group ml-1.5 inline-block overflow-visible">
//         <HelpCircle size={13} className="text-slate-400 hover:text-slate-600 cursor-help transition-colors" />
//         <div className="absolute top-full left-1/2 -translate-x-1/4 mt-2 hidden group-hover:block w-64 bg-slate-900 text-white rounded-lg p-2.5 shadow-xl z-[9999] pointer-events-none text-left">
//           <div className="space-y-2">
//             {tooltipContent.map((item, idx) => (
//               <div key={idx} className="text-[10px] leading-relaxed">
//                 <span className="font-bold text-cyan-400 block">{item.label}</span>
//                 <span className="text-slate-300">{item.description}</span>
//               </div>
//             ))}
//           </div>
//           <div className="absolute bottom-full left-1/4 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
//         </div>
//       </div>
//     );
//   };

//   if (isSuggested) {
//     const hasMarketPrice = lowMarketPrice && lowMarketPrice !== 0;
//     const calculatedSuggestedPrice = hasMarketPrice ? (lowMarketPrice - 0.01) : 0
//     const impliedMargin = hasMarketPrice
//       ? ((calculatedSuggestedPrice - (landedCost || 0)) / (landedCost || 1)) * 100
//       : 0

//     const gradeLookup = GRADES.find(g => g.id === selectedGrade)?.lookup || 'Regular'
//     const gradeTheme = getGradeTheme(gradeLookup)

//     return (
//       <Card
//         className={`
//           shadow-none
//           border
//           border-l-[5px]
//           transition-all duration-300
//           min-h-[92px]
//           h-[110px]
//           overflow-visible
//           ${gradeTheme.border}
//           ${gradeTheme.light}
//         `}
//       >
//         <CardContent className="h-full pt-2.5 pb-2.5 px-3 flex flex-col justify-between bg-transparent space-y-0 overflow-visible">

//           <div className="flex items-center justify-between w-full overflow-visible">
//             <div className="flex items-center overflow-visible">
//               <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">
//                 {title}
//               </span>
//               {renderTooltip()}
//             </div>

//             <div className="text-right text-[11px] font-medium text-slate-600">
//               Low Indexed Price:{' '}
//               <span className="font-bold text-slate-800">
//                 {hasMarketPrice ? `$${calculatedSuggestedPrice.toFixed(4)}` : '-'}
//               </span>
//             </div>
//           </div>

//           <div className="flex items-center justify-between w-full self-end">
//             <div className="flex items-center space-x-2">
//               {currentVal === 0 ? (
//                 <span className="text-xs font-bold text-slate-400 italic">No price data yet</span>
//               ) : (
//                 <span className="text-lg font-black text-slate-900 tracking-tight">
//                   ${currentVal.toFixed(4)}
//                 </span>
//               )}

//               <span className="text-[11px] font-bold text-violet-700 bg-violet-100 border border-violet-200/60 px-1.5 py-0.5 rounded whitespace-nowrap">
//                 12% MBP Margin
//               </span>
//             </div>

//             <div className="text-right">
//               <span className="text-[11px] font-black text-cyan-800 bg-cyan-100/80 border border-cyan-200/60 px-1.5 py-0.5 rounded shadow-2xs">
//                 LIP Margin: {hasMarketPrice ? `${impliedMargin.toFixed(2)}%` : '-'}
//               </span>
//             </div>
//           </div>

//         </CardContent>
//       </Card>
//     )
//   }

//   return (
//     <Card className={`shadow-none border overflow-visible ${colorClasses}`}>
//       <CardContent className="pt-1.5 pb-2.5 px-3 flex items-center justify-between w-full overflow-visible">
//         <div className="space-y-0.5 overflow-visible">
//           <div className="flex items-center overflow-visible">
//             <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">{title}</div>
//             {renderTooltip()}
//           </div>
//           {currentVal === 0 ? (
//             <div className="text-xs font-bold text-slate-400 italic mt-1">No price data yet</div>
//           ) : (
//             <div className="text-lg font-black text-slate-900 tracking-tight">${currentVal.toFixed(4)}</div>
//           )}
//         </div>

//         <div className="text-right flex flex-col items-end justify-center space-y-0.5">
//           {currentVal === 0 ? (
//             <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded italic">
//               Price not updated
//             </span>
//           ) : variance !== 0 ? (
//             <span className={`text-[10px] font-bold flex items-center px-1.5 py-0.5 rounded ${variance > 0 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
//               {variance > 0 ? <ArrowUpRight size={12} className="mr-0.5" /> : <ArrowDownRight size={12} className="mr-0.5" />}
//               ${Math.abs(variance).toFixed(4)}
//             </span>
//           ) : (
//             <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/40">
//               Same as Yesterday
//             </span>
//           )}
//           <div className="text-[13px] font-medium text-slate-400">
//             Yesterday: <span className="font-semibold text-slate-600">${yesterdayVal.toFixed(4)}</span>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   )
// }
interface TooltipItem {
  label: string;
  description: string;
}

function MetricCard({
  title,
  current,
  yesterday,
  isSuggested,
  lowMarketPrice,
  landedCost,
  selectedGrade,
  variant,
  tooltipContent,
  priceExplanation, // <--- Added here
}: {
  title: string;
  current: number;
  yesterday: number;
  isSuggested?: boolean;
  lowMarketPrice?: number;
  landedCost?: number;
  rackPrice?: number;
  selectedGrade?: string;
  variant?: "landed" | "rack" | "market";
  tooltipContent?: TooltipItem[];
  priceExplanation?: string; // <--- Added here
}) {
  const currentVal = current || 0;
  const yesterdayVal = yesterday || 0;
  const variance = currentVal - yesterdayVal;

  let colorClasses = "border-slate-200 bg-white";
  if (variant === "market")
    colorClasses =
      "border-amber-200 border-l-[5px] border-l-amber-500 bg-white";
  if (variant === "landed")
    colorClasses =
      "border-indigo-200 border-l-[5px] border-l-indigo-500 bg-white";
  if (variant === "rack")
    colorClasses =
      "border-violet-200 border-l-[5px] border-l-violet-500 bg-white";

  // CHANGED: Clean, elegant light-gray tooltip design
  const renderTooltip = (itemsToRender: TooltipItem[]) => {
    if (!itemsToRender || itemsToRender.length === 0) return null;
    return (
      <div className="relative group ml-1.5 inline-block overflow-visible">
        <HelpCircle
          size={13}
          className="text-slate-400 hover:text-slate-600 cursor-help transition-colors"
        />
        <div className="absolute top-full left-1/2 -translate-x-1/4 mt-2 hidden group-hover:block w-64 bg-white border border-slate-200 text-slate-700 rounded-lg p-2.5 shadow-xl z-[9999] pointer-events-none text-left">
          <div className="space-y-2">
            {itemsToRender.map((item, idx) => (
              <div key={idx} className="text-[10px] leading-relaxed">
                <span className="font-bold text-slate-900 block">
                  {item.label}
                </span>
                <span className="text-slate-500">{item.description}</span>
              </div>
            ))}
          </div>
          {/* Light-gray triangle pointer */}
          <div className="absolute bottom-full left-1/4 -translate-x-1/2 border-4 border-transparent border-b-white" />
          <div className="absolute bottom-full left-1/4 -translate-x-1/2 border-4 border-transparent border-b-slate-200 -z-10 translate-y-[-1px]" />
        </div>
      </div>
    );
  };

  if (isSuggested) {
    const hasMarketPrice = lowMarketPrice && lowMarketPrice !== 0;
    const calculatedSuggestedPrice = hasMarketPrice ? lowMarketPrice - 0.01 : 0;
    const impliedMargin = hasMarketPrice
      ? ((calculatedSuggestedPrice - (landedCost || 0)) / (landedCost || 1)) *
        100
      : 0;

    // NEW: Calculate the real-time margin of the active recommended price over the landed cost
    const recPriceVal = currentVal;
    const landedCostVal = landedCost || 0;
    const currentRecMargin =
      landedCostVal > 0
        ? ((recPriceVal - landedCostVal) / landedCostVal) * 100
        : 0;

    const gradeLookup =
      GRADES.find((g) => g.id === selectedGrade)?.lookup || "Regular";
    const gradeTheme = getGradeTheme(gradeLookup);

    const dynamicSuggestedTooltip = [
      {
        label: "Price Explanation",
        description:
          priceExplanation || "By adding 12% margin to the Landed cost",
      },
      {
        label: "Low Indexed Price",
        description:
          "Calculated using today's market low threshold adjusted down by $0.01.",
      },
      {
        label: "LIP Margin",
        description:
          "The explicit margin yielded when evaluating LIP positioning against true landed costs.",
      },
    ];

    return (
      <Card
        className={`
        shadow-none
        border
        border-l-[5px]
        transition-all duration-300
        min-h-[92px]
        h-[110px]
        overflow-visible
        ${gradeTheme.border}
        ${gradeTheme.light}
      `}
      >
        <CardContent className="h-full pt-2.5 pb-2.5 px-3 flex flex-col justify-between bg-transparent space-y-0 overflow-visible">
          <div className="flex items-center justify-between w-full overflow-visible">
            <div className="flex items-center overflow-visible">
              <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide">
                {title}
              </span>
              {renderTooltip(dynamicSuggestedTooltip)}
            </div>

            <div className="text-right text-[11px] font-medium text-slate-600">
              Low Indexed Price:{" "}
              <span className="font-bold text-slate-800">
                {hasMarketPrice
                  ? `$${calculatedSuggestedPrice.toFixed(4)}`
                  : "-"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full self-end">
            <div className="flex items-center space-x-2">
              {currentVal === 0 ? (
                <span className="text-xs font-bold text-slate-400 italic">
                  No price data yet
                </span>
              ) : (
                <span className="text-lg font-black text-slate-900 tracking-tight">
                  ${currentVal.toFixed(4)}
                </span>
              )}

              {/* ADDED: Dynamic recommended price margin badge for easy comparison */}
              {currentVal > 0 && landedCostVal > 0 && (
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded whitespace-nowrap">
                  Margin: {currentRecMargin.toFixed(2)}%
                </span>
              )}
            </div>

            <div className="text-right">
              <span className="text-[11px] font-black text-cyan-800 bg-cyan-100/80 border border-cyan-200/60 px-1.5 py-0.5 rounded shadow-2xs">
                LIP Margin:{" "}
                {hasMarketPrice ? `${impliedMargin.toFixed(2)}%` : "-"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`shadow-none border overflow-visible ${colorClasses}`}>
      <CardContent className="pt-1.5 pb-2.5 px-3 flex items-center justify-between w-full overflow-visible">
        <div className="space-y-0.5 overflow-visible">
          <div className="flex items-center overflow-visible">
            <div className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wide">
              {title}
            </div>
            {renderTooltip(tooltipContent || [])}
          </div>
          {currentVal === 0 ? (
            <div className="text-xs font-bold text-slate-400 italic mt-1">
              No price data yet
            </div>
          ) : (
            <div className="text-lg font-black text-slate-900 tracking-tight">
              ${currentVal.toFixed(4)}
            </div>
          )}
        </div>

        <div className="text-right flex flex-col items-end justify-center space-y-0.5">
          {currentVal === 0 ? (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded italic">
              Price not updated
            </span>
          ) : variance !== 0 ? (
            <span
              className={`text-[10px] font-bold flex items-center px-1.5 py-0.5 rounded ${variance > 0 ? "text-rose-600 bg-rose-50" : "text-emerald-600 bg-emerald-50"}`}
            >
              {variance > 0 ? (
                <ArrowUpRight size={12} className="mr-0.5" />
              ) : (
                <ArrowDownRight size={12} className="mr-0.5" />
              )}
              ${Math.abs(variance).toFixed(4)}
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/40">
              Same as Yesterday
            </span>
          )}
          <div className="text-[13px] font-medium text-slate-400">
            Yesterday:{" "}
            <span className="font-semibold text-slate-600">
              ${yesterdayVal.toFixed(4)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompetitorTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-2 text-[10px] font-medium text-slate-400 bg-slate-50 rounded-lg">
        No competitor metrics matching criteria.
      </div>
    );
  }

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden shadow-none w-full">
      <Table className="w-full table-fixed">
        <TableHeader className="bg-slate-50/70">
          <TableRow className="hover:bg-transparent border-slate-100">
            <TableHead className="w-[30%] h-6 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-0.5">
              Name
            </TableHead>
            <TableHead className="w-[35%] h-6 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-0.5">
              Address
            </TableHead>
            <TableHead className="w-[15%] h-6 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-0.5">
              Price
            </TableHead>
            <TableHead className="w-[20%] h-6 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-0.5 text-right">
              Last Updated
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={index}
              className="border-slate-100/60 even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors"
            >
              <TableCell className="w-[30%] py-1 text-xs font-bold text-slate-700 truncate">
                {row.name}
              </TableCell>
              <TableCell className="w-[35%] py-1 text-xs text-slate-400 truncate">
                {row.address}
              </TableCell>
              <TableCell className="w-[15%] py-1 text-xs font-black text-slate-900 bg-amber-50/20">
                <span className="font-mono font-bold text-slate-800">
                  ${Number(row.price).toFixed(4)}
                </span>
              </TableCell>
              <TableCell className="w-[20%] py-1 text-[11px] text-slate-400 font-medium whitespace-nowrap text-right truncate">
                {row.updatedDate} <span className="text-slate-200">|</span>{" "}
                {row.updatedTime}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const getHoursSinceLastFeedUpdate = (
  updatedAtString?: string | null,
): string => {
  if (!updatedAtString) {
    return "Update time unavailable";
  }

  const dbUtcDate = new Date(updatedAtString);

  if (isNaN(dbUtcDate.getTime())) {
    return "Update time unavailable";
  }

  const localizedTime = dbUtcDate.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `Last Updated at ${localizedTime}`;
};

// Strict UTC data source feed schedule
// const DATA_FEED_SCHEDULE_UTC = [9, 13, 16, 19, 22];

// const getHoursSinceLastFeedUpdate = (): string => {
//   const now = new Date();

//   // Extract explicit UTC hour and minutes from user machine clock
//   const currentUTCHour = now.getUTCHours();
//   const currentUTCMinute = now.getUTCMinutes();

//   // Represent current time as a decimal hour for accurate variance checking (e.g., 13:30 = 13.5)
//   const currentUTCDecimal = currentUTCHour + currentUTCMinute / 60;

//   let lastScheduledHour = -1;

//   // 1. Scan for the largest scheduled hour that is less than or equal to current UTC time
//   for (let i = DATA_FEED_SCHEDULE_UTC.length - 1; i >= 0; i--) {
//     if (DATA_FEED_SCHEDULE_UTC[i] <= currentUTCDecimal) {
//       lastScheduledHour = DATA_FEED_SCHEDULE_UTC[i];
//       break;
//     }
//   }

//   let totalDiffHours = 0;

//   if (lastScheduledHour !== -1) {
//     // Standard same-day scenario
//     totalDiffHours = currentUTCDecimal - lastScheduledHour;
//   } else {
//     // Wrap-around scenario (User is past midnight UTC, but before the first 09:00 run)
//     // The last update was 22:00 yesterday
//     const hoursRemainingYesterday = 24 - 22; // 2 hours
//     totalDiffHours = hoursRemainingYesterday + currentUTCDecimal;
//   }

//   // Round down to the nearest hour for clean string presentation
//   const hoursAgo = Math.floor(totalDiffHours);

//   if (hoursAgo === 0) {
//     return "Updated recently";
//   }
//   return `Updated ${hoursAgo}h ago`;
// };
