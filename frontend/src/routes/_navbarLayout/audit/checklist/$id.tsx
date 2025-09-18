import { createFileRoute, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
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
  text: string;
  required: boolean;
  checked?: boolean;
  comment?: string;
  photos?: string[];
  // New fields:
  category?: string;
  status?: string;
  followUp?: string;
  assignedTo?: string;
}

export const Route = createFileRoute('/_navbarLayout/audit/checklist/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/audit/checklist/$id' });
  const site = localStorage.getItem("location") || "";
  const [items, setItems] = useState<AuditItem[]>([]);
  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Fetch select templates for dropdowns
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/audit/select-templates", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setSelectTemplates)
      .catch(() => setSelectTemplates([]));
  }, []);

  useEffect(() => {
    const fetchChecklist = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");

      // 1. Try to fetch today's AuditInstance
      const instanceRes = await fetch(
        `/api/audit/instance?template=${id}&site=${encodeURIComponent(site)}&date=${todayISO}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (instanceRes.ok) {
        const instanceData = await instanceRes.json();
        if (instanceData?.items && instanceData.items.length > 0) {
          setItems(instanceData.items);
          setLoading(false);
          return;
        }
      }

      // 2. If no instance, fetch the AuditTemplate
      const templateRes = await fetch(
        `/api/audit/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (templateRes.ok) {
        const templateData = await templateRes.json();
        // Map template items to checklist items with empty values
        setItems(
          (templateData.items || []).map((item: any) => ({
            ...item,
            checked: false,
            comment: "",
            photos: [],
            // Ensure new fields exist
            category: item.category || "",
            status: item.status || "",
            followUp: item.followUp || "",
            assignedTo: item.assignedTo || "",
          }))
        );
      }
      setLoading(false);
    };

    if (id && site) fetchChecklist();
  }, [id, site, todayISO]);

  const handleCheck = (idx: number, checked: boolean) => {
    setItems(items =>
      items.map((item, i) => (i === idx ? { ...item, checked } : item))
    );
  };

  const handleComment = (idx: number, comment: string) => {
    setItems(items =>
      items.map((item, i) => (i === idx ? { ...item, comment } : item))
    );
  };

  const handleFieldChange = (
    idx: number,
    field: "status" | "followUp" | "assignedTo",
    value: string
  ) => {
    setItems(items =>
      items.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handlePhotos = (idx: number, photos: string[]) => {
    setItems(items =>
      items.map((item, i) => (i === idx ? { ...item, photos } : item))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    const res = await fetch("/api/audit/instance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        template: id,
        site,
        date: todayISO,
        items,
        completedBy: userId,
      }),
    });
    if (res.ok) {
      alert("Checklist saved!");
    } else {
      const err = await res.json();
      alert(err.error || "Failed to save checklist.");
    }
    setSaving(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!items.length) return <div>No checklist items for this template.</div>;

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="flex flex-col gap-4 mb-4">
        {items.map((item, idx) => (
          <ChecklistItemCard
            key={item._id || idx}
            item={item}
            onCheck={checked => handleCheck(idx, checked)}
            onComment={comment => handleComment(idx, comment)}
            onPhotos={photos => handlePhotos(idx, photos)}
            onFieldChange={(field, value) => handleFieldChange(idx, field, value)}
            selectTemplates={selectTemplates}
          />
        ))}
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save Checklist"}
      </Button>
    </form>
  );
}
