import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChecklistItemCard } from "@/components/custom/ChecklistItem";
import { Button } from "@/components/ui/button";

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
}

export const Route = createFileRoute("/_navbarLayout/audit/checklist/$id")({
  component: RouteComponent,
});

// Helper: periodKey generator
function getPeriodKey(frequency: "daily" | "weekly" | "monthly", date: Date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (frequency === "daily") {
    return d.toISOString().slice(0, 10); // e.g. 2025-09-26
  }
  if (frequency === "weekly") {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }
  if (frequency === "monthly") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
}
const frequencyOrder: Record<string, number> = { daily: 0, weekly: 1, monthly: 2 };

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

// function isFrequencyComplete(freq: "all" | "daily" | "weekly" | "monthly", items: AuditItem[]) {
//   if (freq === "all") {
//     return items.length > 0 && items.every(item => item.checked);
//   }
//   const freqItems = items.filter(item => item.frequency === freq);
//   return freqItems.length > 0 && freqItems.every(item => item.checked);
// }

// function getCompletedFrequencies(items: AuditItem[]) {
//   const completed: string[] = [];

//   if (items.length > 0 && items.every(item => item.checked)) {
//     completed.push("all");
//   }
//   if (items.some(item => item.frequency === "daily")) {
//     const daily = items.filter(i => i.frequency === "daily");
//     if (daily.length > 0 && daily.every(i => i.checked)) completed.push("daily");
//   }
//   if (items.some(item => item.frequency === "weekly")) {
//     const weekly = items.filter(i => i.frequency === "weekly");
//     if (weekly.length > 0 && weekly.every(i => i.checked)) completed.push("weekly");
//   }
//   if (items.some(item => item.frequency === "monthly")) {
//     const monthly = items.filter(i => i.frequency === "monthly");
//     if (monthly.length > 0 && monthly.every(i => i.checked)) completed.push("monthly");
//   }

//   return completed;
// }



function RouteComponent() {
  const { id } = useParams({ from: "/_navbarLayout/audit/checklist/$id" });
  const site = localStorage.getItem("location") || "";
  const [items, setItems] = useState<AuditItem[]>([]); // editable list
  // const [displayItems, setDisplayItems] = useState<AuditItem[]>([]); // sorted for initial display / after save
  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "all">("all");
  const [currentDate] = useState(new Date());
  // Extract unique categories
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];

  // Build a stable color map
  const categoryColorMap: Record<string, { border: string; bg: string }> = {};
  categories.forEach((cat, idx) => {
    const key = cat ?? "unknown";
    categoryColorMap[key] = CATEGORY_COLOR_CLASSES[idx % CATEGORY_COLOR_CLASSES.length];
  });

  // const [completedFrequencies, setCompletedFrequencies] = useState<string[]>([]);



  const sortItems = (list: AuditItem[]) => {
    return [...list].sort((a, b) => {
      // unchecked first
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      // then by frequency
      const aFreq = frequencyOrder[a.frequency || "daily"];
      const bFreq = frequencyOrder[b.frequency || "daily"];
      return aFreq - bFreq;
    });
  };


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

  // useEffect(() => {
  //   if (items.length > 0) {
  //     const sorted = [...items].sort((a, b) => {
  //       if (a.checked !== b.checked) return a.checked ? 1 : -1;
  //       const aFreq = frequencyOrder[a.frequency || "daily"];
  //       const bFreq = frequencyOrder[b.frequency || "daily"];
  //       return aFreq - bFreq;
  //     });
  //     // setDisplayItems(sorted);
  //   }
  // }, [items]); // only when items load


  // Fetch checklist
  const fetchChecklist = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      if (frequency !== "all") {
        // single frequency (daily/weekly/monthly)
        const periodKey = getPeriodKey(frequency, currentDate);

        const instanceRes = await fetch(
          `/api/audit/instance?template=${id}&site=${encodeURIComponent(
            site
          )}&frequency=${frequency}&periodKey=${periodKey}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (instanceRes.ok) {
          const instanceData = await instanceRes.json();
          if (instanceData?._id) {
            const itemsRes = await fetch(`/api/audit/items?instanceId=${instanceData._id}&templateId=${id}&site=${encodeURIComponent(
            site)}`, 
            {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (itemsRes.ok) {
              const itemsData = await itemsRes.json();
              setItems(sortItems(itemsData));
              setLoading(false);
              return;
            }
          }
        } 
        // fallback → template items
          const templateRes = await fetch(`/api/audit/${id}?frequency=${frequency}&site=${encodeURIComponent(site)}`, { headers: { Authorization: `Bearer ${token}` } });
          if (templateRes.ok) {
            const templateData = await templateRes.json();
          setItems(sortItems(
              (templateData.items || []).filter((item: AuditItem) => item.frequency === frequency).map((item: AuditItem) => ({
                ...item,
                checked: false,
                comment: "",
                photos: [],
              }))
            ));
          }
        
      } else {
        // "all" → merge daily, weekly, monthly
        const frequencies: ("daily" | "weekly" | "monthly")[] = ["daily", "weekly", "monthly"];
        const allItems: AuditItem[] = [];

        // fetch template once
        const templateRes = await fetch(`/api/audit/${id}?frequency=${frequency}&site=${encodeURIComponent(site)}`, { headers: { Authorization: `Bearer ${token}` } });
        const templateData = templateRes.ok ? await templateRes.json() : { items: [] };
        const templateItems: AuditItem[] = templateData.items || [];

        for (const freq of frequencies) {
          const periodKey = getPeriodKey(freq, currentDate);

          // check if instance exists
          const instanceRes = await fetch(
            `/api/audit/instance?template=${id}&site=${encodeURIComponent(site)}&frequency=${freq}&periodKey=${periodKey}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (instanceRes.ok) {
            const instanceData = await instanceRes.json();
            if (instanceData?._id) {
              const itemsRes = await fetch(`/api/audit/items?instanceId=${instanceData._id}&templateId=${id}&site=${encodeURIComponent(
            site)}`,  {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (itemsRes.ok) {
                const instanceItems = await itemsRes.json();
                allItems.push(...instanceItems);
                continue; // skip template fallback
              }
            }
          } 
            // fallback to template for this frequency
            const freqTemplateItems = templateItems
              .filter((item: AuditItem) => item.frequency === freq)
              .map((item: AuditItem) => ({
                ...item,
                checked: false,
                comment: "",
                photos: [],
              }));

            allItems.push(...freqTemplateItems);
        }

        setItems(sortItems(allItems));
      }
    } catch (err) {
      console.error("Failed to fetch checklist:", err);
      setItems([]);
    } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (id && site) fetchChecklist();
  }, [id, site, frequency]);

  // Handlers
  const handleCheck = (idx: number, checked: boolean) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, checked } : item)));

  const handleComment = (idx: number, comment: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, comment } : item)));

  const handleFieldChange = (
    idx: number,
    field: "status" | "followUp" | "assignedTo",
    value: string
  ) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const handlePhotos = (idx: number, photos: string[]) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, photos } : item)));

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem("token");
    const periodKey = getPeriodKey(frequency as any, currentDate);

    try {
      const res = await fetch("/api/audit/instance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          template: id,
          site,
          frequency,
          periodKey,
          items,
          date: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to save checklist.");
      } else {
        alert("Checklist saved!");
      }
    } catch (err) {
      console.error("Failed to save checklist:", err);
      alert("Error saving checklist.");
    } finally {
      setSaving(false);
      // sort after save
      const sorted = [...items].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        const aFreq = frequencyOrder[a.frequency || "daily"];
        const bFreq = frequencyOrder[b.frequency || "daily"];
        return aFreq - bFreq;
      });
      setItems(sorted); // update editable list with sorted order
      // setCompletedFrequencies(getCompletedFrequencies(items));
    }
  };

  return (
    <>
      {/* Frequency filter */}
      <div className="flex gap-4 mb-4">
        {["all", "daily", "weekly", "monthly"].map((f) => (
          <Button
            key={f}
            variant={frequency === f ? "default" : "outline"}
            onClick={() => setFrequency(f as any)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* <div className="flex gap-4 mb-4">
        {["all", "daily", "weekly", "monthly"].map((f) => {
          const isSelected = frequency === f;
          const isCompleted = completedFrequencies.includes(f);

          return (
            <Button
              key={f}
              onClick={() => setFrequency(f as any)}
              className={
                isCompleted
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : isSelected
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-100"
              }
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          );
        })}
      </div>
 */}



      {/* Catgroies Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {categories.filter((cat): cat is string => !!cat).map((cat) => {
          const { border, bg } = categoryColorMap[cat];
          return (
            <div
              key={cat}
              className={`flex items-center gap-1 px-2 py-1 rounded border ${border}`}
            >
              <div className={`w-4 h-4 ${bg} rounded-sm`}></div>
              <span className="text-sm">{cat}</span>
            </div>
          );
        })}
      </div>


      {/* Checklist form */}
      {loading ? (
        <div>Loading...</div>
      ) : !items.length ? (
        <div>No checklist items for this template.</div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="flex flex-col gap-4 mb-4">
            {items.map((item, idx) => (
              <ChecklistItemCard
                key={item._id || idx}
                item={item}
                onCheck={(checked) => handleCheck(idx, checked)}
                onComment={(comment) => handleComment(idx, comment)}
                onPhotos={(photos) => handlePhotos(idx, photos)}
                onFieldChange={(field, value) => handleFieldChange(idx, field, value)}
                selectTemplates={selectTemplates}
                borderColor={categoryColorMap[item.category || ""].border}
                lastChecked={item.lastChecked}
              />
            ))}
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Checklist"}
          </Button>
        </form>
      )}
    </>
  );
}
