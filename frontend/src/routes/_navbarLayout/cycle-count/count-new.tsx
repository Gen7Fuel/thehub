import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/websocket";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CycleCountTableGroup from "@/components/custom/CycleCountTableGroup"; // Our new helper
import { Check, CheckCircle2, Star, ArrowDownToLine } from "lucide-react";
import { useSite } from '@/context/SiteContext';
import { LocationPicker } from "@/components/custom/locationPicker";
import axios from "axios";

export const Route = createFileRoute('/_navbarLayout/cycle-count/count-new')({
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
  const [counts, setCounts] = useState<{ [id: string]: { foh: string; boh: string } }>({});
  const [movedToBottom, setMovedToBottom] = useState<string[]>([]);
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  const [varianceMap, setVarianceMap] = useState<{ [key: number]: number }>({});

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
          boh: item.boh != null ? String(item.boh) : ""
        };
      });
      setCounts(initial);

      // 2. FRESH LOAD LOGIC: Auto-complete categories already done in DB
      const autoCompleted: string[] = [];

      // Check Priority Section
      const prio = fetchedItems.filter((i: any) => i.priority);
      const prioDone = prio.length > 0 && prio.every((i:any) => i.foh != null && i.boh != null);
      if (prioDone) autoCompleted.push("priority_section");

      // Check Regular Categories
      const regItems = fetchedItems.filter((i: any) => !i.priority);
      const catMap: Record<string, any[]> = {};
      regItems.forEach((i:any) => {
        if (!catMap[i.categoryName]) catMap[i.categoryName] = [];
        catMap[i.categoryName].push(i);
      });

      Object.entries(catMap).forEach(([catName, catItems]) => {
        const isDone = catItems.every((i:any) => i.foh != null && i.boh != null);
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

  const handleInputBlur = async (id: string, field: "foh" | "boh", value: string) => {
    if (value === "") return;

    try {
      await fetch("/api/cycle-count/save-item-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "X-Required-Permission": "cycleCount",
        },
        body: JSON.stringify({
          entryId: id,
          field,
          value: Number(value),
          site: user?.location // Pass site for the socket room
        }),
      });
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  useEffect(() => {
    const socket = getSocket();

    // Listen for real-time updates from other tablets
    socket.on("cycle-count-field-updated", (data: { entryId: string; field: string; value: any; site: string }) => {
      // Only update if the update belongs to this site
      if (data.site === user?.location) {
        setCounts((prev) => ({
          ...prev,
          [data.entryId]: {
            ...prev[data.entryId],
            [data.field]: String(data.value),
          },
        }));
      }
    });

    return () => {
      socket.off("cycle-count-field-updated");
    };
  }, [user?.location]);

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
      return c && c.foh !== "" && c.boh !== "";
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

  // Calculate overall progress for a top progress bar
  const totalCompleted = items.filter(item => counts[item.entryId]?.foh !== "" && counts[item.entryId]?.boh !== "").length;
  const overallPercent = items.length > 0 ? (totalCompleted / items.length) * 100 : 0;

  if (loading) return <div className="p-8 text-center">Loading tablet view...</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto pb-32">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Cycle Count</h1>
          <div className="mt-2 w-64">
            <LocationPicker setStationName={setSite} value="stationName" defaultValue={site} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
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