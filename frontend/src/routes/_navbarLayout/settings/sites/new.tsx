import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import axios from "axios";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute('/_navbarLayout/settings/sites/new')({
  component: NewSiteRouteComponent,
});

function NewSiteRouteComponent() {
    const [formData, setFormData] = useState({
        type: "store", // default type
        stationName: "",
        legalName: "",
        INDNumber: "",
        kardpollCode: "",
        csoCode: "",
        timezone: "America/Toronto", // default timezone
        email: "",
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const router = useRouter(); // ✅ get router instance here


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axios.post("/api/locations", formData, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });

            const createdLocation = response.data; // this will have the _id
            alert(`Location: ${createdLocation.stationName} has been created successfully!`);
            router.load();

            // Navigate to the newly created location's edit page
            navigate({
            to: "/settings/sites/$id",
            params: { id: createdLocation._id },
            });

        } catch (err) {
            console.error(err);
            alert("Failed to create location. Please try again.");
        } finally {
            setLoading(false);
        }
    };


  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-semibold mb-4">Create New Site</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Type</Label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="store">Store</option>
            <option value="backoffice">Backoffice</option>
          </select>
        </div>

        <div>
          <Label>Station Name</Label>
          <Input name="stationName" value={formData.stationName} onChange={handleChange} required />
        </div>

        <div>
          <Label>Legal Name</Label>
          <Input name="legalName" value={formData.legalName} onChange={handleChange} required />
        </div>

        <div>
          <Label>IND Number</Label>
          <Input name="INDNumber" value={formData.INDNumber} onChange={handleChange} required />
        </div>

        <div>
          <Label>Kardpoll Code</Label>
          <Input name="kardpollCode" value={formData.kardpollCode} onChange={handleChange} />
        </div>

        <div>
          <Label>CSO Code</Label>
          <Input name="csoCode" value={formData.csoCode} onChange={handleChange} required />
        </div>

        <div>
          <Label>Timezone</Label>
          <select
            name="timezone"
            value={formData.timezone}
            onChange={handleChange}
            className="border rounded px-3 py-2 w-full"
          >
            <option value="America/Toronto">America/Toronto</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="America/Vancouver">America/Vancouver</option>
          </select>
        </div>

        <div>
          <Label>Email</Label>
          <Input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Site"}
        </Button>
      </form>
    </div>
  );
}