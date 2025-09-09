import { createFileRoute } from '@tanstack/react-router'
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPicker } from "@/components/custom/locationPicker";

interface SupplyItem {
  name: string;
  vin: string;
  upc: string;
  size: string;
}

export const Route = createFileRoute('/_navbarLayout/vendor/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState(localStorage.getItem("location") || "");
  const [stationSupplies, setStationSupplies] = useState<SupplyItem[]>([]);
  const [emailOrder, setEmailOrder] = useState(false);
  const [email, setEmail] = useState("");
  const [orderPlacementMethod, setOrderPlacementMethod] = useState("Email");
  const [vendorOrderFrequency, setVendorOrderFrequency] = useState("");
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("Other");

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
      const res = await fetch("/api/vendors", {
        method: "POST",
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
        setName("");
        setLocation("");
        setStationSupplies([]);
        setEmailOrder(false);
        setEmail("");
        setOrderPlacementMethod("Email");
        setVendorOrderFrequency("");
        setCategory("Other");
        // Optionally show a success message
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
          <CardTitle>Create New Vendor</CardTitle>
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
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create Vendor"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}