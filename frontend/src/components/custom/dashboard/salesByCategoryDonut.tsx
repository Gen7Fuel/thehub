import { useMemo, useState } from "react"
import { PieChart, Pie, Cell, Sector, Text, ResponsiveContainer } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

interface DonutSalesProps {
  data: {
    category: string
    total: number
  }[]
  config: Record<
    string,
    {
      label: string
      color: string
      icon?: React.ComponentType
    }
  >
}

export function DonutSalesChart({ data, config }: DonutSalesProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const filteredData = useMemo(() => data.filter(d => d.total > 0), [data])
  const totalAll = useMemo(() => filteredData.reduce((sum, d) => sum + d.total, 0), [filteredData])
  const active = activeIndex !== null ? filteredData[activeIndex] : null

  const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    const offset = 10
    const xOffset = offset * Math.cos(-midAngle * RADIAN)
    const yOffset = offset * Math.sin(-midAngle * RADIAN)
    return (
      <g>
        <Sector
          cx={cx + xOffset}
          cy={cy + yOffset}
          innerRadius={innerRadius}
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
      <ChartContainer config={config} className="w-full h-[130px] flex justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filteredData}
              dataKey="total"
              nameKey="category"
              innerRadius="40%"
              outerRadius="75%"
              paddingAngle={2}
              strokeWidth={1}
              activeIndex={activeIndex ?? undefined}
              activeShape={renderActiveShape}
              onMouseEnter={(_, i) => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              label={(entry) => `${((entry.total / totalAll) * 100).toFixed(1)}%`}
              labelLine={false}
            >
              {filteredData.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={config[entry.category]?.color || "#ccc"}
                  style={{ cursor: "pointer", transition: "0.3s transform ease" }}
                />
              ))}
            </Pie>
            <Text x="20%" y="18%" textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={700}>
              {(active ? active.total : totalAll).toLocaleString()}
            </Text>
            <Text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#666">
              {active ? active.category : "Total"}
            </Text>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>


      {/* Fixed Legend */}
      <div className="mt-4 w-full flex flex-wrap justify-center gap-4">
        {filteredData.map((d) => {
          const itemConfig = config[d.category]
          return (
            <div
              key={d.category}
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
                {itemConfig?.label || d.category}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}