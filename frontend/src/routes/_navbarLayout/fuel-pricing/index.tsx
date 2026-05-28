import React, { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowUpRight, ArrowDownRight, AlertTriangle, Fuel, Coins, HelpCircle } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/fuel-pricing/')({
  component: FuelPricingDashboard,
})

// Grade configurations
const GRADES = [
  { id: 'REG', label: 'Regular' },
  { id: 'DSL', label: 'Diesel' },
  { id: 'PNL', label: 'Premium' },
  { id: 'DYED', label: 'Dyed Diesel' }
]

const authHeader = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, "X-Required-Permission": "fuelPricing", };

function FuelPricingDashboard() {
  const [selectedCso, setSelectedCso] = useState<string>('')
  const [selectedGrade, setSelectedGrade] = useState<string>('REG')

  const authHeader = { 
    headers: { 
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      "X-Required-Permission": "fuelPricing" 
    } 
  };

  // Fetch the centralized optimization pricing tree
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fuel-pricing-matrix'],
    queryFn: async () => {
      // 1. Calculate the user's local system date parameters
      const localSystemDate = new Date();
      const yyyy = localSystemDate.getFullYear();
      const mm = String(localSystemDate.getMonth() + 1).padStart(2, '0');
      const dd = String(localSystemDate.getDate()).padStart(2, '0');
      const systemDateSK = `${yyyy}${mm}${dd}`;

      // 2. Pass the computed system date as a query parameter along with the authorized metadata header block
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

  // Handle loading and error boundaries using TanStack cache flags
  if (isLoading) {
    return <div className="p-8 text-center font-medium text-slate-500 animate-pulse">Loading Pricing Context Grid...</div>
  }

  if (isError) {
    return <div className="p-8 text-center font-medium text-rose-500">Failed to load the fuel pricing asset matrix.</div>
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* LEFT HAND CONTROLS & METRIC DASHBOARD (80%) */}
      <div className="w-[80%] p-6 border-r border-slate-200 space-y-6">
        
        {/* INVERTED L LAYOUT CONTROLS */}
        <div className="space-y-4">
          {/* Top Horizontal Row: Grade Cards */}
          <div className="grid grid-cols-4 gap-4">
            {GRADES.map(grade => {
              const isAvailable = activeGradesAtStation.includes(grade.id)
              const isSelected = selectedGrade === grade.id
              
              return (
                <button
                  key={grade.id}
                  onClick={() => isAvailable && setSelectedGrade(grade.id)}
                  disabled={!isAvailable}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    isSelected 
                      ? 'bg-sky-600 border-sky-600 text-white shadow-md' 
                      : isAvailable 
                        ? 'bg-white border-slate-200 hover:border-sky-300 text-slate-700' 
                        : 'bg-slate-100 border-slate-200 opacity-40 cursor-not-allowed text-slate-400'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider">Grade Configuration</div>
                  <div className="text-lg font-extrabold mt-1">{grade.label}</div>
                  <div className="text-[10px] mt-1 font-medium opacity-80">
                    {isAvailable ? 'Data Stream Active' : 'Not Offered at Site'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Left Vertical Selector Matrix: Stations Row */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {stations.map((station:any) => {
              const isSelected = selectedCso === station.csoCode
              return (
                <button
                  key={station.csoCode}
                  onClick={() => {
                    setSelectedCso(station.csoCode)
                    // Auto fall back logic safely inside the component state lifecycle
                    const targetStationData = pricingData[station.csoCode] || {}
                    const available = Object.keys(targetStationData)
                    if (available.length > 0 && !available.includes(selectedGrade)) {
                      setSelectedGrade(available[0])
                    }
                  }}
                  className={`px-4 py-2.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-all uppercase tracking-wide ${
                    isSelected 
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {station.stationName}
                </button>
              )
            })}
          </div>
        </div>

        {/* MIDDLE PRESENTATION LAYOUT */}
        {!currentGradeData ? (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-amber-800">
              <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
              <p className="font-bold uppercase tracking-wider text-sm mb-1">Grade Context Warning</p>
              <p className="text-xs max-w-md text-amber-700">
                Kindly change the grade to view data. This specific fuel grade configuration is not available for this individual station interface.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Sections A and B aligned horizontally */}
            <div className="grid grid-cols-2 gap-6 items-start">
              
              {/* SECTION A: FUEL SPECS */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Fuel Specs</h3>
                <MetricCard title="Landed Price" current={currentGradeData.metrics.landedCost} yesterday={currentGradeData.metrics.prevLandedCost} />
                <MetricCard title="Rack Price" current={currentGradeData.metrics.rackPrice} yesterday={currentGradeData.metrics.prevRackPrice} />
                <MetricCard 
                  title="Suggested Fuel Price" 
                  current={currentGradeData.metrics.recPrice} 
                  yesterday={currentGradeData.metrics.recPrice} // Acts as default placement placeholder
                  isSuggested
                  lowMarketPrice={currentGradeData.metrics.low}
                  landedCost={currentGradeData.metrics.landedCost}
                />
              </div>

              {/* SECTION B: LOCAL MARKET PRICE */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Local Market Price</h3>
                <MetricCard title="Low Price" current={currentGradeData.metrics.low} yesterday={currentGradeData.metrics.prevLow} />
                <MetricCard title="Average Price" current={currentGradeData.metrics.avg} yesterday={currentGradeData.metrics.prevAvg} />
                <MetricCard title="High Price" current={currentGradeData.metrics.high} yesterday={currentGradeData.metrics.prevHigh} />
              </div>
            </div>

            {/* SECTION C: COMPETITOR PRICING TABLES */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold tracking-widest text-slate-400 uppercase">Competitor Pricing</h3>
              <div className="space-y-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                
                <div>
                  <h4 className="text-xs font-extrabold text-sky-700 tracking-wider uppercase mb-2">Reserve Area</h4>
                  <CompetitorTable data={currentGradeData.competitors.filter((c: any) => c.type === 'Reserve Area')} />
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-extrabold text-indigo-700 tracking-wider uppercase mb-2">City Area</h4>
                  <CompetitorTable data={currentGradeData.competitors.filter((c: any) => c.type === 'City Area')} />
                </div>

              </div>
            </div>

          </div>
        )}
      </div>

      {/* RIGHT SIDE PANEL (20%) */}
      <div className="w-[20%] bg-slate-50/50 p-6 space-y-4">
        <h2 className="text-sm font-extrabold tracking-widest text-slate-700 uppercase flex items-center gap-2">
          <Coins className="w-4 h-4 text-sky-600" />
          Set Fuel Prices
        </h2>
        <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent">
          <CardContent className="p-4 text-center space-y-2">
            <div className="inline-block bg-slate-200 text-slate-700 font-extrabold text-[10px] tracking-widest px-2.5 py-1 rounded-full uppercase scale-90">
              Coming Soon
            </div>
            <p className="text-xs font-medium text-slate-500 leading-normal">
              Users with administrative pricing access clearance profiles will be capable of transmitting open terminal updates directly via this pipeline interface execution.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Subcomponent for Metric Data Display Elements
function MetricCard({ title, current, yesterday, isSuggested, lowMarketPrice, landedCost }: { 
  title: string; current: number; yesterday: number; isSuggested?: boolean; lowMarketPrice?: number; landedCost?: number 
}) {
  const currentVal = current || 0
  const yesterdayVal = yesterday || 0
  const variance = currentVal - yesterdayVal

  if (isSuggested) {
    // Calculated Metric Parameters for Suggested Configuration:
    const calculatedSuggestedPrice = (lowMarketPrice || 0) - 0.01
    const impliedMargin = calculatedSuggestedPrice - (landedCost || 0)

    return (
      <Card className="shadow-sm border-l-4 border-l-sky-500 bg-sky-50/20">
        <CardContent className="p-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{title}</div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-black text-slate-800">${calculatedSuggestedPrice.toFixed(4)}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
              (Margin: 12.00%)
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-slate-500">
            <div>
              Low Indexed Price: <span className="font-bold text-slate-700">${calculatedSuggestedPrice.toFixed(4)}</span>
            </div>
            <div>
              Earned Margin: <span className="font-bold text-indigo-600">${impliedMargin.toFixed(4)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm bg-white">
      <CardContent className="p-4">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</div>
        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-xl font-extrabold text-slate-800">${currentVal.toFixed(4)}</span>
          {variance !== 0 && (
            <span className={`text-xs font-bold flex items-center ${variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {variance > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              (${Math.abs(variance).toFixed(4)})
            </span>
          )}
        </div>
        <div className="text-[11px] font-medium text-slate-400 mt-1">
          Yesterday: <span className="font-semibold text-slate-500">${yesterdayVal.toFixed(4)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Subcomponent for Competitor Structural Tables
function CompetitorTable({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-4 text-xs font-medium text-slate-400 bg-slate-50 rounded-lg">No competitor metrics matching criteria.</div>
  }

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow>
            <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Name</TableHead>
            <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Address</TableHead>
            <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Price</TableHead>
            <TableHead className="h-8 text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={index} className="hover:bg-slate-50/50">
              <TableCell className="py-2 text-xs font-bold text-slate-700">{row.name}</TableCell>
              <TableCell className="py-2 text-xs text-slate-500">{row.address}</TableCell>
              <TableCell className="py-2 text-xs font-extrabold text-slate-900">${Number(row.price).toFixed(4)}</TableCell>
              <TableCell className="py-2 text-[11px] text-slate-400 font-medium">
                {row.updatedDate} at {row.updatedTime}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}