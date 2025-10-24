import { createFileRoute } from '@tanstack/react-router';
import axios from "axios";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
// import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute('/_navbarLayout/settings/sites/$id')({
  loader: async ({ params }) => {
    const { id } = params;
    try {
      const response = await axios.get(`/api/locations/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return { location: response.data.location };
    } catch (error) {
      console.error('Error fetching location:', error);
      return { location: null };
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { location } = Route.useLoaderData() as {
    location: {
      _id: string;
      type: string;
      stationName: string;
      legalName: string;
      INDNumber: string;
      kardpollCode: string;
      csoCode: string;
      timezone: string;
      email: string;
      managerCode: number;
    } | null;
  };
  const [otp, setOtp] = useState(""); // controlled OTP string

  interface LocationForm {
    type: string;
    stationName: string;
    legalName: string;
    INDNumber: string;
    kardpollCode?: string;
    csoCode: string;
    timezone: string;
    email: string;
  }

  const [formData, setFormData] = useState<LocationForm>({
    type: "",
    stationName: "",
    legalName: "",
    INDNumber: "",
    kardpollCode: "",
    csoCode: "",
    timezone: "",
    email: "",
  });

  const [timezones, setTimezones] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  // const navigate = useNavigate();

  useEffect(() => {
    try {
      const allZones = Intl.supportedValuesOf("timeZone");
      const americanZones = allZones.filter((tz) => tz.startsWith("America/"));
      setTimezones(americanZones);
    } catch {
      setTimezones([
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Toronto",
        "America/Vancouver",
        "America/Phoenix",
        "America/Anchorage",
        "America/Honolulu",
      ]);
    }
  }, []);

  useEffect(() => {
    if (location && timezones.length > 0) {
      setFormData({
        type: location.type || "",
        stationName: location.stationName || "",
        legalName: location.legalName || "",
        INDNumber: location.INDNumber || "",
        kardpollCode: location.kardpollCode || "",
        csoCode: location.csoCode || "",
        email: location.email || "",
        timezone: location.timezone || timezones[0], // default if missing
      });
      setOtp(location.managerCode?.toString() || "");
    }
  }, [location, timezones]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`/api/locations/${id}`, {
        ...formData,
        managerCode: otp, // send OTP as managerCode
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      alert(`Location: ${formData.stationName} has been updated successfully!`);
      // No navigation — stay on the same page
    } catch (error) {
      console.error(error);
      alert("Failed to update location. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  if (!location) {
    return <div className="p-4 text-red-500">Location not found</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Location</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* TYPE DROPDOWN */}
            <div>
              <Label className="block font-medium mb-1">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger className="w-full rounded-md border border-gray-300">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="backoffice">Backoffice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* TEXT INPUT FIELDS */}
            {[
              { label: "Station Name", name: "stationName" },
              { label: "Legal Name", name: "legalName" },
              { label: "IND Number", name: "INDNumber" },
              { label: "Kardpoll Code", name: "kardpollCode" },
              { label: "CSO Code", name: "csoCode" },
              { label: "Email", name: "email" },
            ].map((field) => (
              <div key={field.name}>
                <Label className="block font-medium mb-1">{field.label}</Label>
                <input
                  type="text"
                  name={field.name}
                  value={formData[field.name as keyof LocationForm] || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      [field.name as keyof LocationForm]: e.target.value,
                    })
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required={["stationName", "legalName", "INDNumber", "csoCode", "email"].includes(field.name)}
                />
              </div>
            ))}

            {/* TIMEZONE DROPDOWN */}
            <div>
              <Label className="block font-medium mb-1">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger className="w-full rounded-md border border-gray-300">
                  <SelectValue placeholder="Select Timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="block font-medium mb-1">Manager Code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}