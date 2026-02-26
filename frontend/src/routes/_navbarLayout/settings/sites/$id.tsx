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

// // export const Route = createFileRoute('/_navbarLayout/settings/sites/$id')({
// //   loader: async ({ params }) => {
// //     const { id } = params;
// //     try {
// //       const response = await axios.get(`/api/locations/${id}`, {
// //         headers: {
// //           Authorization: `Bearer ${localStorage.getItem('token')}`,
// //           "X-Required-Permission": "settings",
// //         },
// //       });
// //       return { location: response.data.location, noAccess: false };
// //     } catch (error: any) {
// //       console.error('Error fetching location:', error);

// //       // If 403, set noAccess flag
// //       const noAccess = axios.isAxiosError(error) && error.response?.status === 403;
// //       return { location: null, noAccess };
// //     }
// //   },
// //   component: RouteComponent,
// // });

// export const Route = createFileRoute('/_navbarLayout/settings/sites/$id')({
//   component: RouteComponent,
// });

// function RouteComponent() {
  // const { id } = Route.useParams();
  // const navigate = useNavigate();
  // const { user  } = useAuth();
  // const access = user?.access || {};
  // const [location, setLocation] = useState<{
  //   _id: string;
  //   type: string;
  //   stationName: string;
  //   legalName: string;
  //   INDNumber: string;
  //   kardpollCode: string;
  //   csoCode: string;
  //   timezone: string;
  //   email: string;
  //   managerCode: number;
  // } | null>(null);

  // const [loading, setLoading] = useState(true);

  // useEffect(() => {
  //   const fetchLocation = async () => {
  //     // Check frontend permission first
  //     if (!access?.settings) {
  //       setLocation(null); // clear location
  //       navigate({ to: '/no-access' });
  //       return;
  //     }

  //     try {
  //       const token = localStorage.getItem('token');
  //       const response = await axios.get(`/api/locations/${id}`, {
  //         headers: {
  //           Authorization: `Bearer ${token}`,
  //         },
  //       });
  //       setLocation(response.data.location || null);
  //     } catch (error) {
  //       console.error('Error fetching location:', error);
  //       setLocation(null);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  //   fetchLocation();
  // }, [id, access?.settings, navigate]);

  // const [otp, setOtp] = useState(""); // controlled OTP string

  // interface LocationForm {
  //   type: string;
  //   stationName: string;
  //   legalName: string;
  //   INDNumber: string;
  //   kardpollCode?: string;
  //   csoCode: string;
  //   timezone: string;
  //   email: string;
  // }

  // const [formData, setFormData] = useState<LocationForm>({
  //   type: "",
  //   stationName: "",
  //   legalName: "",
  //   INDNumber: "",
  //   kardpollCode: "",
  //   csoCode: "",
  //   timezone: "",
  //   email: "",
  // });

  // const [timezones, setTimezones] = useState<string[]>([]);
  // // const navigate = useNavigate();

  // useEffect(() => {
  //   try {
  //     const allZones = Intl.supportedValuesOf("timeZone");
  //     const americanZones = allZones.filter((tz) => tz.startsWith("America/"));
  //     setTimezones(americanZones);
  //   } catch {
  //     setTimezones([
  //       "America/New_York",
  //       "America/Chicago",
  //       "America/Denver",
  //       "America/Los_Angeles",
  //       "America/Toronto",
  //       "America/Vancouver",
  //       "America/Phoenix",
  //       "America/Anchorage",
  //       "America/Honolulu",
  //     ]);
  //   }
  // }, []);

  // useEffect(() => {
  //   if (location && timezones.length > 0) {
  //     setFormData({
  //       type: location.type || "",
  //       stationName: location.stationName || "",
  //       legalName: location.legalName || "",
  //       INDNumber: location.INDNumber || "",
  //       kardpollCode: location.kardpollCode || "",
  //       csoCode: location.csoCode || "",
  //       email: location.email || "",
  //       timezone: location.timezone || timezones[0], // default if missing
  //     });
  //     setOtp(location.managerCode?.toString() || "");
  //   }
  // }, [location, timezones]);


  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   try {
  //     await axios.put(`/api/locations/${id}`, {
  //       ...formData,
  //       managerCode: otp, // send OTP as managerCode
  //     }, {
  //       headers: {
  //         Authorization: `Bearer ${localStorage.getItem('token')}`,
  //       },
  //     });

  //     alert(`Location: ${formData.stationName} has been updated successfully!`);
  //     // No navigation — stay on the same page
  //   } catch (error) {
  //     console.error(error);
  //     alert("Failed to update location. Please try again.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };


//   if (!location) {
//     return <div className="p-4 text-red-500">Location not found</div>;
//   }

//   return (
//     <div className="max-w-2xl mx-auto p-6">
//       <Card>
//         <CardHeader>
//           <CardTitle>Edit Location</CardTitle>
//         </CardHeader>
        // <CardContent>
        //   <form onSubmit={handleSubmit} className="space-y-6">
        //     {/* TYPE DROPDOWN */}
        //     <div>
        //       <Label className="block font-medium mb-1">Type</Label>
        //       <Select
        //         value={formData.type}
        //         onValueChange={(value) => setFormData({ ...formData, type: value })}
        //       >
        //         <SelectTrigger className="w-full rounded-md border border-gray-300">
        //           <SelectValue placeholder="Select Type" />
        //         </SelectTrigger>
        //         <SelectContent>
        //           <SelectItem value="store">Store</SelectItem>
        //           <SelectItem value="backoffice">Backoffice</SelectItem>
        //         </SelectContent>
        //       </Select>
        //     </div>

        //     {/* TEXT INPUT FIELDS */}
        //     {[
        //       { label: "Station Name", name: "stationName" },
        //       { label: "Legal Name", name: "legalName" },
        //       { label: "IND Number", name: "INDNumber" },
        //       { label: "Kardpoll Code", name: "kardpollCode" },
        //       { label: "CSO Code", name: "csoCode" },
        //       { label: "Email", name: "email" },
        //     ].map((field) => (
        //       <div key={field.name}>
        //         <Label className="block font-medium mb-1">{field.label}</Label>
        //         <input
        //           type="text"
        //           name={field.name}
        //           value={formData[field.name as keyof LocationForm] || ""}
        //           onChange={(e) =>
        //             setFormData({
        //               ...formData,
        //               [field.name as keyof LocationForm]: e.target.value,
        //             })
        //           }
        //           className="border border-gray-300 rounded-md px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
        //           required={["stationName", "legalName", "INDNumber", "csoCode", "email"].includes(field.name)}
        //         />
        //       </div>
        //     ))}

        //     {/* TIMEZONE DROPDOWN */}
        //     <div>
        //       <Label className="block font-medium mb-1">Timezone</Label>
        //       <Select
        //         value={formData.timezone}
        //         onValueChange={(value) => setFormData({ ...formData, timezone: value })}
        //       >
        //         <SelectTrigger className="w-full rounded-md border border-gray-300">
        //           <SelectValue placeholder="Select Timezone" />
        //         </SelectTrigger>
        //         <SelectContent className="max-h-64 overflow-y-auto">
        //           {timezones.map((tz) => (
        //             <SelectItem key={tz} value={tz}>
        //               {tz}
        //             </SelectItem>
        //           ))}
        //         </SelectContent>
        //       </Select>
        //     </div>
        //     <div>
        //       <Label className="block font-medium mb-1">Manager Code</Label>
        //       <div className="flex justify-center">
        //         <InputOTP maxLength={4} value={otp} onChange={setOtp}>
        //           <InputOTPGroup>
        //             <InputOTPSlot index={0} />
        //             <InputOTPSlot index={1} />
        //             <InputOTPSlot index={2} />
        //             <InputOTPSlot index={3} />
        //           </InputOTPGroup>
        //         </InputOTP>
        //       </div>
        //     </div>
        //     <Button type="submit" disabled={loading} className="w-full">
        //       {loading ? "Saving..." : "Save Changes"}
        //     </Button>
        //   </form>
        // </CardContent>
//       </Card>
//     </div>
//   );
// }
// import { createFileRoute, useNavigate } from '@tanstack/react-router';
// import axios from "axios";
// import { useEffect, useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Label } from "@/components/ui/label";
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
  // const { id } = Route.useParams();
  // const navigate = useNavigate();
  // const { user } = useAuth();
  // const access = user?.access || {};

  // const [location, setLocation] = useState<any>(null);
  // const [loading, setLoading] = useState(true);

  const [showDialog, setShowDialog] = useState(false); // 🧩 NEW
  const [initialBalance, setInitialBalance] = useState(""); // 🧩 NEW
  const [hasSafesheet, setHasSafesheet] = useState(false); // 🧩 NEW
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user  } = useAuth();
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
  } | null>(null);

  const [loading, setLoading] = useState(true);

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
          headers: { Authorization: `Bearer ${token}`, "X-Required-Permission":"settings" },
        }
      );

      alert(`Safesheet created successfully for ${location?.stationName}`);
      setHasSafesheet(true);
      setShowDialog(false);
    } catch (err: any) {
      if (err.status == 403){
        navigate({to:"/no-access"})
        return;
      }
      console.error(err);
      alert(err.response?.data?.error || "Failed to create safesheet.");
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
    </div>
  );
}