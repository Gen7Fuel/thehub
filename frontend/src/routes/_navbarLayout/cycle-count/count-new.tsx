import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSocket } from "@/lib/websocket";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CycleCountTableGroup from "@/components/custom/CycleCountTableGroup"; // Our new helper
import { CheckCircle2, Star } from 'lucide-react';

export const Route = createFileRoute('/_navbarLayout/cycle-count/count-new')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<{ [id: string]: { foh: string; boh: string } }>({});

  const fetchData = async () => {
    if (!user?.location) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cycle-count/daily-items-v2?site=${encodeURIComponent(user.location)}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`,
          "X-Required-Permission": "cycleCount",
        }
      });

      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      const data = await res.json();
      setItems(data.items || []);

      const initial: any = {};
      data.items.forEach((item: any) => {
        initial[item.entryId] = {
          foh: item.foh != null ? String(item.foh) : "",
          boh: item.boh != null ? String(item.boh) : ""
        };
      });
      setCounts(initial);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.location]);

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

  // Logic to group data
  const priorityItems = items.filter(i => i.priority);
  const regularItems = items.filter(i => !i.priority);

  const grouped = regularItems.reduce((acc: any, item) => {
    const catName = item.categoryName;
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(item);
    return acc;
  }, {});

  const getGroupProgress = (catItems: any[]) => {
    const completed = catItems.filter(item => {
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

  // Calculate overall progress for a top progress bar
  const totalCompleted = items.filter(item => counts[item.entryId]?.foh !== "" && counts[item.entryId]?.boh !== "").length;
  const overallPercent = items.length > 0 ? (totalCompleted / items.length) * 100 : 0;

  if (loading) return <div className="p-8 text-center">Loading tablet view...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto pb-20">
      {/* TOP PROGRESS BAR - Keeps user motivated */}
      <div className="mb-6 sticky top-0 bg-white/80 backdrop-blur-md z-10 py-2">
        <div className="flex justify-between items-end mb-1">
          <h1 className="text-xl font-bold text-gray-800">Daily Count</h1>
          <span className="text-sm font-medium text-blue-600">{Math.round(overallPercent)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-500"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["priority"]} className="space-y-4">
        {/* 1. PRIORITY ACCORDION */}
        {priorityItems.length > 0 && (() => {
          const prog = getGroupProgress(priorityItems);
          return (
            <AccordionItem value="priority" className={`border-2 rounded-xl px-2 transition-all shadow-md ${prog.isDone ? 'border-green-500 bg-green-50/20' : 'border-blue-500 bg-white'}`}>
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${prog.isDone ? 'bg-green-500' : 'bg-blue-600'} text-white`}>
                      <Star className="w-5 h-5 fill-current" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-gray-800 text-lg">Admin Priority</div>
                      <div className="text-xs text-blue-600 font-semibold uppercase">High Importance</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${prog.isDone ? 'text-green-600' : 'text-blue-600'}`}>
                      {prog.count} / {prog.total}
                    </span>
                    {prog.isDone && <CheckCircle2 className="text-green-500 w-6 h-6" />}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CycleCountTableGroup items={priorityItems} counts={counts} isPriority={true} onInputChange={handleInputChange} onInputBlur={handleInputBlur} />
              </AccordionContent>
            </AccordionItem>
          );
        })()}

        {/* 2. REGULAR CATEGORIES */}
        {Object.entries(grouped).map(([catName, catItems]: [string, any]) => {
          const prog = getGroupProgress(catItems);
          return (
            <AccordionItem key={catName} value={catName} className={`border rounded-xl px-2 transition-all shadow-sm ${prog.isDone ? 'border-green-400 bg-green-50/10' : 'bg-white'}`}>
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full ${prog.isDone ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div className="text-left">
                      <div className={`font-bold ${prog.isDone ? 'text-green-700' : 'text-gray-800'}`}>{catName}</div>
                      <div className="text-xs text-gray-400">{catItems.length} items in this section</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500">{prog.count} / {prog.total}</span>
                    {prog.isDone && <CheckCircle2 className="text-green-500 w-5 h-5" />}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CycleCountTableGroup items={catItems} counts={counts} isPriority={false} onInputChange={handleInputChange} onInputBlur={handleInputBlur} />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}