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
import { useState } from 'react';
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
  disablePast?: boolean
}

// Update your DatePickerProps to include a future-only flag
export function DatePicker({
  date,
  setDate,
  restrictToPast = false,
  disablePast = false // Add this
}: DatePickerProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Logic to determine which dates are unclickable
  let disabledRules: any = undefined;

  if (restrictToPast) {
    disabledRules = { after: today };
  } else if (disablePast) {
    disabledRules = { before: today }; // This prevents selecting anything before today
  }

  return (
    <Popover>
      {/* Remove asChild here */}
      <PopoverTrigger>
        <Button
          type="button" // Ensure it doesn't trigger form submits
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
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
          disabled={disabledRules}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// Inside DatePicker.tsx
export function WorkspaceDatePicker({ date, setDate }: { date: Date, setDate: (d: Date) => void }) {
  const today = new Date();
  const maxFuture = new Date();
  maxFuture.setDate(today.getDate() + 3);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[240px] justify-start text-left font-bold border-2 border-blue-200 shadow-sm">
          <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
          {format(date, "PPP")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => d && setDate(d)}
          className="bg-white rounded-xl"
          // Disable anything more than 3 days from today
          disabled={(date) => date > maxFuture}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
