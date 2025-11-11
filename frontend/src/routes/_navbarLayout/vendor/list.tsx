import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Vendor {
  _id: string;
  name: string;
  category?: string;
  order_placement_method?: string;
  vendor_order_frequency: number;
  location: string;
}

interface GroupedVendor {
  _id: string;
  name: string;
  category?: string;
  order_placement_method?: string;
  vendor_order_frequencies?: (number | "")[]; // ← allow array of numbers or empty strings
  locations: { site: string; frequency: number | "" }[];
}


export const Route = createFileRoute('/_navbarLayout/vendor/list')({
  component: RouteComponent,
});

function RouteComponent() {
  // const [vendors, setVendors] = useState<Vendor[]>([]);3
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<GroupedVendor[]>([]); // ← use GroupedVendor
  const [selectedVendor, setSelectedVendor] = useState<{
    name: string;
    locations: { site: string; frequency: number | "" }[];
  } | null>(null);

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/vendors`, {
          headers: { Authorization: `Bearer ${token}`,"X-Required-Permission": "vendor" },
        });
        if (res.ok) {
          const data: Vendor[] = await res.json();

          const grouped: GroupedVendor[] = Object.values(
            data.reduce((acc: Record<string, GroupedVendor>, v) => {
              if (!acc[v.name]) {
                acc[v.name] = {
                  _id: v._id,
                  name: v.name,
                  category: v.category,
                  order_placement_method: v.order_placement_method,
                  vendor_order_frequencies: [(v as any).vendor_order_frequency || ""],
                  locations: [{ site: (v as any).location, frequency: (v as any).vendor_order_frequency || "" }],
                };
              } else {
                acc[v.name].locations.push({ site: (v as any).location, frequency: (v as any).vendor_order_frequency || "" });
                acc[v.name].vendor_order_frequencies = [
                  ...(acc[v.name].vendor_order_frequencies ?? []),
                  (v as any).vendor_order_frequency || ""
                ];

              }
              return acc;
            }, {})
          );
          setVendors(grouped);
        } else if(res.status == 403) {
          navigate({to:"/no-access"})
          return;
        } else {
          setVendors([]);
        }
      } catch {
        setVendors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : vendors.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No vendors found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="p-2 border">Vendor Name</th>
                    <th className="p-2 border">Category</th>
                    <th className="p-2 border">Order Placement Method</th>
                    <th className="p-2 border text-center">Assigned</th>
                    <th className="p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor: any) => (
                    <tr key={vendor._id} className="hover:bg-accent">
                      <td className="p-2 border font-medium">{vendor.name}</td>
                      <td className="p-2 border font-medium">{vendor.category}</td>
                      <td className="p-2 border font-medium">{vendor.order_placement_method}</td>
                      <td className="p-2 border text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSelectedVendor({
                                  name: vendor.name,
                                  locations: vendor.locations,
                                })
                              }
                            >
                              View ({vendor.locations.length})
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Assigned Locations for {selectedVendor?.name}
                              </DialogTitle>
                            </DialogHeader>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              {selectedVendor?.locations.map((loc, idx) => (
                                <li key={idx}>
                                  {loc.site} {loc.frequency !== "" ? `- ${loc.frequency} week(s)` : ""}
                                </li>
                              ))}
                            </ul>
                          </DialogContent>
                        </Dialog>
                      </td>
                      <td className="p-2 border text-center">
                        <Button
                          variant="outline"
                          size="icon"
                          asChild
                          title="Edit Vendor"
                        >
                          <a href={`/vendor/edit/${vendor._id}`}>
                            <Pencil className="h-4 w-4" />
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
