// import { createFileRoute, useParams } from '@tanstack/react-router'
// import { useEffect, useState } from 'react'
// import { ChecklistItemCard } from "@/components/custom/ChecklistItem";
// import { Button } from "@/components/ui/button";

// interface SelectOption {
//   text: string;
//   _id: string;
// }

// interface SelectTemplate {
//   _id: string;
//   name: string;
//   options: SelectOption[];
// }

// interface AuditItem {
//   _id?: string;
//   item: string;
//   checkboxId: string;
//   required: boolean;
//   checked?: boolean;
//   comment?: string;
//   photos?: string[];
//   // New fields:
//   category?: string;
//   status?: string;
//   followUp?: string;
//   assignedTo?: string;
// }

// export const Route = createFileRoute('/_navbarLayout/audit/checklist/$id')({
//   component: RouteComponent,
// })

// function RouteComponent() {
//   const { id } = useParams({ from: '/_navbarLayout/audit/checklist/$id' });
//   const site = localStorage.getItem("location") || "";
//   const [items, setItems] = useState<AuditItem[]>([]);
//   const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [saving, setSaving] = useState(false);

//   const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "all">("all");
//   const [currentDate, setCurrentDate] = useState(new Date());


//   // Get today's date at midnight
//   // const today = new Date();
//   // today.setHours(0, 0, 0, 0);
//   // const todayISO = today.toISOString();

//   // // Fetch select templates for dropdowns
//   // useEffect(() => {
//   //   const token = localStorage.getItem("token");
//   //   fetch("/api/audit/select-templates", {
//   //     headers: { Authorization: `Bearer ${token}` }
//   //   })
//   //     .then(res => res.json())
//   //     .then(setSelectTemplates)
//   //     .catch(() => setSelectTemplates([]));
//   // }, []);

//   // useEffect(() => {
//   //   const fetchChecklist = async () => {
//   //     setLoading(true);
//   //     const token = localStorage.getItem("token");

//   //     // 1. Try to fetch today's AuditInstance
//   //     const instanceRes = await fetch(
//   //       `/api/audit/instance?template=${id}&site=${encodeURIComponent(site)}&date=${todayISO}`,
//   //       { headers: { Authorization: `Bearer ${token}` } }
//   //     );

//   //     if (instanceRes.ok) {
//   //       const instanceData = await instanceRes.json();
//   //       if (instanceData?.items && instanceData.items.length > 0) {
//   //         setItems(instanceData.items);
//   //         setLoading(false);
//   //         return;
//   //       }
//   //     }

//   //     // 2. If no instance, fetch the AuditTemplate
//   //     const templateRes = await fetch(
//   //       `/api/audit/${id}`,
//   //       { headers: { Authorization: `Bearer ${token}` } }
//   //     );
//   //     if (templateRes.ok) {
//   //       const templateData = await templateRes.json();
//   //       // Map template items to checklist items with empty values
//   //       setItems(
//   //         (templateData.items || []).map((item: any) => ({
//   //           ...item,
//   //           checked: false,
//   //           comment: "",
//   //           photos: [],
//   //           // Ensure new fields exist
//   //           category: item.category || "",
//   //           status: item.status || "",
//   //           followUp: item.followUp || "",
//   //           assignedTo: item.assignedTo || "",
//   //         }))
//   //       );
//   //     }
//   //     setLoading(false);
//   //   };

//   //   if (id && site) fetchChecklist();
//   // }, [id, site, todayISO]);
//   const fetchChecklist = async () => {
//     setLoading(true);
//     const token = localStorage.getItem("token");

//     if (frequency !== "all") {
//       const instanceRes = await fetch(
//         `/api/audit/instance?template=${id}&site=${encodeURIComponent(site)}&date=${currentDate.toISOString()}&frequency=${frequency}`,
//         { headers: { Authorization: `Bearer ${token}` } }
//       );

//       if (instanceRes.ok) {
//         const instanceData = await instanceRes.json();
//         if (instanceData?.items && instanceData.items.length > 0) {
//           setItems(instanceData.items);
//           setLoading(false);
//           return;
//         }
//       }

//       // fallback: load template items
//       const templateRes = await fetch(`/api/audit/${id}`, { headers: { Authorization: `Bearer ${token}` } });
//       if (templateRes.ok) {
//         const templateData = await templateRes.json();
//         setItems(
//           (templateData.items || [])
//             .filter((item: any) => item.frequency === frequency)
//             .map((item: any) => ({
//               ...item,
//               checked: false,
//               comment: "",
//               photos: [],
//             }))
//         );
//       }
//     } else {
//       // "all" → fetch all frequencies
//       // (we can later parallelize multiple fetch calls here)
//     }

//     setLoading(false);
//   };

//   useEffect(() => {
//     if (id && site) fetchChecklist();
//   }, [id, site, frequency, currentDate]);



//   const handleCheck = (idx: number, checked: boolean) => {
//     setItems(items =>
//       items.map((item, i) => (i === idx ? { ...item, checked } : item))
//     );
//   };

//   const handleComment = (idx: number, comment: string) => {
//     setItems(items =>
//       items.map((item, i) => (i === idx ? { ...item, comment } : item))
//     );
//   };

//   const handleFieldChange = (
//     idx: number,
//     field: "status" | "followUp" | "assignedTo",
//     value: string
//   ) => {
//     setItems(items =>
//       items.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
//     );
//   };

//   const handlePhotos = (idx: number, photos: string[]) => {
//     setItems(items =>
//       items.map((item, i) => (i === idx ? { ...item, photos } : item))
//     );
//   };

//   const handleSave = async () => {
//     setSaving(true);
//     const token = localStorage.getItem("token");
//     const userId = localStorage.getItem("userId");
//     const res = await fetch("/api/audit/instance", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify({
//         template: id,
//         site,
//         date: currentDate.toISOString(),
//         items,
//         completedBy: userId,
//       }),
//     });
//     if (res.ok) {
//       alert("Checklist saved!");
//     } else {
//       const err = await res.json();
//       alert(err.error || "Failed to save checklist.");
//     }
//     setSaving(false);
//   };

//   // if (loading) return <div>Loading...</div>;
//   // if (!items.length) return <div>No checklist items for this template.</div>;

//   return (
//     <>
//       <div className="flex gap-4 mb-4">
//         {["all", "daily", "weekly", "monthly"].map(f => (
//           <Button
//             key={f}
//             variant={frequency === f ? "default" : "outline"}
//             onClick={() => setFrequency(f as any)}
//           >
//             {f.charAt(0).toUpperCase() + f.slice(1)}
//           </Button>
//         ))}
//       </div>
      
//       {/* Conditional part */}
//       {loading ? (
//         <div>Loading...</div>
//       ) : !items.length ? (
//         <div>No checklist items for this template.</div>
//       ) : (

//       <form
//         onSubmit={e => {
//           e.preventDefault();
//           handleSave();
//         }}
//       >
//         <div className="flex flex-col gap-4 mb-4">
//           {items.map((item, idx) => (
//             <ChecklistItemCard
//               key={item._id || idx}
//               item={item}
//               onCheck={checked => handleCheck(idx, checked)}
//               onComment={comment => handleComment(idx, comment)}
//               onPhotos={photos => handlePhotos(idx, photos)}
//               onFieldChange={(field, value) => handleFieldChange(idx, field, value)}
//               selectTemplates={selectTemplates}
//             />
//           ))}
//         </div>
//         <Button type="submit" disabled={saving}>
//           {saving ? "Saving..." : "Save Checklist"}
//         </Button>
//       </form>
//       )}
//     </>
//   );
// }

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

  
const CATEGORY_COLORS = [
  "red-200",
  "blue-200",
  "yellow-200",
  "purple-200",
  "pink-200",
  "indigo-200",
  "orange-200",
  "teal-200",
  "cyan-200",
];

function getCategoryColor(category?: string): string {
  if (!category) return "border-gray-200"; // fallback
  const index = Math.abs(
    category
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % CATEGORY_COLORS.length;
  return `border-${CATEGORY_COLORS[index]}`;
}
function getCategoryBgColor(category?: string): string {
  if (!category) return "bg-gray-200";
  const index = Math.abs(
    category
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index];
}






function RouteComponent() {
  const { id } = useParams({ from: "/_navbarLayout/audit/checklist/$id" });
  const site = localStorage.getItem("location") || "";
  const [items, setItems] = useState<AuditItem[]>([]); // editable list
  const [displayItems, setDisplayItems] = useState<AuditItem[]>([]); // sorted for initial display / after save
  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "all">("all");
  const [currentDate] = useState(new Date());
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))];


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

  useEffect(() => {
    if (items.length > 0) {
      const sorted = [...items].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        const aFreq = frequencyOrder[a.frequency || "daily"];
        const bFreq = frequencyOrder[b.frequency || "daily"];
        return aFreq - bFreq;
      });
      setDisplayItems(sorted);
    }
  }, [items]); // only when items load


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
            const itemsRes = await fetch(`/api/audit/items?instanceId=${instanceData._id}`, {
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
        const templateRes = await fetch(`/api/audit/${id}?frequency=${frequency}`, { headers: { Authorization: `Bearer ${token}` } });
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
        const templateRes = await fetch(`/api/audit/${id}?frequency=${frequency}`, { headers: { Authorization: `Bearer ${token}` } });
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
              const itemsRes = await fetch(`/api/audit/items?instanceId=${instanceData._id}`, {
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
    const userId = localStorage.getItem("userId");
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
          completedBy: userId,
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
      <div className="flex gap-4 mb-4 flex-wrap">
        {categories.map(cat => (
          <div
            key={cat}
            className="flex items-center gap-1 px-2 py-1 rounded border"
          >
            <div className={`w-4 h-4 rounded-sm`}></div>
            <span className="text-sm">{cat}</span>
          </div>
        ))}
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
                catColor={getCategoryColor(item.category)}
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
