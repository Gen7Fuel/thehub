import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/custom/locationPicker";
import { Pencil } from "lucide-react";

interface StationSupply {
  name: string;
  upc: string;
  size: string;
}

interface Vendor {
  _id: string;
  name: string;
  location: string;
  station_supplies: StationSupply[];
}

export const Route = createFileRoute('/_navbarLayout/vendor/list')({
  component: RouteComponent,
})

function RouteComponent() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>(localStorage.getItem("location") || "");

  useEffect(() => {
    const fetchVendors = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const params = selectedLocation ? `?location=${encodeURIComponent(selectedLocation)}` : "";
        const res = await fetch(`/api/vendors${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setVendors(data);
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
  }, [selectedLocation]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <LocationPicker
          value="stationName"
          setStationName={setSelectedLocation}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectedLocation("")}
        >
          Clear
        </Button>
      </div>
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
                    <th className="p-2 border">Location</th>
                    {/* <th className="p-2 border">Station Supplies</th> */}
                    <th className="p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr key={vendor._id} className="hover:bg-accent">
                      <td className="p-2 border font-medium">{vendor.name}</td>
                      <td className="p-2 border">
                        <Badge>{vendor.location}</Badge>
                      </td>
                      {/* <td className="p-2 border">
                        <div className="max-h-40 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th className="px-1 py-0.5 border">Name</th>
                                <th className="px-1 py-0.5 border">UPC</th>
                                <th className="px-1 py-0.5 border">Size</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vendor.station_supplies.map((supply, idx) => (
                                <tr key={idx}>
                                  <td className="px-1 py-0.5 border">{supply.name}</td>
                                  <td className="px-1 py-0.5 border">{supply.upc}</td>
                                  <td className="px-1 py-0.5 border">{supply.size}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td> */}
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
      {/* <Button asChild className="mt-6">
        <a href="/vendor/create">Add New Vendor</a>
      </Button> */}
    </div>
  );
}