import { createFileRoute, useNavigate } from '@tanstack/react-router';
import axios from "axios";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
// import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"; // 🧩 NEW: make sure Dialog is imported from shadcn/ui
import { Input } from "@/components/ui/input"; // 🧩 NEW
// import { useAuth } from '@/context/AuthContext';
// import {
//   InputOTP,
//   InputOTPGroup,
//   InputOTPSlot,
// } from "@/components/ui/input-otp";

export const Route = createFileRoute('/_navbarLayout/settings/sites/$id')({
  component: RouteComponent,
});

function RouteComponent() {
  const [showDialog, setShowDialog] = useState(false); // 🧩 NEW
  const [initialBalance, setInitialBalance] = useState(""); // 🧩 NEW
  const [hasSafesheet, setHasSafesheet] = useState(false); // 🧩 NEW
  const [managerEmails, setManagerEmails] = useState<string[]>([]); // Current selected emails
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = user?.access || {};
  const [location, setLocation] = useState<{
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
    sellsLottery?: boolean;
    managerEmails: string[];
  } | null>(null);

  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [isSavingUsers, setIsSavingUsers] = useState(false);

  useEffect(() => {
    const fetchLocation = async () => {
      // Check frontend permission first
      if (!access?.settings?.value) {
        setLocation(null); // clear location
        navigate({ to: '/no-access' });
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/locations/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setLocation(response.data.location || null);
      } catch (error) {
        console.error('Error fetching location:', error);
        setLocation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [id, access?.settings?.value, navigate]);

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
    sellsLottery?: boolean;
    managerEmails: string[];
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
    sellsLottery: false,
    managerEmails: []
  });

  const [timezones, setTimezones] = useState<string[]>([]);
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
        sellsLottery: !!location.sellsLottery,
        managerEmails: location.managerEmails || [],
      });
      setManagerEmails(location.managerEmails || []);
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
        sellsLottery: !!formData.sellsLottery,
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

  // Fetch location
  useEffect(() => {
    const fetchLocation = async () => {
      if (!access?.settings?.value) {
        setLocation(null);
        navigate({ to: '/no-access' });
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/locations/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLocation(response.data.location || null);

        // 🧩 Check if safesheet already exists
        if (response.data.location?.stationName) {
          const site = response.data.location.stationName;
          const sheetCheck = await axios.get(`/api/safesheets/${site}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setHasSafesheet(sheetCheck.data.exists);
        }
      } catch (error) {
        console.error('Error fetching location:', error);
        setLocation(null);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [id, access?.settings?.value, navigate]);

  // 🧩 Function to create safesheet
  const handleGenerateSafesheet = async () => {
    if (!initialBalance) return alert("Please enter an initial balance.");

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/safesheets",
        {
          site: location?.stationName,
          initialBalance: Number(initialBalance),
        },
        {
          headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" },
        }
      );

      alert(`Safesheet created successfully for ${location?.stationName}`);
      setHasSafesheet(true);
      setShowDialog(false);
    } catch (err: any) {
      if (err.status == 403) {
        navigate({ to: "/no-access" })
        return;
      }
      console.error(err);
      alert(err.response?.data?.error || "Failed to create safesheet.");
    }
  };

  // Fetch Users and their current access
  // Function to fetch users and sync the count/selections
  const fetchUsersData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/users/populate-roles', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const allUsers = res.data;
      setUsers(allUsers);

      // Populate initial selections based on stationName for the count (n)
      if (location?.stationName) {
        const currentlyAssigned = allUsers
          .filter((u: any) => u.site_access && u.site_access[location.stationName])
          .map((u: any) => u._id);
        setSelectedUsers(currentlyAssigned);
      }
    } catch (err) {
      console.error("Failed to load users for assignment", err);
    }
  };

  // Trigger fetch on load or when location changes
  useEffect(() => {
    if (location?.stationName) {
      fetchUsersData();
    }
  }, [location?.stationName]);

  // Open dialog and trigger fetch
  const openAssignUsersDialog = () => {
    // fetchUsersData();
    setAssignDialogOpen(true);
  };

  const toggleUserSelection = (userId: string, isActive: boolean) => {
    // Prevent toggling if the user is inactive
    if (!isActive) return;

    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const saveUserAssignments = async () => {
    setIsSavingUsers(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`/api/locations/${id}/assign-users`, {
        userIds: selectedUsers,
        stationName: location?.stationName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("User assignments updated successfully");
      setAssignDialogOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update assignments");
    } finally {
      setIsSavingUsers(false);
    }
  };

  if (!location) return <div className="p-4 text-red-500">Location not found</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Edit Location</CardTitle>

          <div className="flex items-center gap-4">
            {/* Sells Lottery toggle (styled) */}
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

            {/* NEW: Assigned Users Button */}
            <Button variant="outline" onClick={openAssignUsersDialog}>
              Assigned Users ({selectedUsers.length})
            </Button>

            {/* 🧩 Generate Safesheet Button (only show if not created yet) */}
            {!hasSafesheet && (
              <Button
                variant="default"
                onClick={() => setShowDialog(true)}
              >
                Generate Safesheet
              </Button>
            )}
          </div>
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
            {/* {[
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
                  value={String(formData[field.name as keyof LocationForm] ?? "")}
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
            ))} */}
            {/* TEXT INPUT FIELDS */}
            {[
              { label: "Station Name", name: "stationName" },
              { label: "Legal Name", name: "legalName" },
              { label: "IND Number", name: "INDNumber" },
              { label: "Kardpoll Code", name: "kardpollCode" },
              { label: "CSO Code", name: "csoCode" },
              { label: "Station Email", name: "email" }, // Changed label slightly for clarity
            ].map((field) => (
              <div key={field.name}>
                <Label className="block font-medium mb-1">{field.label}</Label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    name={field.name}
                    value={String(formData[field.name as keyof LocationForm] ?? "")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [field.name as keyof LocationForm]: e.target.value,
                      })
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required={["stationName", "legalName", "INDNumber", "csoCode", "email"].includes(field.name)}
                  />

                  {/* 🧩 NEW: Add "Manage Managers" button specifically for the email field */}
                  {field.name === "email" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="whitespace-nowrap border-blue-500 text-blue-600 hover:bg-blue-50"
                      onClick={() => setManagerDialogOpen(true)}
                    >
                      Manage Managers ({managerEmails.length})
                    </Button>
                  )}
                </div>

                {/* Optional: Show a small list of assigned managers under the email field */}
                {field.name === "email" && managerEmails.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-1 italic">
                    Notifications also CC'd to: {managerEmails.join(", ")}
                  </p>
                )}
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

      {/* 🧩 Dialog for entering initial balance */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Safesheet</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Label>Initial Balance</Label>
            <Input
              type="number"
              placeholder="Enter initial balance"
              value={initialBalance}
              onChange={(e: any) => setInitialBalance(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button onClick={() => setShowDialog(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleGenerateSafesheet}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Manage Site Access: {location?.stationName}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <div className="grid grid-cols-1 gap-2">
              {users.map((u) => {
                const isActive = u.is_active !== false; // Assuming default is true
                return (
                  <div
                    key={u._id}
                    className={`flex items-center justify-between p-4 border rounded-xl transition-all ${isActive
                      ? "hover:bg-slate-50 border-slate-200"
                      : "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                      }`}
                  >
                    <div className="flex flex-col">
                      <span className={`font-semibold text-lg ${!isActive && "text-slate-500"}`}>
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {u.email}
                        <span className={`ml-2 font-mono px-2 py-0.5 rounded text-xs uppercase ${isActive
                          ? "text-blue-600 bg-blue-50"
                          : "text-red-600 bg-red-50 font-bold"
                          }`}>
                          [{!isActive ? "INACTIVE" : (u.role?.role_name || 'No Role')}]
                        </span>
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      disabled={!isActive} // Lock the checkbox
                      className={`h-6 w-6 rounded-md border-gray-300 text-primary focus:ring-primary ${isActive ? "cursor-pointer" : "cursor-not-allowed"
                        }`}
                      checked={selectedUsers.includes(u._id)}
                      onChange={() => toggleUserSelection(u._id, isActive)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveUserAssignments}
              disabled={isSavingUsers}
              className="min-w-[120px]"
            >
              {isSavingUsers ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* --- MANAGER EMAIL ASSIGNMENT DIALOG --- */}
      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Assign Manager Notifications: {location?.stationName}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Selected users will receive manager-level alerts (Audits, Order Recs) in their personal Hub inbox.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <div className="grid grid-cols-1 gap-2">
              {users.map((u) => {
                const isActive = u.is_active !== false;
                return (
                  <div
                    key={u._id}
                    className={`flex items-center justify-between p-4 border rounded-xl transition-all ${isActive ? "hover:bg-slate-50 border-slate-200" : "bg-slate-100 opacity-60"
                      }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg">{u.firstName} {u.lastName}</span>
                      <span className="text-sm text-muted-foreground">{u.email}</span>
                    </div>

                    <input
                      type="checkbox"
                      disabled={!isActive}
                      className="h-6 w-6 rounded-md cursor-pointer"
                      checked={managerEmails.includes(u.email)}
                      onChange={() => {
                        setManagerEmails(prev =>
                          prev.includes(u.email)
                            ? prev.filter(e => e !== u.email)
                            : [...prev, u.email]
                        );
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setManagerDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setFormData({ ...formData, managerEmails: managerEmails });
                setManagerDialogOpen(false);
              }}
            >
              Confirm Selection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}