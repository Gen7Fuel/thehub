import { createFileRoute } from '@tanstack/react-router'
import { useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ChecklistItemCard } from "@/components/custom/ChecklistItem";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute('/_navbarLayout/audit/checklist/$templateId')({
  component: RouteComponent,
})

interface AuditItem {
  _id?: string;
  text: string;
  required: boolean;
  checked?: boolean;
  comment?: string;
  photos?: string[];
}

function RouteComponent() {
  const { templateId } = useParams({ from: '/_navbarLayout/audit/checklist/$templateId' });
  const site = localStorage.getItem("location") || "";
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  useEffect(() => {
    const fetchChecklist = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");

      // 1. Try to fetch today's AuditInstance
      const instanceRes = await fetch(
        `/api/audit/instance?template=${templateId}&site=${encodeURIComponent(site)}&date=${todayISO}`,
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
        `/api/audit/${templateId}`,
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
          }))
        );
      }
      setLoading(false);
    };

    if (templateId && site) fetchChecklist();
  }, [templateId, site, todayISO]);

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
        template: templateId,
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
            onPhotos={photos => {
              setItems(items =>
                items.map((it, i) => i === idx ? { ...it, photos } : it)
              );
            }}
          />
        ))}
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save Checklist"}
      </Button>
    </form>
  );
}