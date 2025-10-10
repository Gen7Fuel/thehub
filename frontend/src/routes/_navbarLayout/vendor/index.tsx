import { createFileRoute } from '@tanstack/react-router'
import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { LocationPicker } from "@/components/custom/locationPicker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import CreatableSelect from 'react-select/creatable';

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
  // const [location, setLocation] = useState(localStorage.getItem("location") || "");
  const [stationSupplies, setStationSupplies] = useState<SupplyItem[]>([]);
  const [emailOrder, setEmailOrder] = useState(false);
  const [email, setEmail] = useState("");
  const [orderPlacementMethod, setOrderPlacementMethod] = useState("Email");
  const [vendorOrderFrequency, setVendorOrderFrequency] = useState("");
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("");
  const [uniqueVendors, setUniqueVendors] = useState<string[]>([]);
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [sites, setSites] = useState<{ _id: string; stationName: string }[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/locations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setSites(data);
      } catch (err) {
        console.error("Failed to fetch sites:", err);
      }
    };
    fetchSites();
  }, []);



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
          sites: selectedSites,
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
        alert("New vendor has been added successfully!");
        setName("");
        setStationSupplies([]);
        setEmailOrder(false);
        setEmail("");
        setOrderPlacementMethod("Email");
        setVendorOrderFrequency("");
        setCategory("Other");
      } else {
        alert("Failed to add vendor. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };
  
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/vendors", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = (await res.json()) as { name: string; category: string }[];

        // Extract unique vendor names
        const vendors = Array.from(new Set(data.map((v: any) => v.name).filter(Boolean)));
        setUniqueVendors(vendors);

        // Extract unique categories
        const categories = Array.from(new Set(data.map((v: any) => v.category).filter(Boolean)));
        setUniqueCategories(categories);

        console.log("Unique vendors:", vendors);
        console.log("Unique categories:", categories);
      } catch (err) {
        console.error("Failed to fetch vendors:", err);
      }
    };

    fetchVendors();
  }, []);

  // Custom styles to match LocationPicker for creatable select
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    width: '100%',
    maxWidth: '250px',           // same width as LocationPicker
    minHeight: '40px',           // match LocationPicker height
    borderRadius: '0.75rem',     // rounded-xl
    border: '1px solid #d1d5db', // gray-300
    padding: '0 6px',            // reduce vertical padding
    boxShadow: state.isFocused ? '0 0 0 2px #3b82f6' : '0 1px 2px rgba(0,0,0,0.05)',
    '&:hover': {
      borderColor: '#3b82f6',
    },
    fontSize: '0.875rem',  
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: '0.75rem',
    maxHeight: '20rem',         // scrollable like LocationPicker
    overflowY: 'auto',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    zIndex: 50,    
    fontSize: '0.875rem',             // ensure dropdown overlays everything
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 9999,               // for portal usage
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    padding: '8px 12px',
    backgroundColor: state.isFocused ? '#eff6ff' : 'white',
    color: 'black',
    cursor: 'pointer',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: '#9ca3af', // gray-400
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: 'black',
  }),
}

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* <div>
              <label className="block font-medium mb-1">Vendor Name</label>
              <input
                className="border rounded px-3 py-2 w-full"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div> */}
            <label className="block font-medium mb-1">Vendor Name</label>
            <CreatableSelect
              isClearable
              options={uniqueVendors.map(v => ({ value: v, label: v }))}
              onChange={opt => setName(opt?.value || '')}
              onCreateOption={val => setName(val)}
              value={name ? { value: name, label: name } : null}
              placeholder="Select or add new vendor"
              styles={customSelectStyles}
            />
            <div>
              <label className="block font-medium mb-1">Assign to Sites</label>
              <Button type="button" variant="outline" onClick={() => setSiteDialogOpen(true)}>
                {selectedSites.length > 0
                  ? `Selected ${selectedSites.length} site(s)`
                  : "Select Sites"}
              </Button>
            </div>

            {/* <div>
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
            </div> */}
            <label className="block font-medium mb-1">Category</label>
            <CreatableSelect
              isClearable
              options={uniqueCategories.map(c => ({ value: c, label: c }))}
              value={category ? { value: category, label: category } : null}
              onChange={opt => setCategory(opt?.value || '')}
              onCreateOption={val => setCategory(val)}
              placeholder="Select or add new category"
              styles={customSelectStyles}
            />
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
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create Vendor"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Sites</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={selectedSites.length === sites.length}
                onChange={e =>
                  setSelectedSites(
                    e.target.checked ? sites.map(s => s.stationName) : []
                  )
                }
              />
              Select All
            </label>
            {sites.map(site => (
              <label key={site._id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedSites.includes(site.stationName)}
                  onChange={() => {
                    setSelectedSites(prev =>
                      prev.includes(site.stationName)
                        ? prev.filter(s => s !== site.stationName)
                        : [...prev, site.stationName]
                    );
                  }}
                />
                {site.stationName}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setSiteDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}