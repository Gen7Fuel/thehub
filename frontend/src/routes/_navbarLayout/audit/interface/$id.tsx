import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChecklistItemCard } from "@/components/custom/ChecklistItem";
import { useContext } from "react";
import { RouteContext } from "../interface";
import { useAuth } from "@/context/AuthContext";


interface SelectOption {
  text: string;
  _id: string;
}

interface SelectTemplate {
  _id: string;
  name: string;
  options: SelectOption[];
}

interface AuditItem {
  _id?: string;
  item: string;
  checkboxId?: string;
  required: boolean;
  checked?: boolean;
  comment?: string;
  photos?: string[];
  category?: string;
  status?: string;
  followUp?: string;
  assignedTo?: string;
  frequency?: "daily" | "weekly" | "monthly";
  lastChecked?: string;
  checkedAt?: string;
  statusTemplate: string;
  followUpTemplate: string;
}

export const Route = createFileRoute("/_navbarLayout/audit/interface/$id")({
  component: RouteComponent,
});

// 🔹 periodKey generator
function getPeriodKey(frequency: "daily" | "weekly" | "monthly", date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (frequency === "daily") return d.toISOString().slice(0, 10);
  if (frequency === "weekly") {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }
  if (frequency === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function RouteComponent() {
  const { id } = useParams({ from: "/_navbarLayout/audit/interface/$id" });
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  
  const token = localStorage.getItem("token");
  const { stationName } = useContext(RouteContext);
  const { user } = useAuth()
  const site = stationName || user?.location || "";
    

  const shiftDate = (direction: number) => {
    const newDate = new Date(currentDate);

    if (frequency === "daily") newDate.setDate(newDate.getDate() + direction);
    else if (frequency === "weekly") newDate.setDate(newDate.getDate() + 7 * direction);
    else if (frequency === "monthly") newDate.setMonth(newDate.getMonth() + direction);

    setCurrentDate(newDate);
  };

  const fetchItemsForInstance = async () => {
    if (!id || !currentDate) return;
    setLoading(true);
    try {
      const periodKey = getPeriodKey(frequency, currentDate);

      const instanceRes = await fetch(
        `/api/audit/instance?template=${id}&site=${encodeURIComponent(site)}&frequency=${frequency}&periodKey=${periodKey}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!instanceRes.ok) throw new Error("Failed to fetch instance");

      const instanceData = await instanceRes.json();
      if (!instanceData?._id) {
        setItems([]); // reset items if none
        return;
      }

      const itemsRes = await fetch(
        `/api/audit/items?instanceId=${instanceData._id}&templateId=${id}&site=${encodeURIComponent(site)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!itemsRes.ok) throw new Error("Failed to fetch items");

      const itemsData = await itemsRes.json();
      setItems(sortItems(itemsData));
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemsForInstance();
  }, [frequency, currentDate, id, site, token]);

  // Load dropdown select templates
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch("/api/audit/select-templates", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setSelectTemplates)
      .catch(() => setSelectTemplates([]));
  }, []);

  const formatDisplay = () => {
    if (frequency === "daily") return currentDate.toLocaleDateString();
    if (frequency === "weekly") {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
      return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
    }
    if (frequency === "monthly") return currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = new Date(e.target.value);
    selected.setHours(0, 0, 0, 0);
    setCurrentDate(selected);
    setPickerOpen(false);
  };

  const handleWeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [year, week] = e.target.value.split("-W").map(Number);
    const firstJan = new Date(year, 0, 1);
    const dayOffset = ((week - 1) * 7) - firstJan.getDay();
    const d = new Date(firstJan);
    d.setDate(firstJan.getDate() + dayOffset);
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
    setPickerOpen(false);
  };

  const CATEGORY_COLOR_CLASSES = [
    { border: "border-blue-200", bg: "bg-blue-200" },
    { border: "border-yellow-200", bg: "bg-yellow-200" },
    { border: "border-purple-200", bg: "bg-purple-200" },
    { border: "border-orange-200", bg: "bg-orange-200" },
    { border: "border-pink-200", bg: "bg-pink-200" },
    { border: "border-indigo-200", bg: "bg-indigo-200" },
    { border: "border-teal-200", bg: "bg-teal-200" },
    { border: "border-cyan-200", bg: "bg-cyan-200" },
  ];

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];

  // Build a stable color map
  const categoryColorMap: Record<string, { border: string; bg: string }> = {};
  categories.forEach((cat, idx) => {
    const key = cat ?? "unknown";
    categoryColorMap[key] = CATEGORY_COLOR_CLASSES[idx % CATEGORY_COLOR_CLASSES.length];
  });

  return (
    <div className="p-4">
      {/* 🔹 Sticky Controls */}
      <div className="sticky top-0 bg-white z-20 pb-2">
        {/* Frequency Tabs */}
        <div className="flex justify-center gap-2 mb-4">
          {["daily", "weekly", "monthly"].map((f) => (
            <Button
              key={f}
              variant={frequency === f ? "default" : "outline"}
              onClick={() => setFrequency(f as any)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>

        {/* Period Navigation */}
        <div className="flex justify-center items-center gap-4 mb-4">
          <Button onClick={() => shiftDate(-1)}>⬅ Prev</Button>

          <div className="relative">
            <span
              className="font-medium cursor-pointer border-b border-dotted"
              onClick={() => setPickerOpen(!pickerOpen)}
            >
              {formatDisplay()}
            </span>

            {pickerOpen && frequency === "daily" && (
              <input
                type="date"
                className="absolute mt-1 border rounded p-1 z-10 bg-white"
                value={currentDate.toISOString().slice(0, 10)}
                onChange={handleDateChange}
                onBlur={() => setPickerOpen(false)}
              />
            )}

            {pickerOpen && frequency === "weekly" && (
              <input
                type="week"
                className="absolute mt-1 border rounded p-1 z-10 bg-white"
                value={`${currentDate.getFullYear()}-W${getWeekNumber(currentDate)}`}
                onChange={handleWeekChange}
                onBlur={() => setPickerOpen(false)}
              />
            )}

            {pickerOpen && frequency === "monthly" && (
              <input
                type="month"
                className="absolute mt-1 border rounded p-1 z-10 bg-white"
                value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`}
                onChange={handleDateChange}
                onBlur={() => setPickerOpen(false)}
              />
            )}
          </div>

          <Button onClick={() => shiftDate(1)}>Next ➡</Button>
        </div>
      </div>

      {loading && <div className="text-center">Loading items...</div>}

      {/* Items */}
      {!loading && items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((item, idx) => (
            <ChecklistItemCard
              key={item._id || idx}
              item={item}
              mode="interface"
              selectTemplates={selectTemplates}
              borderColor={categoryColorMap[item.category || ""].border}
              lastChecked={item.lastChecked}
            />
          ))}
        </div>
      ) : (
        !loading && <div className="text-gray-500 text-center">No completed and saved checklists found for this date.</div>
      )}
    </div>
  );

}

// 🔹 helper to sort items
function sortItems(items: AuditItem[]) {
  return items.sort((a, b) => a.item.localeCompare(b.item));
}

// 🔹 get week number
function getWeekNumber(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7));
}
