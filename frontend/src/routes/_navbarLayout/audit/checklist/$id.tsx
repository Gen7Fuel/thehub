import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChecklistItemCard } from "@/components/custom/ChecklistItem";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { RouteContext } from "../checklist";
import { getSocket } from "@/lib/websocket";
import { useAuth } from "@/context/AuthContext";


const socket = getSocket();


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

interface AuditUpdatePayload {
  template: string;
  site: string;
  frequencies: string[];
  updatedItems: Partial<AuditItem>[]; // <-- Partial here
  updatedAt: string;
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

function RouteComponent() {
  const { id } = useParams({ from: "/_navbarLayout/audit/checklist/$id" });

  // Temporary patch for location picker getting state from ther parent
  const { stationName } = useContext(RouteContext);
  const { user } = useAuth();
  const site = stationName || user?.location || "";
  const navigate = useNavigate()
  
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
//   const fetchChecklist = async () => {
//     setLoading(true);
//     const token = localStorage.getItem("token");

//     try {
//       if (frequency !== "all") {
//         // single frequency (daily/weekly/monthly)
//         const periodKey = getPeriodKey(frequency, currentDate);

//         const instanceRes = await fetch(
//           `/api/audit/instance?template=${id}&site=${encodeURIComponent(
//             site
//           )}&frequency=${frequency}&periodKey=${periodKey}`,
//           { headers: { Authorization: `Bearer ${token}` } }
//         );

//         if (instanceRes.ok) {
//           const instanceData = await instanceRes.json();
//           if (instanceData?._id) {
//             const itemsRes = await fetch(`/api/audit/items?instanceId=${instanceData._id}&templateId=${id}&site=${encodeURIComponent(
//             site)}`, 
//             {
//               headers: { Authorization: `Bearer ${token}` },
//             });
//             if (itemsRes.ok) {
//               const itemsData = await itemsRes.json();
//               setItems(sortItems(itemsData));
//               setLoading(false);
//               return;
//             }
//             setTemplateName("");
//           }
//         } 
//         // fallback → template items
//           const templateRes = await fetch(`/api/audit/${id}?frequency=${frequency}&site=${encodeURIComponent(site)}`, { headers: { Authorization: `Bearer ${token}` } });
//           // console.log('site:',site)
//           if (templateRes.ok) {
//             const templateData = await templateRes.json();
//             setTemplateName(templateData.templateName || "");
//             setItems(sortItems(
//               (templateData.items || []).filter((item: AuditItem) => item.frequency === frequency).map((item: AuditItem) => ({
//                 ...item,
//                 checked: false,
//                 comment: "",
//                 photos: [],
//               }))
//             ));
//           }
        
//       } else {
//         // "all" → merge daily, weekly, monthly
//         const frequencies: ("daily" | "weekly" | "monthly")[] = ["daily", "weekly", "monthly"];
//         const allItems: AuditItem[] = [];

//         // fetch template once
//         const templateRes = await fetch(`/api/audit/${id}?frequency=${frequency}&site=${encodeURIComponent(site)}`, { headers: { Authorization: `Bearer ${token}` } });
//         const templateData = templateRes.ok ? await templateRes.json() : { items: [] };
//         const templateItems: AuditItem[] = templateData.items || [];

//         for (const freq of frequencies) {
//           const periodKey = getPeriodKey(freq, currentDate);

//           // check if instance exists
//           const instanceRes = await fetch(
//             `/api/audit/instance?template=${id}&site=${encodeURIComponent(site)}&frequency=${freq}&periodKey=${periodKey}`,
//             { headers: { Authorization: `Bearer ${token}` } }
//           );

//           if (instanceRes.ok) {
//             const instanceData = await instanceRes.json();
//             if (instanceData?._id) {
//               const itemsRes = await fetch(`/api/audit/items?instanceId=${instanceData._id}&templateId=${id}&site=${encodeURIComponent(
//             site)}`,  {
//                 headers: { Authorization: `Bearer ${token}` },
//               });
//               if (itemsRes.ok) {
//                 const instanceItems = await itemsRes.json();
//                 allItems.push(...instanceItems);
//                 setTemplateName("");
//                 continue; // skip template fallback
//               }
//             }
//           } 
//           // fallback to template for this frequency
//           const freqTemplateItems = templateItems
//             .filter((item: AuditItem) => item.frequency === freq)
//             .map((item: AuditItem) => ({
//               ...item,
//               checked: false,
//               comment: "",
//               photos: [],
//             }));
//             setTemplateName(templateData.templateName || "");

//           allItems.push(...freqTemplateItems);
//         }

//         setItems(sortItems(allItems));
//       }
//     } catch (err) {
//       console.error("Failed to fetch checklist:", err);
//       setItems([]);
//     } finally {
//     setLoading(false);
//   }
// };
  const fetchChecklist = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `/api/audit/items-full?templateId=${id}&site=${encodeURIComponent(
          site
        )}&date=${currentDate.toISOString()}&frequency=${frequency}`,
        {
          headers: { Authorization: `Bearer ${token}`,
          "X-Required-Permission": "stationAudit" },
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

  useEffect(() => {
    if (!socket) return;

    socket.on("auditUpdated", (payload: AuditUpdatePayload) => {
      console.log("📡 Real-time audit update received:", payload);

      if (payload.template !== id || payload.site !== site) return;

      setItems((prev) => {
        const updatedMap = new Map(payload.updatedItems.map((i) => [i.item, i]));

        return prev.map((item) => {
          const update = updatedMap.get(item.item);

          // Merge the partial update into existing item and assert type
          return update ? ({ ...item, ...update } as AuditItem) : item;
        });
      });
    });

    return () => {
      socket.off("auditUpdated");
    };
  }, [socket, id, site]);

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
      const res = await fetch("/api/audit/instance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Required-Permission": "stationAudit",
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

      {/* Categories Legend */}
      <div className="flex gap-4 mb-4 flex-wrap">
        {categories
          .filter((cat): cat is string => !!cat)
          .map((cat) => {
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

      {/* Checklist Section */}
      {loading ? (
        <div>Loading...</div>
      ) : !items.length ? (
        <div>No checklist items for this template.</div>
      ) : (
        <>
          {/* Top Bar: Save button (left) + Summary (right) */}
          <div className="flex items-center justify-between mb-3 px-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mr-4"
            >
              {saving ? "Saving..." : "Save Checklist"}
            </Button>

            <div className="text-gray-500 text-medium">
              Items checked {checkedItems} of {totalItems}
            </div>
          </div>

          {/* Scrollable Cards Section */}
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2 mb-4">
            {items.map((item, idx) => (
              <ChecklistItemCard
                key={item._id || idx}
                item={item}
                mode="station"
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
