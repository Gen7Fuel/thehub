import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute('/_navbarLayout/old/audit/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState([{ text: "", required: true }]);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<{ _id: string; stationName: string }[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch locations from your API
    const fetchLocations = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/locations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || data); // adjust if your API returns { locations: [...] }
      }
    };
    fetchLocations();
  }, []);

  const handleSiteToggle = (site: string) => {
    setSites(prev =>
      prev.includes(site)
        ? prev.filter(s => s !== site)
        : [...prev, site]
    );
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/audit", {
        method: "POST",
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
        navigate({ to: "/audit/list" }); // Navigate to the list page after save
      } else {
        // Optionally handle error
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Audit Template</CardTitle>
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
                <div key={idx} className="flex gap-2 mb-2 items-center">
                  <input
                    className="border rounded px-2 py-1 flex-1"
                    placeholder="Audit question or checklist entry"
                    value={item.text}
                    onChange={e => handleItemChange(idx, "text", e.target.value)}
                    required
                  />
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
              {saving ? "Saving..." : "Create Template"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}