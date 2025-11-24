import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export interface TenderTransaction {
  tender: string
  transactions: number
}

interface PieTenderChartProps {
  data: TenderTransaction[]
  config: Record<
    string,
    {
      label: string
      color: string
      icon?: React.ComponentType
    }
  >
}

export function PieTenderChart({ data, config }: PieTenderChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const filteredData = useMemo(() => data.filter(d => d.transactions > 0), [data])
  const totalAll = useMemo(() => filteredData.reduce((sum, d) => sum + d.transactions, 0), [filteredData])
  // const active = activeIndex !== null ? filteredData[activeIndex] : null

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180
    const { cx, cy, midAngle, outerRadius, startAngle, endAngle, fill } = props
    const offset = 10
    const xOffset = offset * Math.cos(-midAngle * RADIAN)
    const yOffset = offset * Math.sin(-midAngle * RADIAN)
    return (
      <g>
        <Sector
          cx={cx + xOffset}
          cy={cy + yOffset}
          innerRadius={0} // Pie chart
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    )
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Chart */}
      <ChartContainer config={config} className="w-full h-[150px] flex justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filteredData}
              dataKey="transactions"
              nameKey="tender"
              innerRadius={0} // Pie chart
              outerRadius="75%"
              paddingAngle={2}
              strokeWidth={1}
              activeIndex={activeIndex ?? undefined}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              label={false} // no labels
              labelLine={false}
            >
              {filteredData.map((entry) => (
                <Cell
                  key={entry.tender}
                  fill={config[entry.tender]?.color || "#ccc"}
                  style={{ cursor: "pointer", transition: "0.3s transform ease" }}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value: number, name: string) => [
                `${((value / totalAll) * 100).toFixed(1)}%`, // show percentage
                name // show tender
              ]}
            />
          </PieChart>

        </ResponsiveContainer>
      </ChartContainer>
      {/* Fixed Legend */}
      <div className="mt-4 w-full flex flex-wrap justify-center gap-4">
        {filteredData.map((d) => {
          const itemConfig = config[d.tender]
          return (
            <div
              key={d.tender}
              className={cn(
                "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
              )}
            >
              {itemConfig?.icon ? (
                <itemConfig.icon />
              ) : (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: itemConfig?.color }}
                />
              )}
              <span className="text-sm font-medium text-black">
                {itemConfig?.label || d.tender}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}