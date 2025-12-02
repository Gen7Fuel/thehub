import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChecklistItemCard } from "@/components/custom/ChecklistItem";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { RouteContextVisitor } from "../visitor";
// import { getSocket } from "@/lib/websocket";
import { useAuth } from "@/context/AuthContext";


// const socket = getSocket();


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
  statusTemplate: string;
  followUpTemplate: string;
  assignedTo?: string;
  frequency?: "daily" | "weekly" | "monthly";
  lastChecked?: string;
  issueRaised?: boolean;
  requestOrder?: boolean;
  orderCreated?: boolean;
}

// interface AuditUpdatePayload {
//   template: string;
//   site: string;
//   frequencies: string[];
//   updatedItems: Partial<AuditItem>[]; // <-- Partial here
//   updatedAt: string;
// }

export const Route = createFileRoute('/_navbarLayout/audit/visitor/$id')({
  component: RouteComponent,
})

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

function RouteComponent() {
  const { id } = useParams({ from: "/_navbarLayout/audit/visitor/$id" });

  // Temporary patch for location picker getting state from ther parent
  const { stationName } = useContext(RouteContextVisitor);
  const { user } = useAuth();
  const site = stationName || user?.location || "";
  const navigate = useNavigate()
  console.log('site:',site)

  // const site = localStorage.getItem("location") || ""; //Original file
  const [items, setItems] = useState<AuditItem[]>([]);
  // const [displayItems, setDisplayItems] = useState<AuditItem[]>([]); // sorted for initial display / after save
  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "all">("all");
  const [currentDate] = useState(new Date());
  const [templateName, setTemplateName] = useState("");
  // Extract unique categories
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];

  // Build a stable color map
  const categoryColorMap: Record<string, { border: string; bg: string }> = {};
  categories.forEach((cat, idx) => {
    const key = cat ?? "unknown";
    categoryColorMap[key] = CATEGORY_COLOR_CLASSES[idx % CATEGORY_COLOR_CLASSES.length];
  });

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
  
  // Fetch checklist
  const fetchChecklist = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `/api/audit/items-full?templateId=${id}&site=${encodeURIComponent(
          site
        )}&date=${currentDate.toISOString()}&frequency=${frequency}&type=visitor`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Required-Permission": "stationAudit.visitor"
          },
        }
      );

      if (res.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
        return;
      }

      if (!res.ok) throw new Error("Failed to fetch checklist");

      const data = await res.json();

      setTemplateName(data.templateName || "");
      setItems(sortItems(data.items)); // optional: can skip if backend already sorts
    } catch (err) {
      console.error("Failed to fetch checklist:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    if (id && site) fetchChecklist();
  }, [id, site, frequency]);

  // useEffect(() => {
  //   if (!socket) return;

  //   socket.on("auditUpdated", (payload: AuditUpdatePayload) => {
  //     console.log("📡 Real-time audit update received:", payload);

  //     if (payload.template !== id || payload.site !== site) return;

  //     setItems((prev) => {
  //       const updatedMap = new Map(payload.updatedItems.map((i) => [i.item, i]));

  //       return prev.map((item) => {
  //         const update = updatedMap.get(item.item);

  //         // Merge the partial update into existing item and assert type
  //         return update ? ({ ...item, ...update } as AuditItem) : item;
  //       });
  //     });
  //   });

  //   return () => {
  //     socket.off("auditUpdated");
  //   };
  // }, [socket, id, site]);

  // Handlers
  const handleCheck = (idx: number, checked: boolean) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, checked } : item)));

  const handleComment = (idx: number, comment: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, comment } : item)));

  const handleFieldChange = (
    idx: number,
    field: "status" | "followUp" | "assignedTo" | "issueRaised" | "requestOrder",
    value: string | boolean
  ) =>
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

  const handlePhotos = (idx: number, photos: string[]) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, photos } : item)));

  const handleSave = async () => {
    setSaving(true);

    // 1️⃣ Check for raised-but-unchecked items
    const raisedButUnchecked = items.filter(item => item.issueRaised && !item.checked);
    if (raisedButUnchecked.length > 0) {
      alert(
        `Please check all items that have "Raise Issue" enabled before saving.\n` +
        `Items: ${raisedButUnchecked.map(i => i.item).join(", ")}`
      );
      setSaving(false);
      return;
    }

    const token = localStorage.getItem("token");
    const periodKey = getPeriodKey(frequency as any, currentDate);

    // 2️⃣ Check for Request Order items
    const newlyRequestedOrders = items.filter(item => item.requestOrder && !item.orderCreated);
    if (newlyRequestedOrders.length > 0) {
      alert(`Items requesting orders: ${newlyRequestedOrders.map(i => i.item).join(", ")}`);
    }

    try {
      const res = await fetch("/api/audit/visitor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Required-Permission": "stationAudit.visitor",
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

      if (res.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
        return;
      }

      const data = await res.json(); // parse JSON once

      if (!res.ok) {
        alert(data.error || "Failed to save checklist.");
      } else {
        alert("Checklist saved!");
      }

      // Use updated items from backend if available, otherwise fallback
      const updatedItems = data.updatedItems || items;

      const sorted = [...updatedItems].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        const aFreq = frequencyOrder[a.frequency || "daily"];
        const bFreq = frequencyOrder[b.frequency || "daily"];
        return aFreq - bFreq;
      });

      setItems(sorted);

    } catch (err) {
      console.error("Failed to save checklist:", err);
      alert("Error saving checklist.");
    } finally {
      setSaving(false);
    }
  }
  const totalItems = items.length;
  const checkedItems = items.filter(item => item.checked).length;
  const frequencies = ["all", "daily", "weekly", "monthly"] as const;

  type Frequency = typeof frequencies[number];

  interface FrequencyPickerProps {
    frequency: Frequency;
    setFrequency: React.Dispatch<React.SetStateAction<Frequency>>;
  }

  function FrequencyPicker({ frequency, setFrequency }: FrequencyPickerProps) {
    const currentIndex = frequencies.indexOf(frequency);
    const prevIndex = (currentIndex - 1 + frequencies.length) % frequencies.length;
    const nextIndex = (currentIndex + 1) % frequencies.length;

    return (
      <div className="flex items-center h-10 border rounded-md bg-white px-2 text-sm w-[160px] justify-between shadow-sm">

        {/* Left Arrow */}
        <button
          className="px-2 text-lg select-none"
          onClick={() => setFrequency(frequencies[prevIndex])}
        >
          ◀
        </button>

        {/* Center Value */}
        <div className="flex-1 text-center truncate px-1 font-normal text-sm capitalize">
          {frequency}
        </div>

        {/* Right Arrow */}
        <button
          className="px-2 text-lg select-none"
          onClick={() => setFrequency(frequencies[nextIndex])}
        >
          ▶
        </button>

      </div>
    );
  }


  return (
    <>
      {/* HEADER BAR */}
      <div className="flex items-center gap-6 mb-3">

        <FrequencyPicker frequency={frequency} setFrequency={setFrequency} />

        <div className="text-gray-600 text-sm whitespace-nowrap">
          Items checked {checkedItems} of {totalItems}
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-9 text-sm"
        >
          {saving ? "Saving..." : "Save Checklist"}
        </Button>

      </div>

      {/* Categories Legend */}
      <div className="flex flex-wrap gap-2 mb-3">

        {categories
          .filter((cat): cat is string => !!cat)
          .map((cat) => {
            const { bg, border } = categoryColorMap[cat];
            return (
              <div
                key={cat}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${border} bg-white shadow-sm`}
              >
                <div className={`w-2 h-2 rounded-sm ${bg}`}></div>
                <span className="text-xs text-gray-700">{cat}</span>
              </div>
            );
          })}
      </div>

      {/* Checklist Section */}
      {loading ? (
        <div>Loading...</div>
      ) : !items.length ? (
        <div>No checklist items for this template.</div>
      ) : (
        <>
          {/* Scrollable Cards Section */}
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-2 mb-4">
            {items.map((item, idx) => (
              <ChecklistItemCard
                key={item._id || idx}
                item={item}
                mode="station"
                type="visitor"
                templateName={templateName}
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
        </>
      )}
    </>
  );

}
