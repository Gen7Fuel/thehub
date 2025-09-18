import { createFileRoute, useParams } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute('/_navbarLayout/old/audit/$id')({
  component: RouteComponent,
})

interface AuditItem {
  _id?: string;
  text: string;
  required: boolean;
}

interface AuditTemplate {
  _id: string;
  name: string;
  description?: string;
  items: AuditItem[];
  sites: string[];
}

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/audit/$id' });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<AuditItem[]>([{ text: "", required: true }]);
  const [locations, setLocations] = useState<{ _id: string; stationName: string }[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        // Fetch template
        const res = await fetch(`/api/audit/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: AuditTemplate = await res.json();
          setName(data.name);
          setDescription(data.description || "");
          setItems(data.items.length > 0 ? data.items : [{ text: "", required: true }]);
          setSites(data.sites || []);
        }
        // Fetch locations
        const locRes = await fetch("/api/locations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (locRes.ok) {
          const data = await locRes.json();
          setLocations(data.locations || data);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [id]);

  const handleItemChange = (idx: number, field: "text" | "required", value: string | boolean) => {
    setItems(items =>
      items.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems([...items, { text: "", required: true }]);
  };

  const removeItem = (idx: number) => {
    setItems(items => items.filter((_, i) => i !== idx));
  };

  const handleSiteToggle = (site: string) => {
    setSites(prev =>
      prev.includes(site)
        ? prev.filter(s => s !== site)
        : [...prev, site]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/audit/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          description,
          items: items.filter(item => item.text.trim() !== ""),
          sites,
        }),
      });
      if (res.ok) {
        // Optionally show a success message here
        // Do NOT navigate away
      } else {
        // Optionally handle error
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center">Loading...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Audit Template</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-medium mb-1">Template Name</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Description</label>
              <textarea
                className="border rounded px-3 py-2 w-full"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Checklist Items</label>
              {items.map((item, idx) => (
                <div key={item._id || idx} className="flex gap-2 mb-2 items-center">
                  <input
                    className="border rounded px-2 py-1 flex-1"
                    placeholder="Audit question or checklist entry"
                    value={item.text}
                    onChange={e => handleItemChange(idx, "text", e.target.value)}
                    required
                  />
                  {/* <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={e => handleItemChange(idx, "required", e.target.checked)}
                    />
                    Required
                  </label> */}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addItem}>
                Add Item
              </Button>
            </div>
            <div>
              <label className="block font-medium mb-2">Assign to Locations</label>
              <div className="flex flex-wrap gap-4">
                {locations.map(loc => (
                  <label key={loc._id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sites.includes(loc.stationName)}
                      onChange={() => handleSiteToggle(loc.stationName)}
                    />
                    {loc.stationName}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}