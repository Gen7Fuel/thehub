// import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
// import { useEffect, useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import CreatableSelect from 'react-select/creatable';

// interface SupplyItem { name: string; vin: string; upc: string; size: string; }
// interface VendorSite { site: string; frequency: number | ''; }

// export const Route = createFileRoute('/_navbarLayout/vendor/edit/$id')({
//   component: RouteComponent,
// });

// function RouteComponent() {
//   const { id } = useParams({ from: '/_navbarLayout/vendor/edit/$id' });
//   const navigate = useNavigate();

//   const [name, setName] = useState("");
//   const [stationSupplies, setStationSupplies] = useState<SupplyItem[]>([]);
//   const [emailOrder, setEmailOrder] = useState(false);
//   const [email, setEmail] = useState("");
//   const [orderPlacementMethod, setOrderPlacementMethod] = useState("Email");
//   const [category, setCategory] = useState("");
//   const [vendorSites, setVendorSites] = useState<VendorSite[]>([]);
//   const [allSites, setAllSites] = useState<string[]>([]);
//   const [newSitesDialogOpen, setNewSitesDialogOpen] = useState(false);
//   const [selectedNewSites, setSelectedNewSites] = useState<string[]>([]);
//   const [saving, setSaving] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [notes, setNotes] = useState("");
//   const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);

//   // Fetch vendor data
//   useEffect(() => {
//     const fetchVendor = async () => {
//       setLoading(true);
//       try {
//         const token = localStorage.getItem("token");
//         const res = await fetch(`/api/vendors/by-name/${id}`, { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "vendor" } });
//         if (res.status == 403) {
//           navigate({ to: "/no-access" })
//           return;
//         }
//         if (!res.ok) return;
//         const data = await res.json();
//         setName(data.name);
//         setStationSupplies(data.station_supplies || []);
//         setEmailOrder(!!data.email_order);
//         setEmail(data.email || "");
//         setOrderPlacementMethod(data.order_placement_method || "Email");
//         setCategory(data.category || "");
//         setNotes(data.notes || "");

//         // vendorSites array: [{ site, frequency }]
//         setVendorSites(data.sites || []);
//       } finally { setLoading(false); }
//     };
//     fetchVendor();
//   }, [id]);

//   // Fetch all sites
//   useEffect(() => {
//     const fetchSites = async () => {
//       try {
//         const token = localStorage.getItem("token");
//         const res = await fetch("/api/locations", { headers: { Authorization: `Bearer ${token}` } });
//         if (!res.ok) throw new Error("Failed to fetch sites");
//         const data = await res.json();
//         setAllSites(data.map((s: any) => s.stationName));
//       } catch (err) { console.error(err); }
//     };
//     fetchSites();
//   }, []);

//   //Fetch categories
//   useEffect(() => {
//     const fetchCategories = async () => {
//       try {
//         const token = localStorage.getItem("token");
//         const res = await fetch("/api/vendors", {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
//         const data = (await res.json()) as { name: string; category: string }[];

//         // Extract unique categories
//         const categories = Array.from(new Set(data.map((v: any) => v.category).filter(Boolean)));
//         setUniqueCategories(categories);

//         console.log("Unique categories:", categories);
//       } catch (err) {
//         console.error("Failed to fetch vendors:", err);
//       }
//     };

//     fetchCategories();
//   }, []);

//   const handleSupplyChange = (idx: number, field: keyof SupplyItem, value: string) => {
//     setStationSupplies(supplies =>
//       supplies.map((item, i) => i === idx ? { ...item, [field]: value } : item)
//     );
//   };
//   const addSupply = () => setStationSupplies([...stationSupplies, { name: "", vin: "", upc: "", size: "" }]);
//   const removeSupply = (idx: number) => setStationSupplies(stationSupplies.filter((_, i) => i !== idx));

//   const handleFrequencyChange = (site: string, value: string) => {
//     setVendorSites(prev => prev.map(vs =>
//       vs.site === site ? { ...vs, frequency: value ? parseFloat(value) : '' } : vs
//     ));
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setSaving(true);
//     try {
//       const token = localStorage.getItem("token");
//       const res = await fetch(`/api/vendors/${id}`, {
//         method: "PUT",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Required-Permission": "vendor" },
//         body: JSON.stringify({
//           name,
//           station_supplies: stationSupplies.filter(s => s.name && s.upc && s.size),
//           email_order: emailOrder,
//           email,
//           order_placement_method: orderPlacementMethod,
//           category,
//           notes,
//           sites: vendorSites.concat(selectedNewSites.map(s => ({ site: s, frequency: '' }))),
//         }),
//       });
//       if (res.status == 403) {
//         navigate({ to: "/no-access" })
//       }
//       if (res.ok) navigate({ to: "/vendor/list" });
//       else alert("Failed to update vendor");
//     } finally { setSaving(false); }
//   };

//   const customSelectStyles = {
//     control: (provided: any, state: any) => ({
//       ...provided,
//       width: '100%',
//       maxWidth: '250px',           // same width as LocationPicker
//       minHeight: '40px',           // match LocationPicker height
//       borderRadius: '0.75rem',     // rounded-xl
//       border: '1px solid #d1d5db', // gray-300
//       padding: '0 6px',            // reduce vertical padding
//       boxShadow: state.isFocused ? '0 0 0 2px #3b82f6' : '0 1px 2px rgba(0,0,0,0.05)',
//       '&:hover': {
//         borderColor: '#3b82f6',
//       },
//       fontSize: '0.875rem',
//     }),
//     menu: (provided: any) => ({
//       ...provided,
//       borderRadius: '0.75rem',
//       maxHeight: '20rem',         // scrollable like LocationPicker
//       overflowY: 'auto',
//       boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
//       zIndex: 50,
//       fontSize: '0.875rem',             // ensure dropdown overlays everything
//     }),
//     menuPortal: (base: any) => ({
//       ...base,
//       zIndex: 9999,               // for portal usage
//     }),
//     option: (provided: any, state: any) => ({
//       ...provided,
//       padding: '8px 12px',
//       backgroundColor: state.isFocused ? '#eff6ff' : 'white',
//       color: 'black',
//       cursor: 'pointer',
//     }),
//     placeholder: (provided: any) => ({
//       ...provided,
//       color: '#9ca3af', // gray-400
//     }),
//     singleValue: (provided: any) => ({
//       ...provided,
//       color: 'black',
//     }),
//   }

//   if (loading) return <div className="max-w-2xl mx-auto p-6"><Card><CardContent className="py-12 text-center">Loading...</CardContent></Card></div>;

//   return (
//     <div className="max-w-2xl mx-auto p-6">
//       <Card>
//         <CardHeader><CardTitle>Edit Vendor</CardTitle></CardHeader>
//         <CardContent>
//           <form onSubmit={handleSubmit} className="space-y-6">
//             <div>
//               <label className="block font-medium mb-1">Vendor Name</label>
//               <input
//                 type="text"
//                 value={name}
//                 onChange={e => setName(e.target.value)}
//                 className="border rounded px-3 py-2 w-full"
//                 placeholder="Enter vendor name"
//                 required
//               />
//             </div>

//             <div>
//               <label className="block font-medium mb-1">Category</label>
//               <CreatableSelect
//                 isClearable
//                 options={uniqueCategories.map(c => ({ value: c, label: c }))}
//                 value={category ? { value: category, label: category } : null}
//                 onChange={opt => setCategory(opt?.value || '')}
//                 onCreateOption={val => setCategory(val)}
//                 styles={customSelectStyles}
//               />
//             </div>

//             <div>
//               <label className="block font-medium mb-1">Assigned Sites</label>
//               <table className="w-full border">
//                 <thead>
//                   <tr className="bg-gray-100">
//                     <th className="border px-2 py-1">Site</th>
//                     <th className="border px-2 py-1">Vendor Frequency (weeks)</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {vendorSites.map(vs => (
//                     <tr key={vs.site}>
//                       <td className="border px-2 py-1">{vs.site}</td>
//                       <td className="border px-2 py-1">
//                         <input
//                           type="number"
//                           min="0"
//                           step="0.5"
//                           className="border rounded px-2 py-1 w-full"
//                           value={vs.frequency}
//                           onChange={e => handleFrequencyChange(vs.site, e.target.value)}
//                           required
//                         />
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//               <Button type="button" variant="outline" onClick={() => setNewSitesDialogOpen(true)}>
//                 Add New Sites
//               </Button>
//             </div>

//             <div>
//               <label className="block font-medium mb-2">Station Supplies</label>
//               {stationSupplies.map((item, idx) => (
//                 <div key={idx} className="flex gap-2 mb-2">
//                   <input placeholder="Item Name" value={item.name} onChange={e => handleSupplyChange(idx, "name", e.target.value)} required className="border rounded px-2 py-1 flex-1" />
//                   <input placeholder="VIN" value={item.vin} onChange={e => handleSupplyChange(idx, "vin", e.target.value)} required className="border rounded px-2 py-1 w-32" />
//                   <input placeholder="UPC" value={item.upc} onChange={e => handleSupplyChange(idx, "upc", e.target.value)} required className="border rounded px-2 py-1 w-32" />
//                   <input placeholder="Size" value={item.size} onChange={e => handleSupplyChange(idx, "size", e.target.value)} required className="border rounded px-2 py-1 w-24" />
//                   <Button type="button" variant="destructive" onClick={() => removeSupply(idx)}>Remove</Button>
//                 </div>
//               ))}
//               <Button type="button" variant="outline" onClick={addSupply}>Add Supply</Button>
//             </div>

//             <div>
//               <label className="block font-medium mb-1">Email Order</label>
//               <input type="checkbox" checked={emailOrder} onChange={e => setEmailOrder(e.target.checked)} className="mr-2" />
//               <span>Should orders be sent by email?</span>
//             </div>

//             <div>
//               <label className="block font-medium mb-1">Email</label>
//               <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="vendor@email.com" />
//             </div>

//             <div>
//               <label className="block font-medium mb-1">Order Placement Method</label>
//               <select value={orderPlacementMethod} onChange={e => setOrderPlacementMethod(e.target.value)} className="border rounded px-3 py-2 w-full">
//                 <option value="Email">Email</option>
//                 <option value="Template">Template</option>
//                 <option value="Web Portal">Web Portal</option>
//                 <option value="Telephone">Telephone</option>
//               </select>
//             </div>
//             <div>
//               <label className="block font-medium mb-1">Notes</label>
//               <textarea
//                 className="border rounded px-3 py-2 w-full"
//                 value={notes}
//                 onChange={e => setNotes(e.target.value)}
//                 placeholder="Optional notes/credentials/details about this vendor"
//                 rows={4}
//               />
//             </div>

//             <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
//           </form>
//         </CardContent>
//       </Card>

//       <Dialog open={newSitesDialogOpen} onOpenChange={setNewSitesDialogOpen}>
//         <DialogContent className="max-w-lg">
//           <DialogHeader><DialogTitle>Add New Sites</DialogTitle></DialogHeader>

//           <div className="space-y-2 max-h-80 overflow-y-auto">
//             {allSites
//               // show only sites that are not existing in vendorSites OR already selectedNewSites
//               .filter(s => !vendorSites.find(vs => vs.site === s) || selectedNewSites.includes(s))
//               .map(site => (
//                 <label key={site} className="flex items-center gap-2">
//                   <input
//                     type="checkbox"
//                     checked={selectedNewSites.includes(site)}
//                     onChange={() => {
//                       setSelectedNewSites(prev =>
//                         prev.includes(site)
//                           ? prev.filter(s => s !== site)   // uncheck
//                           : [...prev, site]               // check
//                       );

//                       // if unchecked, remove from vendorSites
//                       if (selectedNewSites.includes(site)) {
//                         setVendorSites(prev => prev.filter(vs => vs.site !== site));
//                       }
//                     }}
//                   />
//                   {site}
//                 </label>
//               ))}
//           </div>

//           <DialogFooter>
//             <Button onClick={() => {
//               // add all newly selected sites to vendorSites if not already present
//               setVendorSites(prev => [
//                 ...prev,
//                 ...selectedNewSites
//                   .filter(site => !prev.find(vs => vs.site === site))
//                   .map(site => ({ site, frequency: '' as '' }))
//               ]);
//               setNewSitesDialogOpen(false);
//             }}>
//               Done
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//     </div>
//   );
// }
import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import CreatableSelect from 'react-select/creatable';

interface SupplyItem { name: string; vin: string; upc: string; size: string; }
interface VendorSite { site: string; frequency: number | ''; leadTime?: number | null; }

export const Route = createFileRoute('/_navbarLayout/vendor/edit/$id')({
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/vendor/edit/$id' });
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [stationSupplies, setStationSupplies] = useState<SupplyItem[]>([]);
  const [emailOrder, setEmailOrder] = useState(false);
  const [email, setEmail] = useState("");
  const [orderPlacementMethod, setOrderPlacementMethod] = useState("Email");
  const [category, setCategory] = useState("");
  const [vendorSites, setVendorSites] = useState<VendorSite[]>([]);
  const [allSites, setAllSites] = useState<string[]>([]);
  const [newSitesDialogOpen, setNewSitesDialogOpen] = useState(false);
  const [selectedNewSites, setSelectedNewSites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);

  // Fetch vendor data
  useEffect(() => {
    const fetchVendor = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/vendors/by-name/${id}`, { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "vendor" } });
        if (res.status == 403) {
          navigate({ to: "/no-access" })
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setName(data.name);
        setStationSupplies(data.station_supplies || []);
        setEmailOrder(!!data.email_order);
        setEmail(data.email || "");
        setOrderPlacementMethod(data.order_placement_method || "Email");
        setCategory(data.category || "");
        setNotes(data.notes || "");

        // vendorSites array: [{ site, frequency, leadTime }]
        const sites = (data.sites || []).map((s: any) => ({
          site: s.site,
          frequency: s.frequency ?? '',
          leadTime: s.leadTime ?? null
        }));
        setVendorSites(sites);
      } finally { setLoading(false); }
    };
    fetchVendor();
  }, [id]);

  // Fetch all sites
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/locations", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to fetch sites");
        const data = await res.json();
        setAllSites(data.map((s: any) => s.stationName));
      } catch (err) { console.error(err); }
    };
    fetchSites();
  }, []);

  //Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/vendors", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = (await res.json()) as { name: string; category: string }[];

        // Extract unique categories
        const categories = Array.from(new Set(data.map((v: any) => v.category).filter(Boolean)));
        setUniqueCategories(categories);

        console.log("Unique categories:", categories);
      } catch (err) {
        console.error("Failed to fetch vendors:", err);
      }
    };

    fetchCategories();
  }, []);

  const handleSupplyChange = (idx: number, field: keyof SupplyItem, value: string) => {
    setStationSupplies(supplies =>
      supplies.map((item, i) => i === idx ? { ...item, [field]: value } : item)
    );
  };
  const addSupply = () => setStationSupplies([...stationSupplies, { name: "", vin: "", upc: "", size: "" }]);
  const removeSupply = (idx: number) => setStationSupplies(stationSupplies.filter((_, i) => i !== idx));

  const handleFrequencyChange = (site: string, value: string) => {
    setVendorSites(prev => prev.map(vs =>
      vs.site === site ? { ...vs, frequency: value ? parseFloat(value) : '' } : vs
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Required-Permission": "vendor" },
        body: JSON.stringify({
          name,
          station_supplies: stationSupplies.filter(s => s.name && s.upc && s.size),
          email_order: emailOrder,
          email,
          order_placement_method: orderPlacementMethod,
          category,
          notes,
          sites: vendorSites.concat(selectedNewSites.map(s => ({ site: s, frequency: '' }))),
        }),
      });
      if (res.status == 403) {
        navigate({ to: "/no-access" })
      }
      if (res.ok) navigate({ to: "/vendor/list" });
      else alert("Failed to update vendor");
    } finally { setSaving(false); }
  };

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

  if (loading) return <div className="max-w-2xl mx-auto p-6"><Card><CardContent className="py-12 text-center">Loading...</CardContent></Card></div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader><CardTitle>Edit Vendor</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-medium mb-1">Vendor Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                placeholder="Enter vendor name"
                required
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Category</label>
              <CreatableSelect
                isClearable
                options={uniqueCategories.map(c => ({ value: c, label: c }))}
                value={category ? { value: category, label: category } : null}
                onChange={opt => setCategory(opt?.value || '')}
                onCreateOption={val => setCategory(val)}
                styles={customSelectStyles}
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Assigned Sites</label>
              <table className="w-full border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-2 py-1">Site</th>
                    <th className="border px-2 py-1">Vendor Frequency (weeks)</th>
                    <th className="border px-2 py-1">Lead Time</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorSites.map(vs => (
                    <tr key={vs.site}>
                      <td className="border px-2 py-1">{vs.site}</td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          className="border rounded px-2 py-1 w-full"
                          value={vs.frequency}
                          onChange={e => handleFrequencyChange(vs.site, e.target.value)}
                          required
                        />
                      </td>
                      <td className="border px-2 py-1">
                        {typeof vs.leadTime === "number" && vs.leadTime > 0 ? `${vs.leadTime.toFixed(0)} day(s)` : "NA"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button type="button" variant="outline" onClick={() => setNewSitesDialogOpen(true)}>
                Add New Sites
              </Button>
            </div>

            <div>
              <label className="block font-medium mb-2">Station Supplies</label>
              {stationSupplies.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input placeholder="Item Name" value={item.name} onChange={e => handleSupplyChange(idx, "name", e.target.value)} required className="border rounded px-2 py-1 flex-1" />
                  <input placeholder="VIN" value={item.vin} onChange={e => handleSupplyChange(idx, "vin", e.target.value)} required className="border rounded px-2 py-1 w-32" />
                  <input placeholder="UPC" value={item.upc} onChange={e => handleSupplyChange(idx, "upc", e.target.value)} required className="border rounded px-2 py-1 w-32" />
                  <input placeholder="Size" value={item.size} onChange={e => handleSupplyChange(idx, "size", e.target.value)} required className="border rounded px-2 py-1 w-24" />
                  <Button type="button" variant="destructive" onClick={() => removeSupply(idx)}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addSupply}>Add Supply</Button>
            </div>

            <div>
              <label className="block font-medium mb-1">Email Order</label>
              <input type="checkbox" checked={emailOrder} onChange={e => setEmailOrder(e.target.checked)} className="mr-2" />
              <span>Should orders be sent by email?</span>
            </div>

            <div>
              <label className="block font-medium mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded px-3 py-2 w-full" placeholder="vendor@email.com" />
            </div>

            <div>
              <label className="block font-medium mb-1">Order Placement Method</label>
              <select value={orderPlacementMethod} onChange={e => setOrderPlacementMethod(e.target.value)} className="border rounded px-3 py-2 w-full">
                <option value="Email">Email</option>
                <option value="Template">Template</option>
                <option value="Web Portal">Web Portal</option>
                <option value="Telephone">Telephone</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Notes</label>
              <textarea
                className="border rounded px-3 py-2 w-full"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes/credentials/details about this vendor"
                rows={4}
              />
            </div>

            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={newSitesDialogOpen} onOpenChange={setNewSitesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Sites</DialogTitle></DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allSites
              // show only sites that are not existing in vendorSites OR already selectedNewSites
              .filter(s => !vendorSites.find(vs => vs.site === s) || selectedNewSites.includes(s))
              .map(site => (
                <label key={site} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedNewSites.includes(site)}
                    onChange={() => {
                      setSelectedNewSites(prev =>
                        prev.includes(site)
                          ? prev.filter(s => s !== site)   // uncheck
                          : [...prev, site]               // check
                      );

                      // if unchecked, remove from vendorSites
                      if (selectedNewSites.includes(site)) {
                        setVendorSites(prev => prev.filter(vs => vs.site !== site));
                      }
                    }}
                  />
                  {site}
                </label>
              ))}
          </div>

          <DialogFooter>
            <Button onClick={() => {
              // add all newly selected sites to vendorSites if not already present
              setVendorSites(prev => [
                ...prev,
                ...selectedNewSites
                  .filter(site => !prev.find(vs => vs.site === site))
                  .map(site => ({ site, frequency: '' as '', leadTime: null }))
              ]);
              setNewSitesDialogOpen(false);
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}