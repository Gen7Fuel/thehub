// "use client"

// import * as React from "react"
// import { format } from "date-fns"
// import { CalendarIcon } from "lucide-react"

// import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
// import { Calendar } from "@/components/ui/calendar"
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover"

// export function DatePicker({ date, setDate }: { date: Date | undefined; setDate: React.Dispatch<React.SetStateAction<Date | undefined>> }) {

//   return (
//     <Popover>
//       <PopoverTrigger>
//         <Button
//           variant={"outline"}
//           className={cn(
//             "w-[240px] justify-start text-left font-normal",
//             !date && "text-muted-foreground"
//           )}
//         >
//           <CalendarIcon />
//           {date ? format(date, "PPP") : <span>Pick a date</span>}
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent className="w-auto p-0" align="start">
//         <Calendar
//           mode="single"
//           selected={date}
//           onSelect={setDate}
//           initialFocus
//         />
//       </PopoverContent>
//     </Popover>
//   )
// }
"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  setDate: React.Dispatch<React.SetStateAction<Date | undefined>>
  // NEW: only this page will use it
  restrictToPast?: boolean
}

export function DatePicker({ date, setDate, restrictToPast = false }: DatePickerProps) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  // Only apply disabled rules when explicitly asked
  const disabledRules = restrictToPast ? { after: yesterday } : undefined

  return (
    <Popover>
      {/* keep this exactly as you had it before */}
      <PopoverTrigger>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={disabledRules}   // <- only active when restrictToPast=true
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
