import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import axios from "axios";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        
        {/* PROVINCE SELECTION */}
        <div>
          <Label>Province</Label>
          <select
            name="province"
            value={formData.province}
            onChange={handleChange}
            className="border rounded px-3 py-2 w-full font-medium"
            required
          >
            {CANADIAN_PROVINCES.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
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

        {/* <div>
          <Label>Email</Label>
          <Input type="email" name="email" value={formData.email} onChange={handleChange} required />
        </div> */}
        {/* Updated Email Field with Button */}
        <div>
          <Label>Station Email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="whitespace-nowrap border-blue-500 text-blue-600 hover:bg-blue-50"
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


        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Site"}
        </Button>
      </form>
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