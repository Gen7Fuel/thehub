import { useState, useEffect } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Car,
  Zap,
  Truck,
  Fuel,
} from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/fuel-pricing')({
  component: FuelPricingDashboard,
})

const GRADES = [
  { id: 'REG', label: 'Regular', lookup: 'Regular' },
  { id: 'DSL', label: 'Diesel', lookup: 'Diesel' },
  { id: 'PNL', label: 'Premium', lookup: 'Premium' },
  { id: 'DYED', label: 'Dyed Diesel', lookup: 'Dyed Diesel' }
]

export const getGradeTheme = (grade: string) => {
  switch (grade) {
    case "Regular":
      return { color: "bg-green-500", label: "text-green-700", border: "border-green-500", icon: Car, light: "bg-green-50/50" }
    case "Premium":
      return { color: "bg-red-500", label: "text-red-700", border: "border-red-500", icon: Zap, light: "bg-red-50/50" }
    case "Diesel":
      return { color: "bg-amber-400", label: "text-amber-700", border: "border-amber-400", icon: Truck, light: "bg-amber-50/50" }
    case "Dyed Diesel":
      return { color: "bg-red-800", label: "text-red-950", border: "border-red-800", icon: Truck, light: "bg-red-50/30" }
    default:
      return { color: "bg-slate-600", label: "text-slate-700", border: "border-slate-600", icon: Car, light: "bg-slate-50" }
  }
}

function FuelPricingDashboard() {
  const [selectedCso, setSelectedCso] = useState<string>('')
  const [selectedGrade, setSelectedGrade] = useState<string>('REG')

  const authHeader = { 
    headers: { 
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      "X-Required-Permission": "fuelPricing" 
    } 
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fuel-pricing-matrix'],
    queryFn: async () => {
      const localSystemDate = new Date();
      const yyyy = localSystemDate.getFullYear();
      const mm = String(localSystemDate.getMonth() + 1).padStart(2, '0');
      const dd = String(localSystemDate.getDate()).padStart(2, '0');
      const systemDateSK = `${yyyy}${mm}${dd}`;

      const res = await axios.get(`/api/fuel-pricing?date=${systemDateSK}`, authHeader);
      return res.data;
    }
  });

  const stations = data?.stations || []
  const pricingData = data?.pricingData || {}

  useEffect(() => {
    if (stations.length > 0 && !selectedCso) {
      setSelectedCso(stations[0].csoCode)
    }
  }, [stations, selectedCso])

  const currentStationData = pricingData[selectedCso] || {}
  const activeGradesAtStation = Object.keys(currentStationData)
  const currentGradeData = currentStationData[selectedGrade]

  if (isLoading) {
    return <div className="p-8 text-center font-medium text-slate-500 animate-pulse">Loading Pricing Context Grid...</div>
  }

  if (isError) {
    return <div className="p-8 text-center font-medium text-rose-500">Failed to load the fuel pricing asset matrix.</div>
  }

  return (
    <div
      className="grid h-full w-full bg-[#f8fafc] overflow-hidden"
      style={{
        gridTemplateColumns: 'minmax(0, 1fr) 380px',
      }}
    >
      <div className="min-w-0 p-6 border-r border-slate-200 flex flex-col space-y-5 overflow-hidden">
        
        {/* TOP: HORIZONTAL GRADE SELECTOR ROW */}
        <div className="grid grid-cols-4 gap-4 w-full">
          {GRADES.map(grade => {
            const isAvailable = activeGradesAtStation.includes(grade.id)
            const isSelected = selectedGrade === grade.id
            const theme = getGradeTheme(grade.lookup)
            const IconComponent = theme.icon
            
            return (
              <button
                key={grade.id}
                onClick={() => isAvailable && setSelectedGrade(grade.id)}
                disabled={!isAvailable}
                className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start justify-between relative overflow-hidden ${
                  isSelected 
                    ? `${theme.color} text-white border-transparent shadow-md transform scale-[1.01]` 
                    : isAvailable 
                      ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-700' 
                      : 'bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed text-slate-400'
                }`}
              >
                <div className="z-10">
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                    Grade Configuration
                  </div>
                  <div className="text-xl font-black mt-0.5">{grade.label}</div>
                  <div className={`text-[10px] mt-2 font-semibold tracking-wide ${isSelected ? 'text-white/90' : theme.label}`}>
                    {isAvailable ? '● System Active' : '✕ Not Available'}
                  </div>
                </div>
                <IconComponent className={`w-8 h-8 shrink-0 mt-1 opacity-25 ${isSelected ? 'text-white' : theme.label}`} />
              </button>
            )
          })}
        </div>

        {/* WORKSPACE AREA: CHANGED TO A FORCED HORIZONTAL ROW TO PREVENT DOWNWARD WRAPPING */}
        <div className="flex flex-row items-start space-x-5 w-full min-w-0 overflow-hidden">
                    
          {/* LEFT COMPONENT: STATION LIST (INCREASED WIDTH TO 280px) */}
          <div className="w-[280px] shrink-0 flex flex-col gap-3 max-h-[78vh] overflow-y-auto pr-1 scrollbar-thin">
            <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest pl-1 pb-1 border-b border-slate-100">
              Station Locations
            </div>
            {stations.map((station: any) => {
              const isSelected = selectedCso === station.csoCode
              return (
                <button
                  key={station.csoCode}
                  onClick={() => {
                    setSelectedCso(station.csoCode)
                    const targetStationData = pricingData[station.csoCode] || {}
                    const available = Object.keys(targetStationData)
                    if (available.length > 0 && !available.includes(selectedGrade)) {
                      setSelectedGrade(available[0])
                    }
                  }}
                  className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col space-y-1.5 relative group ${
                    isSelected 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-black uppercase tracking-wide line-clamp-1 flex-1">
                      {station.stationName}
                    </span>
                    <div className={`p-1 rounded-md ${isSelected ? 'bg-slate-800 text-sky-400' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-500'}`}>
                      <Fuel className="w-3.5 h-3.5 shrink-0" />
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium leading-normal ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                    {station.address || 'No location configured'}
                  </span>
                </button>
              )
            })}
          </div>

          {/* RIGHT COMPONENT: DATA CARDS & TABLES (FILLS THE REST OF THE ROW AUTOMATICALLY) */}
          <div className="flex-1 min-w-0">
            {!currentGradeData ? (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center text-amber-800">
                  <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
                  <p className="font-bold uppercase tracking-wider text-sm mb-1">Grade Context Warning</p>
                  <p className="text-xs max-w-md text-amber-700 leading-relaxed">
                    Kindly change the grade to view data. This specific fuel grade configuration is not available for this individual station interface.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5 w-full">
                
                {/* HORIZONTAL SECTIONS: COMPACT METRIC CARDS */}
                <div className="grid grid-cols-2 gap-4 items-start w-full">
                  {/* FUEL SPECS */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase pl-0.5">Fuel Specs</h3>
                    <MetricCard title="Landed Price" current={currentGradeData.metrics.landedCost} yesterday={currentGradeData.metrics.prevLandedCost} />
                    <MetricCard title="Rack Price" current={currentGradeData.metrics.rackPrice} yesterday={currentGradeData.metrics.prevRackPrice} />
                    <MetricCard 
                      title="Suggested Price" 
                      current={currentGradeData.metrics.recPrice} 
                      yesterday={currentGradeData.metrics.recPrice}
                      isSuggested
                      lowMarketPrice={currentGradeData.metrics.low}
                      landedCost={currentGradeData.metrics.landedCost}
                    />
                  </div>

                  {/* LOCAL MARKET PRICE */}
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase pl-0.5">Local Market Price</h3>
                    <MetricCard title="Low Price" current={currentGradeData.metrics.low} yesterday={currentGradeData.metrics.prevLow} />
                    <MetricCard title="Average Price" current={currentGradeData.metrics.avg} yesterday={currentGradeData.metrics.prevAvg} />
                    <MetricCard title="High Price" current={currentGradeData.metrics.high} yesterday={currentGradeData.metrics.prevHigh} />
                  </div>
                </div>

                {/* COMPETITOR TABLES FRAME */}
                <div className="space-y-2 w-full">
                  <h3 className="text-[10px] font-bold tracking-widest text-slate-400 uppercase pl-0.5">Competitor Pricing</h3>
                  <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full">
                    
                    <div>
                      <h4 className="text-[10px] font-extrabold text-sky-700 tracking-wider uppercase mb-1.5 pl-0.5">Reserve Area</h4>
                      <CompetitorTable data={currentGradeData.competitors.filter((c: any) => c.type === 'Reserve Area')} />
                    </div>

                    <div className="border-t border-slate-100 pt-3">
                      <h4 className="text-[10px] font-extrabold text-indigo-700 tracking-wider uppercase mb-1.5 pl-0.5">City Area</h4>
                      <CompetitorTable data={currentGradeData.competitors.filter((c: any) => c.type === 'City Area')} />
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
  )
}

function MetricCard({ title, current, yesterday, isSuggested, lowMarketPrice, landedCost }: { 
  title: string; current: number; yesterday: number; isSuggested?: boolean; lowMarketPrice?: number; landedCost?: number 
}) {
  const currentVal = current || 0
  const yesterdayVal = yesterday || 0
  const variance = currentVal - yesterdayVal

  if (isSuggested) {
    const calculatedSuggestedPrice = (lowMarketPrice || 0) - 0.01
    const impliedMargin = (calculatedSuggestedPrice - (landedCost || 0)) / (landedCost || 1) * 100

    return (
      <Card className="shadow-none border border-sky-100 border-l-4 border-l-sky-500 bg-sky-50/30">
        <CardContent className="p-2.5 flex flex-col justify-between h-auto space-y-1">
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{title}</span>
            <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/70 px-1 rounded">
              {impliedMargin.toFixed(1)}% MGN
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-base font-black text-slate-800">${currentVal.toFixed(4)}</span>
            <span className="text-[9px] font-medium text-slate-400">
              Low: <span className="font-bold text-slate-600">${calculatedSuggestedPrice.toFixed(4)}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-none bg-white border-slate-200/80">
      <CardContent className="p-2.5 flex items-center justify-between w-full">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{title}</div>
          <div className="text-base font-black text-slate-800 mt-0.5">${currentVal.toFixed(4)}</div>
        </div>
        <div className="text-right flex flex-col items-end justify-center">
          {variance !== 0 && (
            <span className={`text-[10px] font-bold flex items-center px-1 rounded ${variance > 0 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
              {variance > 0 ? <ArrowUpRight size={11} className="mr-0.5" /> : <ArrowDownRight size={11} className="mr-0.5" />}
              ${Math.abs(variance).toFixed(4)}
            </span>
          )}
          <div className="text-[9px] font-medium text-slate-400 mt-0.5">
            Prev: <span className="font-semibold text-slate-500">${yesterdayVal.toFixed(4)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompetitorTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-3 text-[11px] font-medium text-slate-400 bg-slate-50 rounded-lg">No competitor metrics matching criteria.</div>
  }

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden shadow-none">
      <Table>
        <TableHeader className="bg-slate-50/70">
          <TableRow className="hover:bg-transparent border-slate-100">
            <TableHead className="h-7 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-1">Name</TableHead>
            <TableHead className="h-7 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-1">Address</TableHead>
            <TableHead className="h-7 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-1">Price</TableHead>
            <TableHead className="h-7 text-[9px] font-bold uppercase tracking-wider text-slate-400 py-1 text-right">Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index} className="border-slate-100/60 even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors">
              <TableCell className="py-1.5 text-xs font-bold text-slate-700">{row.name}</TableCell>
              <TableCell className="py-1.5 text-xs text-slate-400 max-w-[180px] truncate">{row.address}</TableCell>
              <TableCell className="py-1.5 text-xs font-black text-slate-900 bg-amber-50/30">
                <span className="px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">
                  ${Number(row.price).toFixed(4)}
                </span>
              </TableCell>
              <TableCell className="py-1.5 text-[10px] text-slate-400 font-medium whitespace-nowrap text-right">
                {row.updatedDate} <span className="text-slate-300 font-normal">|</span> {row.updatedTime}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}


// import React, { useState, useEffect } from 'react'
// import { createFileRoute } from '@tanstack/react-router'
// import { useQuery } from '@tanstack/react-query'
// import axios from 'axios'
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { ArrowUpRight, ArrowDownRight, AlertTriangle, Fuel, Coins, HelpCircle } from 'lucide-react'

// export const Route = createFileRoute('/_navbarLayout/fuel-pricing/')({
//   component: FuelPricingDashboard,
// })

// // Grade configurations
// const GRADES = [
//   { id: 'REG', label: 'Regular' },
//   { id: 'DSL', label: 'Diesel' },
//   { id: 'PNL', label: 'Premium' },
//   { id: 'DYED', label: 'Dyed Diesel' }
// ]

// const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, "X-Required-Permission": "fuelPricing", };

// function FuelPricingDashboard() {
//   const [selectedCso, setSelectedCso] = useState<string>('')
//   const [selectedGrade, setSelectedGrade] = useState<string>('REG')

//   const authHeader = { 
//     headers: { 
//       Authorization: `Bearer ${localStorage.getItem('token')}`,
//       "X-Required-Permission": "fuelPricing" 
//     } 
//   };

//   // Fetch the centralized optimization pricing tree
//   const { data, isLoading, isError } = useQuery({
//     queryKey: ['fuel-pricing-matrix'],
//     queryFn: async () => {
//       // 1. Calculate the user's local system date parameters
//       const localSystemDate = new Date();
//       const yyyy = localSystemDate.getFullYear();
//       const mm = String(localSystemDate.getMonth() + 1).padStart(2, '0');
//       const dd = String(localSystemDate.getDate()).padStart(2, '0');
//       const systemDateSK = `${yyyy}${mm}${dd}`;

//       // 2. Pass the computed system date as a query parameter along with the authorized metadata header block
//       const res = await axios.get(`/api/fuel-pricing?date=${systemDateSK}`, authHeader);
//       return res.data;
//     }
//   });

//   const stations = data?.stations || []
//   const pricingData = data?.pricingData || {}

//   useEffect(() => {
//     if (stations.length > 0 && !selectedCso) {
//       setSelectedCso(stations[0].csoCode)
//     }
//   }, [stations, selectedCso])

//   const currentStationData = pricingData[selectedCso] || {}
//   const activeGradesAtStation = Object.keys(currentStationData)
//   const currentGradeData = currentStationData[selectedGrade]

//   // Handle loading and error boundaries using TanStack cache flags
//   if (isLoading) {
//     return <div className="p-8 text-center font-medium text-slate-500 animate-pulse">Loading Pricing Context Grid...</div>
//   }

//   if (isError) {
//     return <div className="p-8 text-center font-medium text-rose-500">Failed to load the fuel pricing asset matrix.</div>
//   }

//   return (
//     <div className="min-h-screen bg-[#f8fafc] flex">
//       {/* LEFT HAND CONTROLS & METRIC DASHBOARD (80%) */}
//       <div className="w-[80%] p-6 border-r border-slate-200 space-y-6">
        
//         {/* INVERTED L LAYOUT CONTROLS */}
//         <div className="space-y-4">
//           {/* Top Horizontal Row: Grade Cards */}
//           <div className="grid grid-cols-4 gap-4">
//             {GRADES.map(grade => {
//               const isAvailable = activeGradesAtStation.includes(grade.id)
//               const isSelected = selectedGrade === grade.id
              
//               return (
//                 <button
//                   key={grade.id}
//                   onClick={() => isAvailable && setSelectedGrade(grade.id)}
//                   disabled={!isAvailable}
//                   className={`p-4 rounded-xl border text-left transition-all duration-200 ${
//                     isSelected 
//                       ? 'bg-sky-600 border-sky-600 text-white shadow-md' 
//                       : isAvailable 
//                         ? 'bg-white border-slate-200 hover:border-sky-300 text-slate-700' 
//                         : 'bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed text-slate-400'
//                   }`}
//                 >
//                   <div className="text-xs font-bold uppercase tracking-wider">Grade Configuration</div>
//                   <div className="text-lg font-extrabold mt-1">{grade.label}</div>
//                   <div className="text-[10px] mt-1 font-medium opacity-80">
//                     {isAvailable ? 'Data Stream Active' : 'Not Offered at Site'}
//                   </div>
//                 </button>
//               )
//             })}
//           </div>

//           {/* Left Vertical Selector Matrix: Stations Row */}
//           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
//             {stations.map((station:any) => {
//               const isSelected = selectedCso === station.csoCode
//               return (
//                 <button
//                   key={station.csoCode}
//                   onClick={() => {
//                     setSelectedCso(station.csoCode)
//                     // Auto fall back logic safely inside the component state lifecycle
//                     const targetStationData = pricingData[station.csoCode] || {}
//                     const available = Object.keys(targetStationData)
//                     if (available.length > 0 && !available.includes(selectedGrade)) {
//                       setSelectedGrade(available[0])
//                     }
//                   }}
//                   className={`px-4 py-2.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wide ${
//                     isSelected 
//                       ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
//                       : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
//                   }`}
//                 >
//                   {station.stationName}
//                 </button>
//               )
//             })}
//           </div>
//         </div>

//         {/* MIDDLE PRESENTATION LAYOUT */}
//         {!currentGradeData ? (
//           <Card className="border-amber-200 bg-amber-50/50">
//             <CardContent className="flex flex-col items-center justify-center p-12 text-center text-amber-800">
//               <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
//               <p className="font-bold uppercase tracking-wider text-sm mb-1">Grade Context Warning</p>
//               <p className="text-xs max-w-md text-amber-700">
//                 Kindly change the grade to view data. This specific fuel grade configuration is not available for this individual station interface.
//               </p>
//             </CardContent>
//           </Card>
//         ) : (
//           <div className="space-y-6">
//             {/* Sections A and B aligned horizontally */}
//             <div className="grid grid-cols-2 gap-6 items-start">
              
//               {/* SECTION A: FUEL SPECS */}
//               <div className="space-y-3">
//                 <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Fuel Specs</h3>
//                 <MetricCard title="Landed Price" current={currentGradeData.metrics.landedCost} yesterday={currentGradeData.metrics.prevLandedCost} />
//                 <MetricCard title="Rack Price" current={currentGradeData.metrics.rackPrice} yesterday={currentGradeData.metrics.prevRackPrice} />
//                 <MetricCard 
//                   title="Suggested Fuel Price" 
//                   current={currentGradeData.metrics.recPrice} 
//                   yesterday={currentGradeData.metrics.recPrice} // Acts as default placement placeholder
//                   isSuggested
//                   lowMarketPrice={currentGradeData.metrics.low}
//                   landedCost={currentGradeData.metrics.landedCost}
//                 />
//               </div>

//               {/* SECTION B: LOCAL MARKET PRICE */}
//               <div className="space-y-3">
//                 <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Local Market Price</h3>
//                 <MetricCard title="Low Price" current={currentGradeData.metrics.low} yesterday={currentGradeData.metrics.prevLow} />
//                 <MetricCard title="Average Price" current={currentGradeData.metrics.avg} yesterday={currentGradeData.metrics.prevAvg} />
//                 <MetricCard title="High Price" current={currentGradeData.metrics.high} yesterday={currentGradeData.metrics.prevHigh} />
//               </div>
//             </div>

//             {/* SECTION C: COMPETITOR PRICING TABLES */}
//             <div className="space-y-4">
//               <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Competitor Pricing</h3>
//               <div className="space-y-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                
//                 <div>
//                   <h4 className="text-xs font-extrabold text-sky-700 tracking-wider uppercase mb-2">Reserve Area</h4>
//                   <CompetitorTable data={currentGradeData.competitors.filter((c: any) => c.type === 'Reserve Area')} />
//                 </div>

//                 <div className="border-t border-slate-100 pt-4">
//                   <h4 className="text-xs font-extrabold text-indigo-700 tracking-wider uppercase mb-2">City Area</h4>
//                   <CompetitorTable data={currentGradeData.competitors.filter((c: any) => c.type === 'City Area')} />
//                 </div>

//               </div>
//             </div>

//           </div>
//         )}
//       </div>

//       {/* RIGHT SIDE PANEL (20%) */}
//       <div className="w-[20%] bg-slate-50/50 p-6 space-y-4">
//         <h2 className="text-sm font-extrabold tracking-widest text-slate-700 uppercase flex items-center gap-2">
//           <Coins className="w-4 h-4 text-sky-600" />
//           Set Fuel Prices
//         </h2>
//         <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent">
//           <CardContent className="p-4 text-center space-y-2">
//             <div className="inline-block bg-slate-200 text-slate-700 font-extrabold text-[10px] tracking-widest px-2.5 py-1 rounded-full uppercase scale-90">
//               Coming Soon
//             </div>
//             <p className="text-xs font-medium text-slate-500 leading-normal">
//               Users with administrative pricing access clearance profiles will be capable of transmitting open terminal updates directly via this pipeline interface execution.
//             </p>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   )
// }

// // Subcomponent for Metric Data Display Elements
// function MetricCard({ title, current, yesterday, isSuggested, lowMarketPrice, landedCost }: { 
//   title: string; current: number; yesterday: number; isSuggested?: boolean; lowMarketPrice?: number; landedCost?: number 
// }) {
//   const currentVal = current || 0
//   const yesterdayVal = yesterday || 0
//   const variance = currentVal - yesterdayVal

//   if (isSuggested) {
//     // Calculated Metric Parameters for Suggested Configuration:
//     const calculatedSuggestedPrice = (lowMarketPrice || 0) - 0.01
//     const impliedMargin = (calculatedSuggestedPrice - (landedCost || 0))/(landedCost || 0) * 100

//     return (
//       <Card className="shadow-sm border-l-4 border-l-sky-500 bg-sky-50/20">
//         <CardContent className="p-4">
//           <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</div>
//           <div className="flex items-baseline gap-2 mt-1.5">
//             <span className="text-2xl font-black text-slate-800">${currentVal.toFixed(4)}</span>
//             <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
//               (Margin: 12.00%)
//             </span>
//           </div>
//           <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-500">
//             <div>
//               Low Indexed Price: <span className="font-bold text-slate-700">${calculatedSuggestedPrice.toFixed(4)}</span>
//             </div>
//             <div>
//               Earned Margin: <span className="font-bold text-indigo-600">{impliedMargin.toFixed(2)}%</span>
//             </div>
//           </div>
//         </CardContent>
//       </Card>
//     )
//   }

//   return (
//     <Card className="shadow-sm bg-white">
//       <CardContent className="p-4">
//         <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</div>
//         <div className="flex items-baseline gap-2 mt-1.5">
//           <span className="text-xl font-extrabold text-slate-800">${currentVal.toFixed(4)}</span>
//           {variance !== 0 && (
//             <span className={`text-xs font-bold flex items-center ${variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
//               {variance > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
//               (${Math.abs(variance).toFixed(4)})
//             </span>
//           )}
//         </div>
//         <div className="text-[11px] font-medium text-slate-400 mt-1">
//           Yesterday: <span className="font-semibold text-slate-500">${yesterdayVal.toFixed(4)}</span>
//         </div>
//       </CardContent>
//     </Card>
//   )
// }

// // Subcomponent for Competitor Structural Tables
// function CompetitorTable({ data }: { data: any[] }) {
//   if (!data || data.length === 0) {
//     return <div className="text-center py-4 text-xs font-medium text-slate-400 bg-slate-50 rounded-lg">No competitor metrics matching criteria.</div>
//   }

//   return (
//     <div className="border border-slate-100 rounded-lg overflow-hidden">
//       <Table>
//         <TableHeader className="bg-slate-50">
//           <TableRow>
//             <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</TableHead>
//             <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Address</TableHead>
//             <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Price</TableHead>
//             <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Updated</TableHead>
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {data.map((row, index) => (
//             <TableRow key={index} className="hover:bg-slate-50/50">
//               <TableCell className="py-2 text-xs font-bold text-slate-700">{row.name}</TableCell>
//               <TableCell className="py-2 text-xs text-slate-500">{row.address}</TableCell>
//               <TableCell className="py-2 text-xs font-extrabold text-slate-900">${Number(row.price).toFixed(4)}</TableCell>
//               <TableCell className="py-2 text-[11px] text-slate-400 font-medium">
//                 {row.updatedDate} at {row.updatedTime}
//               </TableCell>
//             </TableRow>
//           ))}
//         </TableBody>
//       </Table>
//     </div>
//   )
// }
