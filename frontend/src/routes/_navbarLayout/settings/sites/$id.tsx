import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_navbarLayout/settings/sites/$id")({
  component: RouteComponent,
});

const CANADIAN_PROVINCES = [
  "Alberta",
  "British Columbia",
  "Manitoba",
  "New Brunswick",
  "Newfoundland and Labrador",
  "Nova Scotia",
  "Ontario",
  "Prince Edward Island",
  "Quebec",
  "Saskatchewan",
  "Northwest Territories",
  "Nunavut",
  "Yukon",
];

interface PushoverDevice {
  _id?: string;
  deviceName: string;
  notificationEnabled: boolean;
}

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
  province: string;
  gasBuddyStationId?: string;
  pushOverUserKey: string;
  devices: PushoverDevice[];
}

function RouteComponent() {
  const [showDialog, setShowDialog] = useState(false);
  const [initialBalance, setInitialBalance] = useState("");
  const [hasSafesheet, setHasSafesheet] = useState(false);
  const [managerEmails, setManagerEmails] = useState<string[]>([]);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);

  // --- Pushover State Machinery ---
  const [pushoverDialogOpen, setPushoverDialogOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [isSavingPushover, setIsSavingPushover] = useState(false);

  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = user?.access || {};
  const [location, setLocation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [isSavingUsers, setIsSavingUsers] = useState(false);

  const [otp, setOtp] = useState("");
  const [timezones, setTimezones] = useState<string[]>([]);

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
    managerEmails: [],
    province: "",
    gasBuddyStationId: "",
    pushOverUserKey: "",
    devices: [],
  });

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

  const fetchLocation = async () => {
    if (!access?.settings?.value) {
      setLocation(null);
      navigate({ to: "/no-access" });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/locations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const locData = response.data.location || null;
      setLocation(locData);

      if (locData?.stationName) {
        const sheetCheck = await axios.get(
          `/api/safesheets/${locData.stationName}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        setHasSafesheet(sheetCheck.data.exists);
      }
    } catch (error) {
      console.error("Error fetching location:", error);
      setLocation(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, [id, access?.settings?.value, navigate]);

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
        timezone: location.timezone || timezones[0],
        sellsLottery: !!location.sellsLottery,
        managerEmails: location.managerEmails || [],
        province: location.province || "Ontario",
        gasBuddyStationId: location.gasBuddyStationId || "",
        pushOverUserKey: location.pushOverUserKey || "",
        devices: location.devices || [],
      });
      setManagerEmails(location.managerEmails || []);
      setOtp(location.managerCode?.toString() || "");
    }
  }, [location, timezones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(
        `/api/locations/${id}`,
        {
          ...formData,
          managerCode: otp,
          sellsLottery: !!formData.sellsLottery,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      alert(`Location: ${formData.stationName} has been updated successfully!`);
      await fetchLocation(); // Pull clean database states
    } catch (error) {
      console.error(error);
      alert("Failed to update location. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Required-Permission": "settings",
          },
        },
      );

      alert(`Safesheet created successfully for ${location?.stationName}`);
      setHasSafesheet(true);
      setShowDialog(false);
    } catch (err: any) {
      if (err.status == 403) {
        navigate({ to: "/no-access" });
        return;
      }
      console.error(err);
      alert(err.response?.data?.error || "Failed to create safesheet.");
    }
  };

  const fetchUsersData = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/users/populate-roles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allUsers = res.data;
      setUsers(allUsers);

      if (location?.stationName) {
        const currentlyAssigned = allUsers
          .filter(
            (u: any) => u.site_access && u.site_access[location.stationName],
          )
          .map((u: any) => u._id);
        setSelectedUsers(currentlyAssigned);
      }
    } catch (err) {
      console.error("Failed to load users for assignment", err);
    }
  };

  useEffect(() => {
    if (location?.stationName) {
      fetchUsersData();
    }
  }, [location?.stationName]);

  const toggleUserSelection = (userId: string, isActive: boolean) => {
    if (!isActive) return;
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const saveUserAssignments = async () => {
    setIsSavingUsers(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `/api/locations/${id}/assign-users`,
        {
          userIds: selectedUsers,
          stationName: location?.stationName,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      alert("User assignments updated successfully");
      setAssignDialogOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update assignments");
    } finally {
      setIsSavingUsers(false);
    }
  };

  // --- Granular Pushover Form Actions ---
  const handleAddDeviceRecord = () => {
    const cleanString = newDeviceName.trim();
    if (!cleanString) return;

    if (
      formData.devices.some(
        (d) => d.deviceName.toLowerCase() === cleanString.toLowerCase(),
      )
    ) {
      return alert("A device configuration with this specific label exists.");
    }

    setFormData({
      ...formData,
      devices: [
        ...formData.devices,
        { deviceName: cleanString, notificationEnabled: true },
      ],
    });
    setNewDeviceName("");
  };

  const handleToggleDeviceState = (index: number) => {
    const deepCopiedArray = [...formData.devices];
    deepCopiedArray[index].notificationEnabled =
      !deepCopiedArray[index].notificationEnabled;
    setFormData({ ...formData, devices: deepCopiedArray });
  };

  const handleRemoveDeviceRecord = (index: number) => {
    setFormData({
      ...formData,
      devices: formData.devices.filter((_, i) => i !== index),
    });
  };

  const handleSavePushoverConfiguration = async () => {
    setIsSavingPushover(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/locations/${id}`,
        {
          ...formData,
          managerCode: otp,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      alert("Pushover notification routing array updated successfully!");
      setPushoverDialogOpen(false);
      await fetchLocation();
    } catch (error) {
      console.error(error);
      alert("Failed to update Pushover payload records.");
    } finally {
      setIsSavingPushover(false);
    }
  };

  if (!location)
    return <div className="p-4 text-red-500">Location not found</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-6 border-b">
          {/* Title on the left in a larger, prominent font */}
          <div>
            <CardTitle className="text-2xl font-extrabold tracking-tight text-slate-900">
              Edit Location
            </CardTitle>
          </div>

          {/* Two rows of buttons stacked on the right */}
          <div className="flex flex-col items-end gap-3">
            {/* ROW 1: Sells Lottery & Assigned Users */}
            <div className="flex items-center gap-3">
              {/* Sells Lottery Toggle Group */}
              <div className="flex items-center gap-2 bg-slate-50 border px-3 py-1.5 rounded-lg text-sm">
                <span className="text-muted-foreground font-medium">
                  Sells Lottery
                </span>
                <button
                  type="button"
                  aria-pressed={!!formData.sellsLottery}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      sellsLottery: !formData.sellsLottery,
                    })
                  }
                  className={`relative inline-flex items-center h-5 rounded-full w-10 transition-colors duration-150 ${formData.sellsLottery ? "bg-green-500" : "bg-gray-300"}`}
                >
                  <span
                    className={`inline-block w-3 h-3 bg-white rounded-full transform transition-transform duration-150 ${formData.sellsLottery ? "translate-x-5" : "translate-x-1"}`}
                  />
                </button>
              </div>

              <Button
                variant="outline"
                type="button"
                onClick={() => setAssignDialogOpen(true)}
              >
                Assigned Users ({selectedUsers.length})
              </Button>
            </div>

            {/* ROW 2: Generate Safesheet & Manage Pushover */}
            <div className="flex items-center gap-3">
              {!hasSafesheet && (
                <Button
                  variant="default"
                  type="button"
                  onClick={() => setShowDialog(true)}
                >
                  Generate Safesheet
                </Button>
              )}

              <Button
                variant="outline"
                type="button"
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
                onClick={() => setPushoverDialogOpen(true)}
              >
                🔔 Manage Pushover (
                {formData.devices.filter((d) => d.notificationEnabled).length}{" "}
                Active)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="block font-medium mb-1">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
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

            {[
              { label: "Station Name", name: "stationName" },
              { label: "Legal Name", name: "legalName" },
              { label: "IND Number", name: "INDNumber" },
              { label: "Kardpoll Code", name: "kardpollCode" },
              { label: "CSO Code", name: "csoCode" },
              { label: "Station Email", name: "email" },
            ].map((field) => (
              <div key={field.name}>
                <Label className="block font-medium mb-1">{field.label}</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name={field.name}
                    value={String(
                      formData[field.name as keyof LocationForm] ?? "",
                    )}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.name]: e.target.value })
                    }
                    className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required={[
                      "stationName",
                      "legalName",
                      "INDNumber",
                      "csoCode",
                      "email",
                    ].includes(field.name)}
                  />

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

                {field.name === "email" && managerEmails.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-1 italic">
                    Notifications also CC'd to: {managerEmails.join(", ")}
                  </p>
                )}
              </div>
            ))}

            <div>
              <Label className="block font-medium mb-1">Province</Label>
              <Select
                value={formData.province}
                onValueChange={(value) =>
                  setFormData({ ...formData, province: value })
                }
              >
                <SelectTrigger className="w-full rounded-md border border-gray-300">
                  <SelectValue placeholder="Select Province" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {CANADIAN_PROVINCES.map((prov) => (
                    <SelectItem key={prov} value={prov}>
                      {prov}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block font-medium mb-1">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  setFormData({ ...formData, timezone: value })
                }
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
              <Label
                htmlFor="gasBuddyStationId"
                className="block font-medium mb-1"
              >
                GasBuddy Station ID
              </Label>
              <Input
                id="gasBuddyStationId"
                type="text"
                placeholder="e.g., 205339"
                value={formData.gasBuddyStationId || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gasBuddyStationId: e.target.value,
                  })
                }
                className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
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

      {/* --- PUSHOVER HARDWARE MANAGER MODAL --- */}
      <Dialog open={pushoverDialogOpen} onOpenChange={setPushoverDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Fuel Pricing Pushover Integration
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Define the store Pushover account keys and activate specific
              counter tablets to process looped sound sequences.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto my-2 space-y-4 pr-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="pushOverUserKey"
                className="font-semibold text-sm"
              >
                Pushover User/Group Key
              </Label>
              <div className="relative group">
                <Input
                  id="pushOverUserKey"
                  // FIXED: Uses password type by default, switches securely to normal text on hover via Tailwind variants
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={formData.pushOverUserKey}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pushOverUserKey: e.target.value,
                    })
                  }
                  className="font-mono text-sm tracking-widest group-hover:tracking-normal group-hover:[type='text'] transition-all duration-150"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-xs text-muted-foreground opacity-70 group-hover:opacity-0 transition-opacity">
                  Hover to reveal
                </div>
              </div>
            </div>

            <div className="border rounded-xl p-4 bg-slate-50/50 space-y-3">
              <Label className="font-semibold text-sm block">
                Provision Hardware Targets
              </Label>

              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g., burl_tablet_1"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (e.preventDefault(), handleAddDeviceRecord())
                  }
                  className="bg-white"
                />
                <Button type="button" onClick={handleAddDeviceRecord}>
                  Add Device
                </Button>
              </div>

              <div className="space-y-1.5 mt-2 max-h-48 overflow-y-auto">
                {formData.devices.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">
                    No terminal devices provisioned for this site.
                  </p>
                ) : (
                  formData.devices.map((device, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border p-2.5 rounded-lg text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono font-medium text-slate-800">
                          {device.deviceName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500">
                            Enabled
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleDeviceState(idx)}
                            className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${device.notificationEnabled ? "bg-green-500" : "bg-gray-300"}`}
                          >
                            <span
                              className={`inline-block w-3 h-3 bg-white rounded-full transform transition-transform ${device.notificationEnabled ? "translate-x-5" : "translate-x-1"}`}
                            />
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                          onClick={() => handleRemoveDeviceRecord(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => setPushoverDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePushoverConfiguration}
              disabled={isSavingPushover}
            >
              {isSavingPushover ? "Saving..." : "Save Route Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- REMAINDER DIALOGS PRESERVED UNCHANGED --- */}
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
            <DialogTitle className="text-2xl">
              Manage Site Access: {location?.stationName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <div className="grid grid-cols-1 gap-2">
              {users.map((u) => {
                const isActive = u.is_active !== false;
                return (
                  <div
                    key={u._id}
                    className={`flex items-center justify-between p-4 border rounded-xl transition-all ${isActive ? "hover:bg-slate-50 border-slate-200" : "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"}`}
                  >
                    <div className="flex flex-col">
                      <span
                        className={`font-semibold text-lg ${!isActive && "text-slate-500"}`}
                      >
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {u.email}
                        <span
                          className={`ml-2 font-mono px-2 py-0.5 rounded text-xs uppercase ${isActive ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50 font-bold"}`}
                        >
                          [
                          {!isActive
                            ? "INACTIVE"
                            : u.role?.role_name || "No Role"}
                          ]
                        </span>
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!isActive}
                      className={`h-6 w-6 rounded-md border-gray-300 text-primary focus:ring-primary ${isActive ? "cursor-pointer" : "cursor-not-allowed"}`}
                      checked={selectedUsers.includes(u._id)}
                      onChange={() => toggleUserSelection(u._id, isActive)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
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

      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Assign Manager Notifications: {location?.stationName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <div className="grid grid-cols-1 gap-2">
              {users.map((u) => {
                const isActive = u.is_active !== false;
                return (
                  <div
                    key={u._id}
                    className={`flex items-center justify-between p-4 border rounded-xl transition-all ${isActive ? "hover:bg-slate-50 border-slate-200" : "bg-slate-100 opacity-60"}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg">
                        {u.firstName} {u.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {u.email}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!isActive}
                      className="h-6 w-6 rounded-md cursor-pointer"
                      checked={managerEmails.includes(u.email)}
                      onChange={() =>
                        setManagerEmails((prev) =>
                          prev.includes(u.email)
                            ? prev.filter((e) => e !== u.email)
                            : [...prev, u.email],
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => setManagerDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setFormData({ ...formData, managerEmails });
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
