// import { createFileRoute, useRouter } from '@tanstack/react-router'
// import { useEffect, useMemo, useRef, useState } from 'react'
// import { CalendarDays, Plus, Trash2 } from 'lucide-react'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import { Textarea } from '@/components/ui/textarea'
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog'
// import { useAuth } from '@/context/AuthContext'

// interface EventDoc {
//   _id: string
//   site: string
//   title: string
//   description?: string
//   date: string // YYYY-MM-DD
//   createdBy: {
//     id: string
//     firstName?: string
//     lastName?: string
//     email?: string
//   }
//   createdAt: string
//   updatedAt: string
// }

// export const Route = createFileRoute('/_navbarLayout/events/')({
//   component: RouteComponent,
//   loader: async () => {
//     try {
//       const res = await fetch('/api/events', {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//         },
//       })
//       if (!res.ok) return { events: [] as EventDoc[] }
//       const json = await res.json()
//       return { events: (json.data || []) as EventDoc[] }
//     } catch {
//       return { events: [] as EventDoc[] }
//     }
//   },
// })

// // ── Date helpers (local time, no UTC drift) ────────────────────────────────
// const pad = (n: number) => String(n).padStart(2, '0')

// function toIsoDate(d: Date): string {
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// }

// function parseIsoDate(iso: string): Date {
//   const [y, m, d] = iso.split('-').map(Number)
//   return new Date(y, (m || 1) - 1, d || 1)
// }

// const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// const MONTH_LONG = [
//   'January', 'February', 'March', 'April', 'May', 'June',
//   'July', 'August', 'September', 'October', 'November', 'December',
// ]

// function authorName(ev: EventDoc) {
//   const f = ev.createdBy?.firstName || ''
//   const l = ev.createdBy?.lastName || ''
//   const full = `${f} ${l}`.trim()
//   return full || ev.createdBy?.email || 'Unknown'
// }

// // How many days into the future to render in the scrollable calendar.
// const DAYS_TO_RENDER = 90

// function RouteComponent() {
//   const router = useRouter()
//   const { user } = useAuth()
//   const { events } = Route.useLoaderData() as { events: EventDoc[] }

//   const [composeDate, setComposeDate] = useState<string | null>(null)
//   const [title, setTitle] = useState('')
//   const [description, setDescription] = useState('')
//   const [submitting, setSubmitting] = useState(false)
//   const [composeError, setComposeError] = useState<string | null>(null)

//   const [viewing, setViewing] = useState<EventDoc | null>(null)
//   const [deleting, setDeleting] = useState(false)
//   const [viewError, setViewError] = useState<string | null>(null)

//   const todayIso = useMemo(() => toIsoDate(new Date()), [])

//   // Group events by date for O(1) lookup.
//   const eventsByDate = useMemo(() => {
//     const map = new Map<string, EventDoc[]>()
//     for (const ev of events) {
//       const list = map.get(ev.date) || []
//       list.push(ev)
//       map.set(ev.date, list)
//     }
//     return map
//   }, [events])

//   // Build the day list (today + next N-1 days) grouped by month.
//   const monthGroups = useMemo(() => {
//     const start = parseIsoDate(todayIso)
//     const groups: { key: string; label: string; days: { iso: string; date: Date }[] }[] = []
//     let currentKey = ''
//     let currentGroup: (typeof groups)[number] | null = null

//     for (let i = 0; i < DAYS_TO_RENDER; i++) {
//       const d = new Date(start)
//       d.setDate(start.getDate() + i)
//       const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
//       if (key !== currentKey) {
//         currentKey = key
//         currentGroup = {
//           key,
//           label: `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`,
//           days: [],
//         }
//         groups.push(currentGroup)
//       }
//       currentGroup!.days.push({ iso: toIsoDate(d), date: d })
//     }
//     return groups
//   }, [todayIso])

//   // Scroll today's row into view on mount.
//   const todayRef = useRef<HTMLDivElement | null>(null)
//   useEffect(() => {
//     todayRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
//   }, [])

//   const openCompose = (iso: string) => {
//     setComposeDate(iso)
//     setTitle('')
//     setDescription('')
//     setComposeError(null)
//   }

//   const submitEvent = async () => {
//     if (!composeDate) return
//     if (!title.trim()) {
//       setComposeError('Title is required.')
//       return
//     }
//     setSubmitting(true)
//     setComposeError(null)
//     try {
//       const res = await fetch('/api/events', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//         },
//         body: JSON.stringify({
//           title: title.trim(),
//           description: description.trim(),
//           date: composeDate,
//         }),
//       })
//       if (!res.ok) {
//         const data = await res.json().catch(() => ({}))
//         throw new Error(data?.message || 'Failed to create event.')
//       }
//       setComposeDate(null)
//       await router.invalidate()
//     } catch (err: any) {
//       setComposeError(err?.message || 'Failed to create event.')
//     } finally {
//       setSubmitting(false)
//     }
//   }

//   const deleteEvent = async () => {
//     if (!viewing) return
//     setDeleting(true)
//     setViewError(null)
//     try {
//       const res = await fetch(`/api/events/${viewing._id}`, {
//         method: 'DELETE',
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
//         },
//       })
//       if (!res.ok) {
//         const data = await res.json().catch(() => ({}))
//         throw new Error(data?.message || 'Failed to delete event.')
//       }
//       setViewing(null)
//       await router.invalidate()
//     } catch (err: any) {
//       setViewError(err?.message || 'Failed to delete event.')
//     } finally {
//       setDeleting(false)
//     }
//   }

//   const canDeleteViewing =
//     !!viewing &&
//     (String(viewing.createdBy?.id) === String(user?.id) || (user as any)?.is_admin)

//   const formatLongDate = (iso: string) => {
//     const d = parseIsoDate(iso)
//     return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
//   }

//   return (
//     <div className="pt-4 w-full flex flex-col items-center">
//       <div className="w-full max-w-3xl px-4 space-y-4">
//         <div>
//           <h1 className="text-2xl font-bold flex items-center gap-2">
//             <CalendarDays className="h-5 w-5 text-primary" />
//             Events
//           </h1>
//           <p className="text-sm text-muted-foreground mt-1">
//             {user?.location ? `Upcoming events for ${user.location}` : 'Upcoming events for your site'}
//             {' '}— click any date to add an event.
//           </p>
//         </div>

//         <div className="border rounded-md divide-y max-h-[75vh] overflow-y-auto bg-background">
//           {monthGroups.map((group) => (
//             <div key={group.key}>
//               <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
//                 {group.label}
//               </div>
//               <div className="divide-y">
//                 {group.days.map(({ iso, date }) => {
//                   const dayEvents = eventsByDate.get(iso) || []
//                   const isToday = iso === todayIso
//                   const isWeekend = date.getDay() === 0 || date.getDay() === 6

//                   return (
//                     <div
//                       key={iso}
//                       ref={isToday ? todayRef : undefined}
//                       onClick={() => openCompose(iso)}
//                       className={`group flex items-start gap-4 px-4 py-3 cursor-pointer transition hover:bg-primary/5 ${isWeekend ? 'bg-muted/20' : ''}`}
//                     >
//                       {/* Date column */}
//                       <div className="w-14 shrink-0 text-center">
//                         <div className={`text-2xl font-bold leading-none ${isToday ? 'text-primary' : 'text-gray-800'}`}>
//                           {date.getDate()}
//                         </div>
//                         <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
//                           {WEEKDAY_SHORT[date.getDay()]}
//                         </div>
//                         {isToday && (
//                           <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-primary text-primary-foreground">
//                             Today
//                           </div>
//                         )}
//                       </div>

//                       {/* Events column */}
//                       <div className="flex-1 min-w-0">
//                         {dayEvents.length === 0 ? (
//                           <div className="text-xs text-muted-foreground italic opacity-0 group-hover:opacity-100 transition">
//                             Click to add an event
//                           </div>
//                         ) : (
//                           <div className="space-y-1.5">
//                             {dayEvents.map((ev) => (
//                               <button
//                                 key={ev._id}
//                                 type="button"
//                                 onClick={(e) => {
//                                   e.stopPropagation()
//                                   setViewError(null)
//                                   setViewing(ev)
//                                 }}
//                                 className="w-full text-left rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-2 transition"
//                               >
//                                 <div className="text-sm font-semibold text-gray-800 truncate">{ev.title}</div>
//                                 {ev.description && (
//                                   <div className="text-xs text-muted-foreground line-clamp-1">{ev.description}</div>
//                                 )}
//                               </button>
//                             ))}
//                           </div>
//                         )}
//                       </div>

//                       {/* Add button */}
//                       <Button
//                         type="button"
//                         variant="ghost"
//                         size="icon"
//                         className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition"
//                         onClick={(e) => {
//                           e.stopPropagation()
//                           openCompose(iso)
//                         }}
//                         aria-label={`Add event on ${iso}`}
//                       >
//                         <Plus className="h-4 w-4" />
//                       </Button>
//                     </div>
//                   )
//                 })}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* Compose dialog */}
//       <Dialog
//         open={!!composeDate}
//         onOpenChange={(open) => {
//           if (!open && !submitting) setComposeDate(null)
//         }}
//       >
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>New event</DialogTitle>
//             <DialogDescription>
//               {composeDate && formatLongDate(composeDate)}
//               {user?.location && <> • {user.location}</>}
//             </DialogDescription>
//           </DialogHeader>
//           <div className="space-y-3">
//             <div>
//               <label className="text-xs font-medium text-muted-foreground">Title</label>
//               <Input
//                 value={title}
//                 onChange={(e) => setTitle(e.target.value)}
//                 placeholder="Event title"
//                 maxLength={200}
//                 disabled={submitting}
//                 autoFocus
//               />
//             </div>
//             <div>
//               <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
//               <Textarea
//                 value={description}
//                 onChange={(e) => setDescription(e.target.value)}
//                 placeholder="Add details…"
//                 rows={4}
//                 maxLength={2000}
//                 disabled={submitting}
//               />
//             </div>
//           </div>
//           {composeError && <p className="text-sm text-destructive">{composeError}</p>}
//           <DialogFooter>
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => setComposeDate(null)}
//               disabled={submitting}
//             >
//               Cancel
//             </Button>
//             <Button type="button" onClick={submitEvent} disabled={submitting}>
//               {submitting ? 'Saving…' : 'Add Event'}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* View / delete dialog */}
//       <Dialog
//         open={!!viewing}
//         onOpenChange={(open) => {
//           if (!open && !deleting) {
//             setViewing(null)
//             setViewError(null)
//           }
//         }}
//       >
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>{viewing?.title}</DialogTitle>
//             {viewing && (
//               <DialogDescription>
//                 {formatLongDate(viewing.date)} • Posted by {authorName(viewing)}
//               </DialogDescription>
//             )}
//           </DialogHeader>
//           {viewing?.description && (
//             <div className="rounded-md bg-muted/40 border p-4 max-h-[50vh] overflow-y-auto">
//               <p className="text-sm whitespace-pre-wrap">{viewing.description}</p>
//             </div>
//           )}
//           {viewError && <p className="text-sm text-destructive">{viewError}</p>}
//           <DialogFooter>
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => setViewing(null)}
//               disabled={deleting}
//             >
//               Close
//             </Button>
//             {canDeleteViewing && (
//               <Button
//                 type="button"
//                 variant="destructive"
//                 onClick={deleteEvent}
//                 disabled={deleting}
//               >
//                 <Trash2 className="h-4 w-4 mr-1" />
//                 {deleting ? 'Deleting…' : 'Delete'}
//               </Button>
//             )}
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   )
// }

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { LocationPicker } from "@/components/custom/locationPicker";

interface EventDoc {
  _id: string;
  site: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  createdBy: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface EventsSearch {
  month?: string; // YYYY-MM
  site?: string;
}

// ── Strict Local Browser Time Helpers (Prevents UTC Drift) ─────────────────
const pad = (n: number) => String(n).padStart(2, "0");

function toIsoDate(d: Date): string {
  // Uses local browser Date methods explicitly
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getCurrentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function authorName(ev: EventDoc) {
  const f = ev.createdBy?.firstName || "";
  const l = ev.createdBy?.lastName || "";
  const full = `${f} ${l}`.trim();
  return full || ev.createdBy?.email || "Unknown";
}

export const Route = createFileRoute("/_navbarLayout/events/")({
  validateSearch: (search: Record<string, unknown>): EventsSearch => {
    return {
      month: typeof search?.month === "string" ? search.month : undefined,
      site: typeof search?.site === "string" ? search.site : undefined,
    };
  },
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const { search } = deps;
    try {
      const queryParams = new URLSearchParams();
      if (search.site) queryParams.set("site", search.site);
      if (search.month) queryParams.set("month", search.month);

      const res = await fetch(`/api/events?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      if (!res.ok) return { events: [] as EventDoc[] };
      const json = await res.json();
      return { events: (json.data || []) as EventDoc[] };
    } catch {
      return { events: [] as EventDoc[] };
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const router = useRouter();
  const search = Route.useSearch();
  const { selectedSite } = useSite();
  const { user } = useAuth();
  const { events } = Route.useLoaderData() as { events: EventDoc[] };

  // State Management linked with Context & Search Params
  const [site, setSite] = useState<string>(
    search.site || selectedSite || user?.location || "",
  );

  // Current Month representation: YYYY-MM
  const currentMonth = useMemo(() => {
    return search.month || getCurrentMonthIso();
  }, [search.month]);

  // Sync route search params when state changes or initial fallback is loaded
  useEffect(() => {
    const nextSite = site || selectedSite || user?.location || "";
    const nextMonth = currentMonth || getCurrentMonthIso();

    if (search.site !== nextSite || search.month !== nextMonth) {
      router.navigate({
        to: ".",
        search: (prev: any) => ({
          ...prev,
          site: nextSite || undefined,
          month: nextMonth,
        }),
        replace: true,
      });
    }
  }, [site, currentMonth, selectedSite, user?.location, search, router]);

  // Dialog & Form states
  const [composeDate, setComposeDate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<EventDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  // Computed based on Local Browser Date
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }, []);

  // Filter Today & Tomorrow Events separately
  const todayEvents = useMemo(() => {
    return events.filter((ev) => ev.date === todayIso);
  }, [events, todayIso]);

  const tomorrowEvents = useMemo(() => {
    return events.filter((ev) => ev.date === tomorrowIso);
  }, [events, tomorrowIso]);

  // Map events by date for fast tile rendering
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventDoc[]>();
    for (const ev of events) {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  // Calculate Month Grid using Local Browser Dates
  const { monthLabel, calendarGrid } = useMemo(() => {
    const [yearStr, monthStr] = currentMonth.split("-");
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const monthIndex = (parseInt(monthStr, 10) || 1) - 1;

    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

    const startWeekday = firstDayOfMonth.getDay();
    const totalDays = lastDayOfMonth.getDate();

    const grid: Array<{ iso: string; date: number; isCurrentMonth: boolean }> =
      [];

    const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, monthIndex - 1, prevMonthLastDay - i);
      grid.push({
        iso: toIsoDate(d),
        date: d.getDate(),
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, monthIndex, day);
      grid.push({ iso: toIsoDate(d), date: day, isCurrentMonth: true });
    }

    const remainingSlots = (7 - (grid.length % 7)) % 7;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, monthIndex + 1, i);
      grid.push({
        iso: toIsoDate(d),
        date: d.getDate(),
        isCurrentMonth: false,
      });
    }

    return {
      monthLabel: `${MONTH_LONG[monthIndex]} ${year}`,
      calendarGrid: grid,
    };
  }, [currentMonth]);

  const navigateMonth = (direction: -1 | 1) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    const newMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

    router.navigate({
      to: ".",
      search: (prev: any) => ({ ...prev, month: newMonth }),
    });
  };

  const goToToday = () => {
    const nowIso = getCurrentMonthIso();
    router.navigate({
      to: ".",
      search: (prev: any) => ({ ...prev, month: nowIso }),
    });
  };

  const openCompose = (iso: string) => {
    if (iso < todayIso) return;
    setComposeDate(iso);
    setTitle("");
    setDescription("");
    setComposeError(null);
  };

  const submitEvent = async () => {
    if (!composeDate) return;
    if (!title.trim()) {
      setComposeError("Title is required.");
      return;
    }
    setSubmitting(true);
    setComposeError(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          date: composeDate,
          site: site,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to create event.");
      }
      setComposeDate(null);
      await router.invalidate();
    } catch (err: any) {
      setComposeError(err?.message || "Failed to create event.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEvent = async () => {
    if (!viewing) return;
    setDeleting(true);
    setViewError(null);
    try {
      const res = await fetch(`/api/events/${viewing._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.message ||
            "Events can only be deleted by the owner of the event or an Admin.",
        );
      }

      setViewing(null);
      await router.invalidate();
    } catch (err: any) {
      setViewError(err?.message || "Failed to delete event.");
    } finally {
      setDeleting(false);
    }
  };

  // Frontend visibility rules: Only block if it's today/past or a Cycle Count event.
  // Authorization (Admin/Owner) is handled directly by backend response.
  const isPastOrToday = !!viewing && viewing.date <= todayIso;
  const isCycleCount = !!viewing && viewing.title?.startsWith("Cycle Count");

  const canDeleteViewing = !!viewing && !isPastOrToday && !isCycleCount;

  const formatLongDate = (iso: string) => {
    const d = parseIsoDate(iso);
    return `${MONTH_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  return (
    <div className="pt-4 pb-8 w-full flex flex-col items-center">
      <div className="w-full max-w-6xl px-3 sm:px-4 space-y-6">
        {/* Top Controls & Site Picker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-64">
            <LocationPicker
              setStationName={setSite}
              value="stationName"
              defaultValue={site}
            />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {site
              ? `Showing schedule for ${site}`
              : "Select a location to filter events"}
          </p>
        </div>

        {/* ── UPCOMING EVENTS SPOTLIGHT (SPLIT: TODAY & TOMORROW) ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Today's Events Window (2-event width grid) */}
          <div className="rounded-xl border bg-card p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-600" />
                Today{" "}
                <span className="text-muted-foreground font-normal">
                  [{todayIso}]
                </span>
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-medium"
              >
                {todayEvents.length} Event(s)
              </Badge>
            </div>

            {todayEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg bg-muted/20">
                No events scheduled for today.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-x-auto pb-1">
                {todayEvents.map((ev) => (
                  <Card
                    key={ev._id}
                    className="cursor-pointer hover:border-emerald-500/50 transition-all border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10"
                    onClick={() => {
                      setViewError(null);
                      setViewing(ev);
                    }}
                  >
                    <CardContent className="p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-semibold text-xs truncate"
                          title={ev.title}
                        >
                          {ev.title}
                        </span>
                        <Badge className="text-[9px] px-1 py-0 bg-emerald-600 text-white shrink-0">
                          Today
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium truncate">
                        By {authorName(ev)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Tomorrow's Events Window (2-event width grid) */}
          <div className="rounded-xl border bg-card p-3.5 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-600" />
                Tomorrow{" "}
                <span className="text-muted-foreground font-normal">
                  [{tomorrowIso}]
                </span>
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-medium"
              >
                {tomorrowEvents.length} Event(s)
              </Badge>
            </div>

            {tomorrowEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg bg-muted/20">
                No events scheduled for tomorrow.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-x-auto pb-1">
                {tomorrowEvents.map((ev) => (
                  <Card
                    key={ev._id}
                    className="cursor-pointer hover:border-blue-500/50 transition-all border-blue-500/20 bg-blue-50/30 dark:bg-blue-950/10"
                    onClick={() => {
                      setViewError(null);
                      setViewing(ev);
                    }}
                  >
                    <CardContent className="p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="font-semibold text-xs truncate"
                          title={ev.title}
                        >
                          {ev.title}
                        </span>
                        <Badge className="text-[9px] px-1 py-0 bg-blue-600 text-white shrink-0">
                          Tomorrow
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-medium truncate">
                        By {authorName(ev)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CALENDAR HEADER & CONTROLS ───────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Events Calendar
          </h1>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center rounded-md border bg-background">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateMonth(-1)}
                aria-label="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-sm font-semibold px-3 min-w-[110px] text-center">
                {monthLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateMonth(1)}
                aria-label="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── CALENDAR GRID ────────────────────────────────────────── */}
        <div className="border rounded-lg bg-background shadow-sm overflow-hidden touch-pan-y">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-semibold text-muted-foreground py-2.5">
            {WEEKDAY_SHORT.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y bg-muted/20">
            {calendarGrid.map(({ iso, date, isCurrentMonth }) => {
              const dayEvents = eventsByDate.get(iso) || [];
              const isToday = iso === todayIso;
              const isPast = iso < todayIso;

              return (
                <div
                  key={iso}
                  onClick={() => !isPast && openCompose(iso)}
                  className={`min-h-[100px] md:min-h-[120px] p-1.5 flex flex-col justify-between transition-colors ${
                    isPast
                      ? "bg-muted/40 cursor-not-allowed opacity-75"
                      : "cursor-pointer hover:bg-emerald-500/5 bg-background"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                >
                  {/* Top Bar inside cell */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-sm"
                          : isPast
                            ? "text-muted-foreground"
                            : "text-foreground font-medium"
                      }`}
                    >
                      {date}
                    </span>
                    {!isPast && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-80 md:opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-100 dark:hover:bg-emerald-950"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCompose(iso);
                        }}
                        title="Add Event"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Day Events Preview Stack */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[70px] md:max-h-[85px] scrollbar-none">
                    {dayEvents.map((ev) => {
                      const evIsPast = ev.date < todayIso;
                      return (
                        <button
                          key={ev._id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewError(null);
                            setViewing(ev);
                          }}
                          className={`w-full text-left truncate rounded px-1.5 py-1 text-[11px] font-medium border transition-all block ${
                            evIsPast
                              ? "bg-slate-200/60 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300/80"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20"
                          }`}
                          title={ev.title}
                        >
                          {ev.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compose Event Dialog */}
      <Dialog
        open={!!composeDate}
        onOpenChange={(open) => {
          if (!open && !submitting) setComposeDate(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              {composeDate && formatLongDate(composeDate)}
              {site && <> • {site}</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Title
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {title.length}/30
                </span>
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title (max 30 characters)"
                maxLength={30}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Description (optional)
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add event details…"
                rows={4}
                maxLength={2000}
                disabled={submitting}
              />
            </div>
          </div>
          {composeError && (
            <p className="text-sm text-destructive">{composeError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setComposeDate(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitEvent} disabled={submitting}>
              {submitting ? "Saving…" : "Add Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / Delete Event Dialog */}
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setViewing(null);
            setViewError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-4">
              <span className="break-words">{viewing?.title}</span>
              {viewing && (
                <Badge
                  variant={viewing.date < todayIso ? "secondary" : "default"}
                  className="text-[10px] shrink-0"
                >
                  {viewing.date < todayIso ? "Past Event" : "Upcoming"}
                </Badge>
              )}
            </DialogTitle>
            {viewing && (
              <DialogDescription>
                {formatLongDate(viewing.date)} • Posted by {authorName(viewing)}
              </DialogDescription>
            )}
          </DialogHeader>
          {viewing?.description && (
            <div className="rounded-md bg-muted/40 border p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">
                {viewing.description}
              </p>
            </div>
          )}
          {viewError && <p className="text-sm text-destructive">{viewError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewing(null)}
              disabled={deleting}
            >
              Close
            </Button>
            {canDeleteViewing && (
              <Button
                type="button"
                variant="destructive"
                onClick={deleteEvent}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
