import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPicker } from "@/components/custom/locationPicker";

interface SupplyItem {
  name: string;
  upc: string;
  vin: string;
  size: string;
}

interface Vendor {
  _id: string;
  name: string;
  location: string;
  category: string;
  station_supplies: SupplyItem[];
  email_order?: boolean;
  email?: string;
  order_placement_method?: string;
  vendor_order_frequency?: number;
  last_order_date?: string;
}

export const Route = createFileRoute('/_navbarLayout/vendor/edit/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/vendor/edit/$id' });
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [stationSupplies, setStationSupplies] = useState<SupplyItem[]>([{ name: "", vin: "", upc: "", size: "" }]);
  const [emailOrder, setEmailOrder] = useState(false);
  const [email, setEmail] = useState("");
  const [orderPlacementMethod, setOrderPlacementMethod] = useState("Email");
  const [vendorOrderFrequency, setVendorOrderFrequency] = useState("");
  const [lastOrderDate, setLastOrderDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("");

  useEffect(() => {
    const fetchVendor = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/vendors/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: Vendor = await res.json();
          setName(data.name);
          setLocation(data.location);
          setStationSupplies(
            data.station_supplies.length > 0
              ? data.station_supplies
              : [{ name: "", vin: "", upc: "", size: "" }]
          );
          setEmailOrder(!!data.email_order);
          setEmail(data.email || "");
          setOrderPlacementMethod(data.order_placement_method || "Email");
          setVendorOrderFrequency(
            data.vendor_order_frequency !== undefined && data.vendor_order_frequency !== null
              ? String(data.vendor_order_frequency)
              : ""
          );
          setLastOrderDate(
            data.last_order_date
              ? new Date(data.last_order_date).toISOString().slice(0, 10)
              : ""
          );
          setCategory(data.category || "");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [id]);

  const handleSupplyChange = (idx: number, field: keyof SupplyItem, value: string) => {
    setStationSupplies(supplies =>
      supplies.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  const addSupply = () => {
    setStationSupplies([...stationSupplies, { name: "", vin: "", upc: "", size: "" }]);
  };

  const removeSupply = (idx: number) => {
    setStationSupplies(supplies => supplies.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/vendors/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          location,
          category,
          station_supplies: stationSupplies.filter(
            s => s.name && s.upc && s.size
          ),
          email_order: emailOrder,
          email,
          order_placement_method: orderPlacementMethod,
          vendor_order_frequency: vendorOrderFrequency ? parseFloat(vendorOrderFrequency) : undefined,
        }),
      });
      if (res.ok) {
        navigate({ to: "/vendor/list" });
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
          <CardTitle>Edit Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-medium mb-1">Vendor Name</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Location</label>
              <LocationPicker
                value="stationName"
                setStationName={setLocation}
                defaultValue={location}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Category</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={category}
                onChange={e => setCategory(e.target.value)}
                required
              >
                <option value="">Select category</option>
                <option value="Cannabis">Cannabis</option>
                <option value="Vape">Vape</option>
                <option value="Convenience">Convenience</option>
                <option value="Tobacco">Tobacco</option>
                <option value="Native Crafts">Native Crafts</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-2">Station Supplies</label>
              {stationSupplies.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input
                    className="border rounded px-2 py-1 flex-1"
                    placeholder="Item Name"
                    value={item.name}
                    onChange={e => handleSupplyChange(idx, "name", e.target.value)}
                    required
                  />
                   <input
                    className="border rounded px-2 py-1 w-32"
                    placeholder="VIN"
                    value={item.vin}
                    onChange={e => handleSupplyChange(idx, "vin", e.target.value)}
                    required
                  />
                  <input
                    className="border rounded px-2 py-1 w-32"
                    placeholder="UPC"
                    value={item.upc}
                    onChange={e => handleSupplyChange(idx, "upc", e.target.value)}
                    required
                  />
                  <input
                    className="border rounded px-2 py-1 w-24"
                    placeholder="Size"
                    value={item.size}
                    onChange={e => handleSupplyChange(idx, "size", e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => removeSupply(idx)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addSupply}>
                Add Supply
              </Button>
            </div>
            <div>
              <label className="block font-medium mb-1">Email Order</label>
              <input
                type="checkbox"
                checked={emailOrder}
                onChange={e => setEmailOrder(e.target.checked)}
                className="mr-2"
              />
              <span>Should orders be sent by email?</span>
            </div>
            <div>
              <label className="block font-medium mb-1">Email</label>
              <input
                type="email"
                className="border rounded px-3 py-2 w-full"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vendor@email.com"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Order Placement Method</label>
              <select
                className="border rounded px-3 py-2 w-full"
                value={orderPlacementMethod}
                onChange={e => setOrderPlacementMethod(e.target.value)}
              >
                <option value="Email">Email</option>
                <option value="Template">Template</option>
                <option value="Web Portal">Web Portal</option>
                <option value="Telephone">Telephone</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Vendor Order Frequency (weeks)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="border rounded px-3 py-2 w-full"
                value={vendorOrderFrequency}
                onChange={e => setVendorOrderFrequency(e.target.value)}
                placeholder="e.g. 1.5"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Last Order Date</label>
              <input
                type="date"
                className="border rounded px-3 py-2 w-full"
                value={lastOrderDate}
                disabled
                readOnly
                onChange={e => setLastOrderDate(e.target.value)}
              />
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