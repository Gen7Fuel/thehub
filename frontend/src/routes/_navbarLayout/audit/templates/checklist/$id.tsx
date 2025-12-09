import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import axios from "axios";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useNavigate, useParams } from "@tanstack/react-router";
import { MultiSelect } from '@/components/custom/multiSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute(
  '/_navbarLayout/audit/templates/checklist/$id',
)({
  component: RouteComponent,
})

interface SelectOption {
  text: string;
}
interface SelectTemplate {
  _id: string;
  name: string;
  options: SelectOption[];
}

interface ChecklistItem {
  category: string;
  item: string;
  statusTemplate: string;
  followUpTemplate: string;
  assignedTo: string;
  frequency?: "daily" | "weekly" | "monthly" | "";
  assignedSites?: { site: string; assigned: boolean }[];
  vendor?: string;
  commentRequired?: boolean;
  _open?: boolean;
  _viewOptionsOpen?: boolean;
}

function RouteComponent() {
  const { id } = useParams({ from: '/_navbarLayout/audit/templates/checklist/$id' });
  const [selectTemplates, setSelectTemplates] = useState<SelectTemplate[]>([]);
  const [items, setItems] = useState<ChecklistItem[]>([
    { category: "", item: "", statusTemplate: "", followUpTemplate: "Follow Up", assignedTo: "Assigned To", frequency: "daily", commentRequired: false, _open: false },
  ]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [sites, setSites] = useState<{ _id: string; stationName: string }[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);

  const [uniqueVendors, setUniqueVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  // Fetch locations
  // useEffect(() => {
  //   axios
  //     .get("/api/locations", {
  //       headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  //     })
  //     .then(res => setSites(res.data))
  //     .catch(() => setSites([]));
  // }, []);

  // Fetch select templates
  // useEffect(() => {
  //   axios
  //     .get("/api/audit/select-templates", {
  //       headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  //     })
  //     .then(res => setSelectTemplates(res.data))
  //     .catch(() => setSelectTemplates([]));
  // }, []);

  // // Fetch audit template data
  // useEffect(() => {
  //   axios
  //     .get(`/api/audit/${id}`, {
  //       headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  //     })
  //     .then(res => {
  //       setName(res.data.templateName || "");
  //       setDescription(res.data.description || "");
  //       setItems(
  //         res.data.items && res.data.items.length > 0
  //           ? res.data.items.map((item: any) => ({
  //               category: item.category || "",
  //               item: item.item || "",
  //               statusTemplate: item.statusTemplate || "",
  //               followUpTemplate: item.followUpTemplate || "",
  //               assignedTo: item.assignedTo || "",
  //               frequency: item.frequency || "",
  //               vendor: item.suppliesVendor || "",
  //               assignedSites: item.assignedSites || (res.data.sites || []).map((s: string) => ({
  //                 site: s,
  //                 assigned: false,
  //               })),
  //             }))
  //           : [{ category: "", item: "", statusTemplate: "", followUpTemplate: "", assignedTo: "",  frequency: "", vendor: "",
  //                 assignedSites: (res.data.sites || []).map((s: string) => ({
  //                   site: s,
  //                   assigned: false,
  //                 })),
  //             }]
  //       );
  //       setSelectedSites(res.data.sites || []);
  //     })
  //     .catch(() => setError("Failed to load audit template"));
  // }, [id]);

  // useEffect(() => {
  //     const fetchVendors = async () => {
  //       try {
  //         const token = localStorage.getItem("token");
  //         const res = await fetch("/api/vendors", {
  //           headers: { Authorization: `Bearer ${token}` },
  //         });
  //         if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  //         const data = (await res.json()) as { name: string; category: string }[];

  //         // Filter only vendors with category = "Station Supplies"
  //         const stationVendors = data.filter(
  //           (v) => v.category?.trim() === "Station Supplies"
  //         );

  //         // Extract unique vendor names
  //         const vendors = Array.from(new Set(stationVendors.map((v) => v.name).filter(Boolean)));
  //         setUniqueVendors(vendors);

  //       } catch (err) {
  //         console.error("Failed to fetch vendors:", err);
  //       }
  //     };

  //     fetchVendors();
  //   }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true); // start loading
        const token = localStorage.getItem("token");
        const headers = {
          Authorization: `Bearer ${token}`,
          "X-Required-Permission": "stationAudit.template",
        };

        // Fetch all necessary data in parallel
        const [auditRes, selectRes, vendorRes, sitesRes] = await Promise.all([
          axios.get(`/api/audit/${id}`, { headers }),
          axios.get("/api/audit/select-templates", { headers }),
          axios.get("/api/vendors", { headers }),
          axios.get("/api/locations", { headers }),
        ]);

        // ✅ Check if any of the responses returned 403
        if (
          auditRes.status === 403 ||
          selectRes.status === 403 ||
          vendorRes.status === 403 ||
          sitesRes.status === 403
        ) {
          navigate({ to: "/no-access" });
          return;
        }

        // --- handle select templates
        setSelectTemplates(selectRes.data);

        // --- handle vendors
        const vendorData = vendorRes.data as { name: string; category: string }[];
        const stationVendors = vendorData.filter(
          (v) => v.category?.trim() === "Station Supplies"
        );
        const vendors = Array.from(
          new Set(stationVendors.map((v) => v.name).filter(Boolean))
        );
        setUniqueVendors(vendors);

        // --- handle sites
        setSites(sitesRes.data);

        // --- handle audit template
        const audit = auditRes.data;
        setName(audit.templateName || "");
        setDescription(audit.description || "");
        setSelectedSites(audit.sites || []);

        setItems(
          audit.items && audit.items.length > 0
            ? audit.items.map((item: any) => ({
              category: item.category || "",
              item: item.item || "",
              statusTemplate: item.statusTemplate || "",
              followUpTemplate: item.followUpTemplate || "",
              assignedTo: item.assignedTo || "",
              frequency: item.frequency || "",
              vendor: item.suppliesVendor || "",
              commentRequired: item.commentRequired || false,
              _open: false,
              assignedSites:
                item.assignedSites ||
                (audit.sites || []).map((s: string) => ({
                  site: s,
                  assigned: false,
                })),
            }))
            : [
              {
                category: "",
                item: "",
                statusTemplate: "",
                followUpTemplate: "",
                assignedTo: "",
                frequency: "",
                vendor: "",
                commentRequired: false,
                _open: false,
                assignedSites: (audit.sites || []).map((s: string) => ({
                  site: s,
                  assigned: false,
                })),
              },
            ]
        );
      } catch (err) {
        console.error("Failed to load audit template data:", err);
        setError("Failed to load audit template data");
      } finally {
        setLoading(false); // done loading
      }
    };

    fetchAllData();
  }, [id]);

  const handleSiteToggle = (site: string) => {
    setSelectedSites(selected =>
      selected.includes(site)
        ? selected.filter(s => s !== site)
        : [...selected, site]
    );
  };

  const getOptionsByName = (name: string) =>
    selectTemplates.find(t => t.name === name)?.options || [];

  const handleItemChange = (idx: number, field: keyof ChecklistItem, value: string | boolean) => {
    setItems(items =>
      items.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  // const addRow = () =>
  //   setItems([...items, { category: "", item: "", status: "", followUp: "Follow Up", assignedTo: "Assigned To" }]);
  const addRow = () =>
    setItems([...items, { category: "", item: "", statusTemplate: "", followUpTemplate: "Follow Up", assignedTo: "Assigned To", frequency: "", assignedSites: selectedSites.map(site => ({ site, assigned: false })), commentRequired: false, _open: true, }]);

  const removeRow = (idx: number) =>
    setItems(items => items.length > 1 ? items.filter((_, i) => i !== idx) : items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    // Map items to backend schema
    const mappedItems = items.map(row => ({
      item: row.item,
      category: row.category,
      statusTemplate: row.statusTemplate,
      followUpTemplate: row.followUpTemplate,
      assignedTo: row.assignedTo,
      frequency: row.frequency,
      vendor: row.vendor || "",
      assignedSites: row.assignedSites || [],
      commentRequired: row.commentRequired,
    }));


    const payload = {
      name,
      description,
      items: mappedItems,
      sites: selectedSites,
      // createdBy will be set in backend
    };
    console.log("Submitting checklist template:", payload);

    try {
      const res = await axios.put(
        `/api/audit/${id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "X-Required-Permission": "stationAudit.template",
          },
        }
      );

      if (res.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      navigate({ to: "/audit/templates/checklist/list" });
    } catch (err: any) {
      if (err.response?.status === 403) {
        navigate({ to: "/no-access" });
      } else {
        setError(err?.response?.data?.message || "Failed to update checklist template");
      }
    } finally {
      setSaving(false);
    }

  };

  const toggleRow = (idx: number) => {
    setItems(prev =>
      prev.map((r, i) =>
        i === idx ? { ...r, _open: !r._open } : r
      )
    );
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600 text-lg">
        Loading checklist template...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 p-4 border rounded">
      <h2 className="text-xl font-bold mb-4">Edit Audit Checklist Template</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block font-medium">Template Name</label>
            <input
              className="border px-2 py-1 w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="block font-medium">Description</label>
            <input
              className="border px-2 py-1 w-full"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block font-medium mb-1">Assign to Sites</label>
          <div className="flex flex-wrap gap-4">
            {sites.map(site => (
              <label key={site._id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedSites.includes(site.stationName)}
                  onChange={() => handleSiteToggle(site.stationName)}
                />
                {site.stationName}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div className="space-y-3">
            {items.map((row, idx) => (
              <div key={idx} className="border rounded-lg bg-white shadow-sm">
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleRow(idx)}
                  className="w-full text-left px-4 py-3 flex justify-between items-center bg-gray-50 border-b"
                >
                  <span className="font-semibold">
                    {row.category || "No Category"} — {row.item || "New Item"}
                  </span>
                  <span className="text-xl">{row._open ? "−" : "+"}</span>
                </button>

                {/* Accordion Content */}
                {row._open && (
                  <div className="p-4 space-y-4">
                    {/* Category + Assigned To */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-medium">Category</label>
                        <Select
                          value={row.category}
                          onValueChange={val => handleItemChange(idx, "category", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {getOptionsByName("Category").map((opt, i) => (
                              <SelectItem key={i} value={opt.text}>
                                {opt.text}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="font-medium">Assigned To</label>
                        <Select
                          value={row.assignedTo}
                          onValueChange={val => handleItemChange(idx, "assignedTo", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {getOptionsByName("Assigned To").map((opt, i) => (
                              <SelectItem key={i} value={opt.text}>
                                {opt.text}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Item Text */}
                    <div>
                      <label className="font-medium">Item to be Checked</label>
                      <input
                        className="border px-2 py-1 w-full"
                        value={row.item}
                        onChange={e => handleItemChange(idx, "item", e.target.value)}
                        required
                      />
                    </div>

                    {/* Status + Frequency */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Status Template + View Options */}
                      <div className="flex flex-col">
                        <label className="font-medium">Status Template</label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={row.statusTemplate}
                            onValueChange={val => handleItemChange(idx, "statusTemplate", val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectTemplates.map((opt, i) => (
                                <SelectItem key={i} value={opt.name}>
                                  {opt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* View Options button, only if statusTemplate is selected */}
                          {row.statusTemplate && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setItems(prev =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, _viewOptionsOpen: true } : r
                                  )
                                )
                              }
                            >
                              View Options
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Frequency */}
                      <div>
                        <label className="font-medium">Frequency</label>
                        <Select
                          value={row.frequency}
                          onValueChange={val =>
                            handleItemChange(idx, "frequency", val as "daily" | "weekly" | "monthly")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Dialog for viewing status template options */}
                    <Dialog
                      open={!!row._viewOptionsOpen}
                      onOpenChange={(open) =>
                        setItems(prev =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, _viewOptionsOpen: open } : r
                          )
                        )
                      }
                    >
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Status Template Options</DialogTitle>
                        </DialogHeader>

                        <ul className="list-disc list-inside mt-2">
                          {selectTemplates
                            .find(t => t.name === row.statusTemplate)
                            ?.options.map((opt, i) => (
                              <li key={i}>{opt.text}</li>
                            ))}
                        </ul>

                        <div className="mt-4 text-right">
                          <Button
                            type="button"
                            onClick={() =>
                              setItems(prev =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, _viewOptionsOpen: false } : r
                                )
                              )
                            }
                          >
                            Close
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>


                    {/* Vendor */}
                    {name === "Orders" && (
                      <div>
                        <label className="font-medium">Vendor</label>
                        <Select
                          value={row.vendor || ""}
                          onValueChange={val => handleItemChange(idx, "vendor", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueVendors.map((v, i) => (
                              <SelectItem key={i} value={v}>
                                {v}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Assigned Sites */}
                    <div>
                      <label className="font-medium">Assigned Sites</label>
                      <MultiSelect
                        options={selectedSites}
                        selected={row.assignedSites?.filter(s => s.assigned).map(s => s.site) || []}
                        onChange={newSelected => {
                          setItems(prev =>
                            prev.map((r, i) =>
                              i === idx
                                ? {
                                  ...r,
                                  assignedSites: selectedSites.map(site => ({
                                    site,
                                    assigned: newSelected.includes(site),
                                  })),
                                }
                                : r
                            )
                          );
                        }}
                      />
                    </div>

                    {/* Comment Required */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.commentRequired || false}
                        onChange={e => handleItemChange(idx, "commentRequired", e.target.checked)}
                      />
                      <span className="font-medium">Comment Required</span>
                    </div>

                    {/* Remove Button */}
                    <div className="text-right">
                      <button
                        type="button"
                        className="text-red-500"
                        onClick={() => removeRow(idx)}
                        disabled={items.length === 1}
                      >
                        Remove Item
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Row Button */}
            <Button type="button" className="mt-3" onClick={addRow}>
              + Add Item
            </Button>
          </div>
        </div>


        {error && <div className="text-red-600">{error}</div>}
        <Button type="submit" className="bg-gray-700 text-white px-4 py-2 rounded" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}