import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import axios from "axios";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/context/AuthContext"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2 } from "lucide-react";

export const Route = createFileRoute('/_navbarLayout/settings/sites/new')({
  component: NewSiteRouteComponent,
});

const CANADIAN_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick",
  "Newfoundland and Labrador", "Nova Scotia", "Ontario",
  "Prince Edward Island", "Quebec", "Saskatchewan",
  "Northwest Territories", "Nunavut", "Yukon"
];

function NewSiteRouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const access = user?.access || {}
  if (!access?.settings?.value) {
    navigate({ to: "/no-access" });
    return;
  }
  const [formData, setFormData] = useState({
    type: "store", // default type
    stationName: "",
    legalName: "",
    INDNumber: "",
    kardpollCode: "",
    csoCode: "",
    timezone: "America/Toronto", // default timezone
    province: "Ontario",
    email: "",
    sellsLottery: false,
    managerEmails: [] as string[],
    gasBuddyStationId: "", // 🚀 NEW: State tracker variable initialized as optional empty string
  });
  const [managerCode, setManagerCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // ✅ get router instance here

  const [users, setUsers] = useState<any[]>([]);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    // Fetch users so we can pick managers even for a new site
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/users/populate-roles', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    fetchUsers();
  }, []);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post("/api/locations", {
        ...formData,
        managerCode, // include OTP value
      }, {
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
    <div className="max-w-5xl p-8">
      <Card>
        <CardHeader className="pb-6 border-b">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">
                Create New Site
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {formData.stationName || "New location"}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Column 1: Identity */}
              <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">
                  Identity
                </h3>

                <div>
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
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
                  <Label>CSO Code</Label>
                  <Input name="csoCode" value={formData.csoCode} onChange={handleChange} required />
                </div>

                <div>
                  <Label>Kardpoll Code</Label>
                  <Input name="kardpollCode" value={formData.kardpollCode} onChange={handleChange} />
                </div>
              </div>

              {/* Column 2: Contact & Region + Access */}
              <div className="p-6 border rounded-xl bg-slate-50/50 space-y-4">
                <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">
                  Contact &amp; Region
                </h3>

                <div>
                  <Label>Station Email</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="flex-1 bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap border-blue-500 text-blue-600 hover:bg-blue-50 bg-white"
                      onClick={() => setManagerDialogOpen(true)}
                    >
                      Add Managers ({formData.managerEmails.length})
                    </Button>
                  </div>
                  {formData.managerEmails.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-1 italic">
                      Manager alerts: {formData.managerEmails.join(", ")}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Province</Label>
                  <Select
                    value={formData.province}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, province: value }))}
                  >
                    <SelectTrigger className="w-full rounded-md border border-gray-300 bg-white">
                      <SelectValue placeholder="Select Province" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {CANADIAN_PROVINCES.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger className="w-full rounded-md border border-gray-300 bg-white">
                      <SelectValue placeholder="Select Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Toronto">America/Toronto</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                      <SelectItem value="America/Denver">America/Denver</SelectItem>
                      <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                      <SelectItem value="America/Vancouver">America/Vancouver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="gasBuddyStationId">GasBuddy Station ID</Label>
                  <Input
                    id="gasBuddyStationId"
                    name="gasBuddyStationId"
                    placeholder="e.g., 205339 (Optional)"
                    value={formData.gasBuddyStationId}
                    onChange={handleChange}
                    className="bg-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Leave blank if this location won't sync live pricing metrics with public maps.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm">Sells Lottery</span>
                  <button
                    type="button"
                    aria-pressed={!!formData.sellsLottery}
                    onClick={() => setFormData({ ...formData, sellsLottery: !formData.sellsLottery })}
                    className={`relative inline-flex items-center h-6 rounded-full w-12 transition-colors duration-150 ${formData.sellsLottery ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full transform transition-transform duration-150 ${formData.sellsLottery ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div>
                  <Label className="block font-medium mb-1">Manager Code</Label>
                  <div className="flex justify-center">
                    <InputOTP maxLength={4} value={managerCode} onChange={setManagerCode}>
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
                  {loading ? "Creating..." : "Create Site"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      {/* --- MANAGER SELECTION DIALOG --- */}
      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Manager Email Notifications</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u._id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{u.firstName} {u.lastName}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer"
                    checked={formData.managerEmails.includes(u.email)}
                    onChange={() => {
                      const emails = formData.managerEmails.includes(u.email)
                        ? formData.managerEmails.filter(e => e !== u.email)
                        : [...formData.managerEmails, u.email];
                      setFormData({ ...formData, managerEmails: emails });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setManagerDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}