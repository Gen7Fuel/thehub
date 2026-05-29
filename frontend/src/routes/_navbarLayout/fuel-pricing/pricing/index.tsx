import { createFileRoute } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"

export const Route = createFileRoute('/_navbarLayout/fuel-pricing/pricing/')({
  component: FuelPricingPanel,
})

function FuelPricingPanel() {
  return (
    <div className="h-full min-w-0 bg-slate-50/50 p-6 space-y-4">
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
  )
}
