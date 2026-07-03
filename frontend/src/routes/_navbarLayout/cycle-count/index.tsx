import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/websocket";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CycleCountTableGroup from "@/components/custom/CycleCountTableGroup"; // Our new helper
import { Check, CheckCircle2, Star, ArrowDownToLine, Info } from "lucide-react";
import { useSite } from '@/context/SiteContext';
import { LocationPicker } from "@/components/custom/locationPicker";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute('/_navbarLayout/cycle-count/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedSite } = useSite();
  const [site, setSite] = useState(selectedSite || user?.location || "");
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ [id: string]: Record<string, string> }>({});
  const [movedToBottom, setMovedToBottom] = useState<string[]>([]);
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  const [varianceMap, setVarianceMap] = useState<{ [key: number]: number }>({});
  const [syncing, setSyncing] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);

  interface CycleCountFieldUpdateV2 {
    entryId: string;
    field: "foh" | "boh";
    value: number | string;
    site?: string;
    breakdown?: {
      packs?: number | string;
      cartons?: number | string;
      // cases?: number | string;
    } | null;
  }

  // 1. Fetch data based on the LOCAL 'site' state (connected to LocationPicker)
  const fetchData = async () => {
    if (!site) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cycle-count/daily-items-v2?site=${encodeURIComponent(site)}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
          "X-Required-Permission": "cycleCount",
        }
      });
      if (res.status === 403) { navigate({ to: "/no-access" }); return; }

      const data = await res.json();
      const fetchedItems = data.items || [];
      setItems(fetchedItems);

      // 1. Prepare initial counts
      const initial: any = {};
      fetchedItems.forEach((item: any) => {
        initial[item.entryId] = {
          foh: item.foh != null ? String(item.foh) : "",
          boh: item.boh != null ? String(item.boh) : "",
          foh_crt: item.foh_crt ?? "",
          // foh_case: item.foh_case ?? "",
          boh_crt: item.boh_crt ?? "",
          // boh_case: item.boh_case ?? ""
        };
      });
      setCounts(initial);

      // 2. FRESH LOAD LOGIC: Auto-complete categories already done in DB
      const autoCompleted: string[] = [];

      // Check Priority Section
      const prio = fetchedItems.filter((i: any) => i.priority);
      const prioDone = prio.length > 0 && prio.every((i: any) => isItemCountComplete(i, initial[i.entryId]));
      if (prioDone) autoCompleted.push("priority_section");

      // Check Regular Categories
      const regItems = fetchedItems.filter((i: any) => !i.priority);
      const catMap: Record<string, any[]> = {};
      regItems.forEach((i: any) => {
        if (!catMap[i.categoryName]) catMap[i.categoryName] = [];
        catMap[i.categoryName].push(i);
      });

      Object.entries(catMap).forEach(([catName, catItems]) => {
        const isDone = catItems.every((i: any) => isItemCountComplete(i, initial[i.entryId]));
        if (isDone) autoCompleted.push(catName);
      });

      // Update states so they are already at the bottom and marked locked
      setCompletedCategories(autoCompleted);
      setMovedToBottom(autoCompleted);

    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [site]);

  const handleInputChange = (id: string, field: "foh" | "boh", value: string) => {
    setCounts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  // const handleInputBlur = async (id: string, field: "foh" | "boh", value: string) => {
  //   if (value === "") return;

  //   try {
  //     await fetch("/api/cycle-count/save-item-v2", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "Authorization": `Bearer ${localStorage.getItem("token")}`,
  //         "X-Required-Permission": "cycleCount",
  //       },
  //       body: JSON.stringify({
  //         entryId: id,
  //         field,
  //         value: Number(value),
  //         site: user?.location // Pass site for the socket room
  //       }),
  //     });
  //   } catch (err) {
  //     console.error("Save failed", err);
  //   }
  // };

  const handleInputBlur = async (
    id: string,
    field: "foh" | "boh",
    data: string | Record<string, string | number>
  ) => {
    let numericValue: number;
    let breakdown = null;

    // 1. Identify data shape
    if (typeof data === "object") {
      numericValue = Number(data[field] ?? 0);
      breakdown = {
        packs: Number(data[field] ?? 0),
        cartons: Number(data[`${field}_crt`] ?? 0),
        // cases: Number(data[`${field}_case`] ?? 0),
      };
    } else {
      numericValue = Number(data);
      if (isNaN(numericValue) || data.trim() === "") return;
    }

    // 2. OPTIMISTIC UI UPDATE: Update local state immediately so inputs feel snappy and responsive
    setCounts((prev: any) => {
      const currentItem = prev[id] || {};

      if (typeof data === "object") {
        return {
          ...prev,
          [id]: {
            ...currentItem,
            [field]: String(breakdown?.packs ?? 0),
            [`${field}_crt`]: String(breakdown?.cartons ?? 0),
            // [`${field}_case`]: String(breakdown?.cases ?? 0),
          }
        };
      } else {
        // Standard input path
        return {
          ...prev,
          [id]: {
            ...currentItem,
            [field]: String(numericValue)
          }
        };
      }
    });

    // 3. Database Sync Path
    try {
      const res = await fetch("/api/cycle-count/save-item-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "cycleCount",
        },
        body: JSON.stringify({
          entryId: id,
          field,
          value: numericValue, // This updates the main loose pack column
          breakdown,           // This contains packs and cartons for your columns
          site,
        }),
      });

      if (res.ok) {
        const socket = getSocket();
        socket.emit("cycle-count-field-updated-v2", {
          entryId: id,
          field,
          value: numericValue,
          breakdown,
          site,
        });
      } else {
        // Optional: Handle error rollbacks if your backend rejects the save 
        console.error("Server rejected the cycle count update");
      }
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  useEffect(() => {
    const socket = getSocket();

    function updateField({ entryId, field, value, breakdown, site: updateSite }: CycleCountFieldUpdateV2) {
      if (updateSite && updateSite !== site) return;

      setCounts((prev) => {
        const currentItem = prev[entryId] || {};
        const nextItem = {
          ...currentItem,
          [field]: String(value),
        };

        if (breakdown) {
          nextItem[field] = String(breakdown.packs ?? value);
          nextItem[`${field}_crt`] = String(breakdown.cartons ?? 0);
          // nextItem[`${field}_case`] = String(breakdown.cases ?? 0);
        }

        return {
          ...prev,
          [entryId]: nextItem,
        };
      });
    }

    socket.on("cycle-count-field-updated-v2", updateField);

    return () => {
      socket.off("cycle-count-field-updated-v2", updateField);
    };
  }, [site]);

  useEffect(() => {
    const fetchVariance = async () => {
      try {
        const res = await axios.get("/api/product-category/cycle-count-variance", {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
            "X-Required-Permission": "cycleCount",
          },
        });
        setVarianceMap(res.data.varianceMap || {});
      } catch (err) {
        console.error("Failed to fetch variance map", err);
      }
    };
    fetchVariance();
  }, []);

  const getVarianceForItem = (categoryNumber?: number) => {
    if (!categoryNumber) return 10;
    return varianceMap[categoryNumber] ?? 10;
  };

  // Logic to group data
  const priorityItems = items.filter(i => i.priority);
  const regularItems = items.filter(i => !i.priority);

  const grouped = regularItems.reduce((acc: any, item: any) => {
    const catName = item.categoryName;
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  const getGroupProgress = (catItems: any[]) => {
    const completed = catItems.filter((item: any) => {
      const c = counts[item.entryId];
      return isItemCountComplete(item, c);
    }).length;
    return {
      count: completed,
      total: catItems.length,
      isDone: completed === catItems.length && catItems.length > 0,
      percent: (completed / catItems.length) * 100
    };
  };

  const handleMarkComplete = (catName: string) => {
    setCompletedCategories(prev => [...prev, catName]);
    if (!movedToBottom.includes(catName)) {
      setMovedToBottom(prev => [...prev, catName]);
    }
    // Close the accordion when manually finishing
    setOpenItems(prev => prev.filter(id => id !== catName));
  };

  const handleUndoComplete = (catName: string) => {
    setCompletedCategories(prev => prev.filter(id => id !== catName));
    // We keep it in movedToBottom so it stays at the end of the list
  };

  // 2. Updated Sort Logic
  const processedGroups = useMemo(() => {
    const groups = Object.entries(grouped).map(([catName, catItems]: [string, any]) => {
      const prog = getGroupProgress(catItems);
      return {
        name: catName,
        items: catItems,
        progress: prog,
        isMarkedDone: completedCategories.includes(catName),
        hasBeenMoved: movedToBottom.includes(catName)
      };
    });

    return groups.sort((a, b) => {
      // If one has been moved to bottom and the other hasn't
      if (a.hasBeenMoved !== b.hasBeenMoved) {
        return a.hasBeenMoved ? 1 : -1;
      }
      // If both are in the same section (top or bottom), sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [grouped, counts, completedCategories, movedToBottom]);
  // 3. Auto-collapse + Move Logic
  useEffect(() => {
    processedGroups.forEach((group: any) => {
      if (group.isDone && openItems.includes(group.name)) {
        setTimeout(() => {
          setOpenItems(prev => prev.filter(id => id !== group.name));
        }, 800); // Slightly longer delay to let the user see the "Done" state
      }
    });
  }, [processedGroups]);

  const toggleAll = (open: boolean) => {
    if (open) {
      const allNames = processedGroups.map(g => g.name);
      if (priorityItems.length > 0) allNames.push("priority");
      setOpenItems(allNames);
    } else {
      setOpenItems([]);
    }
  };

  // 🚀 Dedicated sync handler function
  const handleFinalizeAndSync = async () => {
    const confirmation = window.confirm(
      "Make sure all the counts are correct and submit only when all counts for the day have been completed. This will create tickets for all the items which have been counted on the hub. Proceed with completion of the count?"
    );
    if (!confirmation) return;

    setSyncing(true);
    try {
      // Captures today's date formatted as 'YYYY-MM-DD'
      const todayStr = new Date().toISOString().split("T")[0];

      const response = await axios.post(
        "/api/cycle-count/finalize-and-sync",
        {
          siteName: site,
          targetDate: todayStr,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
            "X-Required-Permission": "cycleCount",
          },
        }
      );

      if (response.data.success) {
        alert("Cycle Count pushed successfully!");
      } else {
        alert(`⚠️ Sync flagged: ${response.data.reason || "Unknown response processing state."}`);
      }
    } catch (err: any) {
      console.error("Pipeline Sync Fault:", err);
      alert(err.response?.data?.message || "❌ CRITICAL Exception running automated data transmission.");
    } finally {
      setSyncing(false);
    }
  };

  // Calculate overall progress for a top progress bar
  const totalCompleted = items.filter(item => isItemCountComplete(item, counts[item.entryId])).length;
  const overallPercent = items.length > 0 ? (totalCompleted / items.length) * 100 : 0;

  if (loading) return <div className="p-8 text-center">Loading tablet view...</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto pb-32">
      {/* 💡 DISCLAIMER POPUP MODAL */}
      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="max-w-md p-6 bg-white rounded-xl shadow-xl border">
          <DialogHeader className="flex flex-row items-center gap-3 border-b pb-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Info className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-black text-gray-900 tracking-tight">
              Important: Process Change
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              We have upgraded our system workflow. You <strong>no longer need to use your handheld scanner device's Retail 360 app</strong> to create baskets for your regular inventory updates. 
            </p>
            <p className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-lg font-medium">
              Simply input all of your physical stock numbers directly into the input fields here on the Hub.
            </p>
            <p>
              Once you have finished checking every inventory category, you must click the green <strong>"Finalize Counts" button at the top of the page</strong> to submit the daily batch, generate tickets, and automatically push your final counts to the system.
            </p>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-bold rounded-lg shadow-md transition-all"
            >
              Ok, I understand
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cycle Count</h1>
          <div className="mt-2 w-64">
            <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => toggleAll(true)}
              className="text-xs font-bold px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="text-xs font-bold px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              Collapse All
            </button>

            {/* Clean button calling the isolated handler function */}
            <button
              disabled={overallPercent === 0 || syncing}
              onClick={handleFinalizeAndSync}
              className={`text-xs font-bold px-4 py-2 text-white rounded-lg shadow-md transition-all ${overallPercent === 0
                  ? "bg-gray-300 cursor-not-allowed opacity-60"
                  : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"
                }`}
            >
              {syncing ? "Processing Sync..." : "Finalize Counts"}
            </button>
          </div>
          <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Overall: {Math.round(overallPercent)}%
          </span>
        </div>
      </div>

      {/* STICKY GLOBAL PROGRESS BAR */}
      <div className="mb-8 sticky top-0 bg-white/95 backdrop-blur-md z-30 py-3 border-b border-gray-100">
        <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden shadow-inner">
          <div
            className="bg-blue-600 h-full transition-all duration-1000"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-6">

        {/* 1. PRIORITY SECTION */}
        {priorityItems.length > 0 && (() => {
          const prog = getGroupProgress(priorityItems);
          const isMarkedDone = completedCategories.includes("priority_section");
          const canComplete = prog.isDone && !isMarkedDone;

          return (
            <AccordionItem
              value="priority"
              className={`border-2 rounded-2xl transition-all shadow-md overflow-visible
          ${isMarkedDone ? 'bg-green-50/20 border-green-400 opacity-90' : 'border-blue-600 bg-white'}
        `}
            >
              <div className="sticky top-[52px] z-20 bg-inherit rounded-t-2xl border-b border-gray-100">
                <AccordionTrigger className="hover:no-underline py-5 px-4">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl shadow-lg ${isMarkedDone ? 'bg-green-500' : 'bg-blue-600'} text-white`}>
                        <Star className="w-6 h-6 fill-current" />
                      </div>
                      <div className="text-left">
                        <div className="font-black text-gray-900 text-xl tracking-tight">Priority List</div>
                        <div className="text-xs font-bold uppercase tracking-widest text-blue-600">High Importance</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4" onClick={(e) => e.stopPropagation()}>
                      {canComplete && (
                        <button
                          onClick={() => handleMarkComplete("priority_section")}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          Mark Completed
                        </button>
                      )}
                      <span className="text-lg font-black text-gray-700">{prog.count}/{prog.total}</span>
                      {isMarkedDone && <CheckCircle2 className="text-green-500 w-6 h-6" />}
                    </div>
                  </div>
                </AccordionTrigger>
              </div>
              <AccordionContent className="px-4 pt-4 pb-6">
                <div className="relative">
                  {isMarkedDone && (
                    <div className="absolute inset-0 z-10 bg-gray-50/40 rounded-xl flex items-start justify-center pt-4 pointer-events-none">
                      <div className="bg-white/90 border border-green-200 px-4 py-2 rounded-full shadow-sm flex items-center gap-3 pointer-events-auto">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="font-bold text-xs text-gray-600 uppercase tracking-wider">Count Verified</span>
                        <button
                          onClick={() => handleUndoComplete("priority_section")}
                          className="text-xs font-bold text-blue-600 hover:underline border-l pl-3 ml-1"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={isMarkedDone ? "opacity-50 pointer-events-none" : ""}>
                    <CycleCountTableGroup items={priorityItems} counts={counts} isPriority={true} onInputChange={handleInputChange} onInputBlur={handleInputBlur} getVarianceForItem={getVarianceForItem} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })()}

        {/* 2. REGULAR DYNAMIC CATEGORIES */}
        {processedGroups.map((group) => {
          const canComplete = group.progress.isDone && !group.isMarkedDone;

          return (
            <AccordionItem
              key={group.name}
              value={group.name}
              className={`border-2 rounded-2xl transition-all duration-500 overflow-visible
          ${group.isMarkedDone ? 'bg-gray-50/50 border-green-200' : 'bg-white border-gray-200 shadow-sm'}
        `}
            >
              <div className="sticky top-[52px] z-20 bg-inherit rounded-t-2xl border-b border-gray-100">
                <AccordionTrigger className="hover:no-underline py-5 px-4">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${group.isMarkedDone ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div className="text-left truncate">
                        <div className={`font-bold text-lg truncate ${group.isMarkedDone ? 'text-gray-500' : 'text-gray-900'}`}>
                          {group.name}
                        </div>
                        <div className="text-xs font-medium text-gray-400">
                          {group.progress.count} / {group.progress.total} Items
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-4" onClick={(e) => e.stopPropagation()}>
                      {canComplete && (
                        <button
                          onClick={() => handleMarkComplete(group.name)}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          Mark Completed
                        </button>
                      )}
                      {group.isMarkedDone && <CheckCircle2 className="text-green-500 w-6 h-6" />}
                      {!group.isMarkedDone && !canComplete && (
                        <div className="text-sm font-black text-gray-400 bg-gray-50 px-3 py-1 rounded-lg">
                          {group.progress.total - group.progress.count} Left
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
              </div>

              <AccordionContent className="px-4 pt-4 pb-6">
                <div className="relative">
                  {group.isMarkedDone && (
                    <div className="absolute inset-0 z-10 bg-gray-50/30 flex items-start justify-center pt-6 pointer-events-none">
                      <div className="bg-white/95 border border-gray-200 shadow-lg p-3 rounded-xl flex items-center gap-4 pointer-events-auto transition-transform active:scale-95">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="font-bold text-gray-600 text-sm">Category Count Completed</span>
                        </div>
                        <button
                          onClick={() => handleUndoComplete(group.name)}
                          className="bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-xs font-black hover:bg-blue-100 transition-colors"
                        >
                          EDIT COUNT
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={group.isMarkedDone ? "opacity-40 pointer-events-none" : ""}>
                    <CycleCountTableGroup items={group.items} counts={counts} isPriority={false} onInputChange={handleInputChange} onInputBlur={handleInputBlur} getVarianceForItem={getVarianceForItem} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

function hasValue(value: unknown) {
  return value !== "" && value !== null && value !== undefined;
}

function isSideComplete(item: any, counts: Record<string, string> | undefined, field: "foh" | "boh") {
  if (!counts || !hasValue(counts[field])) return false;
  if (item.pk_in_crt && !hasValue(counts[`${field}_crt`])) return false;
  // if (item.pk_in_crt && item.crt_in_case && !hasValue(counts[`${field}_case`])) return false;
  return true;
}

function isItemCountComplete(item: any, counts: Record<string, string> | undefined) {
  return isSideComplete(item, counts, "foh") && isSideComplete(item, counts, "boh");
}
