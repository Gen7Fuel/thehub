import { useEffect, useState } from "react";
import axios from "axios";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export const Route = createFileRoute("/_navbarLayout/settings/users/$userId")({
  component: RouteComponent,
  loader: async ({ params }) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/users/${params.userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Required-Permission": "settings"
        },
      });

      return { user: response.data, noAccess: false };
    } catch (error: any) {
      console.error("Error fetching user:", error);

      // Check for 403 and set noAccess flag
      const noAccess = axios.isAxiosError(error) && error.response?.status === 403;
      return { user: null, noAccess };
    }
  },
});

export interface PermissionNode {
  name: string;
  value?: boolean;
  children?: PermissionNode[];
}

export interface Role {
  _id: string;
  role_name: string;
  description?: string;
  permissions: PermissionNode[];
}

export function RouteComponent() {
  const params = Route.useParams() as { userId: string };
  const navigate = useNavigate();
  const { user, noAccess } = Route.useLoaderData() as {
    user: {
      _id: string;
      firstName: string;
      lastName: string;
      access: Record<string, any>;
      is_admin: boolean;
      is_inOffice: boolean;
      is_logged_in: boolean;
      last_login: Date;
      role?: { _id: string; role_name: string };
      merged_permissions?: PermissionNode[];
      site_access: Record<string, boolean>;
    } | null;
    noAccess: boolean;
  };

  // Redirect if loader flagged no access
  useEffect(() => {
    if (noAccess) navigate({ to: '/no-access' });
  }, [noAccess, navigate]);

  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState(user?.role?._id || "");
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<null | string>(null);

  const [mergedPermissions, setMergedPermissions] = useState<PermissionNode[]>([]);

  const [siteAccess, setSiteAccess] = useState<Record<string, boolean>>({});
  const [locations, setLocations] = useState<{ stationName: string }[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [showLogoutConfirmDialog, setShowLogoutConfirmDialog] = useState(false);
  const [verifyAction, setVerifyAction] = useState<
    null | "logout" | "changeRole"
  >(null);


  useEffect(() => {
    if (user?.site_access) setSiteAccess(user.site_access);

    const fetchLocations = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/locations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLocations(res.data);
      } catch (err) {
        console.error("Error loading locations:", err);
      }
    };
    fetchLocations();
  }, [user?._id, user?.site_access]);

  const toggleSiteAccess = (site: string) => {
    setSiteAccess((prev) => ({
      ...prev,
      [site]: !prev[site],
    }));
  };

  const handleSaveSiteAccess = async () => {
    try {
      setSavingAccess(true);
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/users/${params.userId}/site-access`,
        { siteAccess },
        { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" } }
      );
      alert("Site access updated!");
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error("Error saving site access:", err);
        alert("Failed to update site access.");
      }
    } finally {
      setSavingAccess(false);
    }
  };

  useEffect(() => {
    setMergedPermissions(user?.merged_permissions || []);
  }, [user?._id, user?.merged_permissions]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/roles", {
          headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" },
        });
        setRoles(res.data);
      } catch (error: any) {
        if (error.response?.status === 403) {
          // Redirect to no-access page
          navigate({ to: "/no-access" });
        } else {
          console.error("Failed to load roles:", error);
        }
      }
    };
    fetchRoles();
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/auth/reset-password",
        { userId: params.userId, newPassword },
        { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" } }
      );
      setResetStatus("Password reset successfully!");
      setNewPassword("");
    } catch (error: any) {
      if (error.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      }
      setResetStatus("Failed to reset password.");
    }
  };

  // const verifyPassword = async () => {
  //   try {
  //     const token = localStorage.getItem("token");
  //     await axios.post(
  //       "/api/auth/verify-password",
  //       { password },
  //       { headers: { Authorization: `Bearer ${token}` } }
  //     );
  //     setShowPasswordDialog(false);
  //     setShowConfirmDialog(true);
  //   } catch {
  //     alert("Invalid password!");
  //   }
  // };
  const verifyPassword = async () => {
    try {
      const token = localStorage.getItem("token");

      await axios.post(
        "/api/auth/verify-password",
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowPasswordDialog(false);

      // Use the verifyAction state instead of window.__VERIFY_CONTEXT__
      if (verifyAction === "logout") {
        setShowLogoutConfirmDialog(true);
      } else if (verifyAction === "changeRole") {
        setShowConfirmDialog(true);
      }
      // Clear the action so it doesn’t linger
      setVerifyAction(null);


    } catch {
      alert("Invalid password!");
    }
  };


  const handleRoleChange = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/users/${params.userId}/role`,
        { roleId: selectedRole },
        { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" } }
      );
      alert("User role updated!");
      setShowConfirmDialog(false);
      window.location.reload();
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(err);
        alert("Failed to update role");
      }
    }
  };

  const handleSavePermissions = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/users/${params.userId}/permissions`,
        { mergedPermissions, roleId: user?.role?._id },
        { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" } }
      );
      alert("Permissions updated!");
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(err);
        alert("Failed to save permissions");
      }
    }
  };

  if (!user) return <div>User not found</div>;

  return (
    <div className="flex justify-center w-full">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-lg border border-gray-200 p-8 space-y-8">
        {/* PASSWORD RESET */}
        {/* <Card className="rounded-2xl shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>Reset User Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="flex items-center gap-3 flex-wrap">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="flex-1 min-w-[200px]"
              />
              <Button type="submit" className="bg-red-600 text-white hover:bg-red-500">
                Reset Password
              </Button>
            </form>
            {resetStatus && <p className="mt-3 text-sm text-gray-700">{resetStatus}</p>}
          </CardContent>
        </Card> */}
        {/* USER PRIVACY CARD */}
        <Card className="rounded-2xl shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>User Privacy</CardTitle>
          </CardHeader>

          <CardContent>
            {/* Password Reset */}
            <form onSubmit={handlePasswordReset} className="flex items-center gap-3 flex-wrap mb-6">
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="flex-1 min-w-[200px]"
              />
              <Button type="submit" className="bg-orange-600 text-white hover:bg-red-500">
                Reset Password
              </Button>
            </form>

            {resetStatus && <p className="mt-3 text-sm text-gray-700">{resetStatus}</p>}

            {/* Status + Logout Row */}
            <div className="flex items-start justify-between">
              {/* LEFT SIDE — Status + Last Login */}
              <div className="flex flex-col gap-1">

                {/* Current Status (label + badge) */}
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700 w-28">
                    Current Status:
                  </span>

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${user.is_logged_in
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-700"
                      }`}
                  >
                    {user.is_logged_in ? "Logged In" : "Logged Out"}
                  </span>
                </div>

                {/* Last Login (aligned with label, not badge) */}
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700 w-18">
                    Last Login:
                  </span>

                  <span className="text-sm text-gray-600">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : "N/A"}
                  </span>
                </div>
              </div>

              {/* RIGHT SIDE — Logout Button */}
              <Button
                className="bg-red-600 text-white hover:bg-red-500 h-9"
                onClick={() => {
                  // reuse existing password dialog
                  setPassword("");
                  // attach context: this verification is for logout
                  setVerifyAction("logout");
                  setShowPasswordDialog(true);
                }}
              >
                Logout User
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ROLE CHANGE */}
        <Card className="rounded-2xl shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>User Role</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-gray-700">
              Current Role:{" "}
              <span className="font-semibold">{user.role?.role_name || "None"}</span>
            </p>
            <Button onClick={() => setShowRoleDialog(true)}>Change Role</Button>
          </CardContent>
        </Card>

        {/* SITE ACCESS */}
        <Card className="rounded-2xl shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>Site Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {locations.map((loc) => (
                <button
                  key={loc.stationName}
                  onClick={() => toggleSiteAccess(loc.stationName)}
                  className={`p-2 rounded-md border transition ${siteAccess[loc.stationName]
                    ? "bg-green-100 border-green-500 text-green-700 font-semibold"
                    : "bg-gray-100 border-gray-400 text-gray-600"
                    }`}
                >
                  {loc.stationName}
                </button>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-500"
              onClick={handleSaveSiteAccess}
              disabled={savingAccess}
            >
              {savingAccess ? "Saving..." : "Save Site Access"}
            </Button>
          </CardFooter>
        </Card>

        {/* PERMISSIONS */}
        <Card className="rounded-2xl shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <RolePermissionEditor
              role={{ _id: user._id, role_name: user.role?.role_name || "", permissions: mergedPermissions }}
              onChange={setMergedPermissions}
              onSave={handleSavePermissions}
              fromUserPage={true}
            />
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select New Role</DialogTitle>
          </DialogHeader>
          <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
            {roles.map((r) => (
              <div key={r._id} className="flex items-center space-x-2">
                <RadioGroupItem value={r._id || ""} id={r._id || ""} />
                <label htmlFor={r._id}>{r.role_name}</label>
              </div>
            ))}
          </RadioGroup>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowRoleDialog(false);
                setVerifyAction("changeRole");
                setShowPasswordDialog(true);
              }}
            >
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Password</DialogTitle>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={verifyPassword}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to change this user's role?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRoleChange}>Yes, Change Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogoutConfirmDialog} onOpenChange={setShowLogoutConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
          </DialogHeader>

          <p>Are you sure you want to log this user out?</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutConfirmDialog(false)}>
              Cancel
            </Button>

            <Button
              className="bg-red-600 text-white"
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");
                  await axios.post(
                    `/api/users/${user._id}/logout`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                  );

                  alert("User logged out successfully!");
                  window.location.reload();

                } catch (err) {
                  console.error(err);
                  alert("Failed to logout user.");
                }
              }}
            >
              Yes, Logout User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// import { useEffect, useState } from "react";
// import axios from "axios";
// import { createFileRoute } from "@tanstack/react-router";
// import { Button } from "@/components/ui/button";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { Input } from "@/components/ui/input";
// import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor"; // ✅ import editor

// export const Route = createFileRoute("/_navbarLayout/settings/users/$userId")({
//   component: RouteComponent,
//   loader: async ({ params }) => {
//     try {
//       const token = localStorage.getItem("token");
//       const response = await axios.get(`/api/users/${params.userId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       return { user: response.data };
//     } catch (error) {
//       console.error("Error fetching user:", error);
//       return { user: null };
//     }
//   },
// });

// // --- Interfaces ---
// export interface PermissionNode {
//   name: string;
//   value?: boolean;
//   children?: PermissionNode[];
// }

// export interface Role {
//   _id: string;
//   role_name: string;
//   description?: string;
//   permissions: PermissionNode[];
// }

// export function RouteComponent() {
//   const params = Route.useParams() as { userId: string };
//   const { user } = Route.useLoaderData() as {
//     user: {
//       _id: string;
//       firstName: string;
//       lastName: string;
//       access: Record<string, any>;
//       is_admin: boolean;
//       is_inOffice: boolean;
//       role?: { _id: string; role_name: string };
//       merged_permissions?: PermissionNode[];
//       site_access: {},
//     } | null;
//   };

//   const [roles, setRoles] = useState<Role[]>([]);
//   const [selectedRole, setSelectedRole] = useState(user?.role?._id || "");
//   const [showRoleDialog, setShowRoleDialog] = useState(false);
//   const [showPasswordDialog, setShowPasswordDialog] = useState(false);
//   const [showConfirmDialog, setShowConfirmDialog] = useState(false);
//   const [password, setPassword] = useState("");
//   const [newPassword, setNewPassword] = useState("");
//   const [resetStatus, setResetStatus] = useState<null | string>(null);

//   const [mergedPermissions, setMergedPermissions] = useState<PermissionNode[]>([]);

//   // Inside RouteComponent (after the Permissions section)
//   const [siteAccess, setSiteAccess] = useState<Record<string, boolean>>({});
//   const [locations, setLocations] = useState<{ stationName: string }[]>([]);
//   const [savingAccess, setSavingAccess] = useState(false);

//   // Fetch site access + locations
//   useEffect(() => {
//     if (user?.site_access) setSiteAccess(user.site_access);

//     const fetchLocations = async () => {
//       try {
//         const token = localStorage.getItem("token");
//         const res = await axios.get("/api/locations", {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         setLocations(res.data);
//       } catch (err) {
//         console.error("Error loading locations:", err);
//       }
//     };
//     fetchLocations();
//   }, [user?._id, user?.site_access]);

//   // Handle toggle
//   const toggleSiteAccess = (site: string) => {
//     setSiteAccess((prev) => ({
//       ...prev,
//       [site]: !prev[site],
//     }));
//   };

//   // Save site access
//   const handleSaveSiteAccess = async () => {
//     try {
//       setSavingAccess(true);
//       const token = localStorage.getItem("token");
//       await axios.put(
//         `/api/users/${params.userId}/site-access`,
//         { siteAccess },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       alert("Site access updated!");
//     } catch (err) {
//       console.error("Error saving site access:", err);
//       alert("Failed to update site access.");
//     } finally {
//       setSavingAccess(false);
//     }
//   };

//   // Load user's permissions
//   useEffect(() => {
//     setMergedPermissions(user?.merged_permissions || []);
//   }, [user?._id, user?.merged_permissions]);

//   // Fetch roles
//   useEffect(() => {
//     const fetchRoles = async () => {
//       try {
//         const token = localStorage.getItem("token");
//         const res = await axios.get("/api/roles", {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         setRoles(res.data);
//       } catch (error) {
//         console.error("Failed to load roles:", error);
//       }
//     };
//     fetchRoles();
//   }, []);

//   // --- PASSWORD RESET ---
//   const handlePasswordReset = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setResetStatus(null);
//     try {
//       const token = localStorage.getItem("token");
//       await axios.post(
//         "/api/auth/reset-password",
//         { userId: params.userId, newPassword },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setResetStatus("Password reset successfully!");
//       setNewPassword("");
//     } catch {
//       setResetStatus("Failed to reset password.");
//     }
//   };

//   // --- ROLE CHANGE ---
//   const verifyPassword = async () => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.post(
//         "/api/auth/verify-password",
//         { password },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setShowPasswordDialog(false);
//       setShowConfirmDialog(true);
//     } catch {
//       alert("Invalid password!");
//     }
//   };

//   const handleRoleChange = async () => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.put(
//         `/api/users/${params.userId}/role`,
//         { roleId: selectedRole },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       alert("User role updated!");
//       setShowConfirmDialog(false);
//       window.location.reload();
//     } catch (err) {
//       console.error(err);
//       alert("Failed to update role");
//     }
//   };

//   // --- SAVE PERMISSIONS ---
//   const handleSavePermissions = async () => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.put(
//         `/api/users/${params.userId}/permissions`,
//         { mergedPermissions, roleId: user?.role?._id },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       alert("Custom permissions updated!");
//     } catch (err) {
//       console.error(err);
//       alert("Failed to save permissions");
//     }
//   };

//   if (!user) return <div>User not found</div>;

//   return (
//     <div className="p-6 space-y-8">
//       {/* PASSWORD RESET */}
//       <div>
//         <h2 className="text-lg font-bold mb-2">Reset User Password</h2>
//         <form onSubmit={handlePasswordReset} className="flex items-center gap-2">
//           <Input
//             type="password"
//             placeholder="New password"
//             value={newPassword}
//             onChange={(e) => setNewPassword(e.target.value)}
//             required
//           />
//           <Button type="submit" className="bg-red-600 text-white hover:bg-red-500">
//             Reset Password
//           </Button>
//         </form>
//         {resetStatus && <p className="mt-2 text-sm text-gray-700">{resetStatus}</p>}
//       </div>

//       {/* ROLE CHANGE */}
//       <div>
//         <h2 className="text-lg font-bold mb-4">User Role</h2>
//         <div className="flex items-center justify-between">
//           <p className="text-gray-700">
//             Current Role: <span className="font-semibold">{user.role?.role_name || "None"}</span>
//           </p>
//           <Button onClick={() => setShowRoleDialog(true)}>Change Role</Button>
//         </div>
//       </div>
//       {/* SITE ACCESS */}
//       <div>
//         <h2 className="text-lg font-bold mb-4">Site Access</h2>
//         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
//           {locations.map((loc) => (
//             <button
//               key={loc.stationName}
//               onClick={() => toggleSiteAccess(loc.stationName)}
//               className={`p-2 rounded-md border transition ${
//                 siteAccess[loc.stationName]
//                   ? "bg-green-100 border-green-500 text-green-700 font-semibold"
//                   : "bg-gray-100 border-gray-400 text-gray-600"
//               }`}
//             >
//               {loc.stationName}
//             </button>
//           ))}
//         </div>

//         <div className="mt-4">
//           <Button
//             className="bg-blue-600 text-white hover:bg-blue-500"
//             onClick={handleSaveSiteAccess}
//             disabled={savingAccess}
//           >
//             {savingAccess ? "Saving..." : "Save Site Access"}
//           </Button>
//         </div>
//       </div>

//       {/* MERGED PERMISSIONS EDITOR */}
//       <div>
//         <h2 className="text-lg font-bold mb-4">Permissions</h2>
//         <RolePermissionEditor
//           role={{ _id: user._id, role_name: user.role?.role_name || "", permissions: mergedPermissions }}
//           onChange={setMergedPermissions}
//           onSave={handleSavePermissions}
//           fromUserPage={true}
//         />
//       </div>

//       {/* SAVE PERMISSIONS
//       <Button
//         className="bg-blue-600 text-white hover:bg-blue-500"
//         onClick={handleSavePermissions}
//       >
//         Save Permissions
//       </Button> */}

//       {/* Dialogs */}
//       <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Select New Role</DialogTitle>
//           </DialogHeader>
//           <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
//             {roles.map((r) => (
//               <div key={r._id} className="flex items-center space-x-2">
//                 <RadioGroupItem value={r._id || ""} id={r._id || ""} />
//                 <label htmlFor={r._id}>{r.role_name}</label>
//               </div>
//             ))}
//           </RadioGroup>
//           <DialogFooter>
//             <Button
//               onClick={() => {
//                 setShowRoleDialog(false);
//                 setShowPasswordDialog(true);
//               }}
//             >
//               Next
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Verify Password</DialogTitle>
//           </DialogHeader>
//           <Input
//             type="password"
//             placeholder="Enter your password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//           />
//           <DialogFooter>
//             <Button onClick={verifyPassword}>Verify</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Confirm Role Change</DialogTitle>
//           </DialogHeader>
//           <p>Are you sure you want to change this user's role?</p>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
//               Cancel
//             </Button>
//             <Button onClick={handleRoleChange}>Yes, Change Role</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }



// import { useEffect, useState } from "react";
// import axios from "axios";
// import { createFileRoute } from "@tanstack/react-router";
// import { Button } from "@/components/ui/button";
// import { Switch } from "@/components/ui/switch";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
// import { Input } from "@/components/ui/input";

// export const Route = createFileRoute("/_navbarLayout/settings/users/$userId")({
//   component: RouteComponent,
//   loader: async ({ params }) => {
//     try {
//       const token = localStorage.getItem("token");
//       const response = await axios.get(`/api/users/${params.userId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       return { user: response.data };
//     } catch (error) {
//       console.error("Error fetching user:", error);
//       return { user: null };
//     }
//   },
// });

// // Interfaces
// export interface PermissionNode {
//   name: string;
//   value?: boolean;
//   children?: PermissionNode[];
// }

// export interface Role {
//   _id: string;
//   role_name: string;
//   description?: string;
//   permissions: PermissionNode[];
// }

// function RouteComponent() {
//   const params = Route.useParams() as { userId: string };
//   const { user } = Route.useLoaderData() as {
//     user: {
//       _id: string;
//       firstName: string;
//       lastName: string;
//       access: Record<string, any>;
//       is_admin: boolean;
//       is_inOffice: boolean;
//       role?: { _id: string; role_name: string };
//       merged_permissions?: PermissionNode[];
//     } | null;
//   };

//   const [roles, setRoles] = useState<Role[]>([]);
//   const [selectedRole, setSelectedRole] = useState(user?.role?._id || "");
//   const [showRoleDialog, setShowRoleDialog] = useState(false);
//   const [showPasswordDialog, setShowPasswordDialog] = useState(false);
//   const [showConfirmDialog, setShowConfirmDialog] = useState(false);
//   const [password, setPassword] = useState("");

//   const [newPassword, setNewPassword] = useState("");
//   const [resetStatus, setResetStatus] = useState<null | string>(null);

//   // Use merged_permissions for frontend display
//   const [mergedPermissions, setMergedPermissions] = useState<PermissionNode[]>([]);

//   useEffect(() => {
//     setMergedPermissions(user?.merged_permissions || []);
//   }, [user?._id]);


//   // Fetch roles
//   useEffect(() => {
//     const fetchRoles = async () => {
//       try {
//         const token = localStorage.getItem("token");
//         const res = await axios.get("/api/roles", {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         setRoles(res.data);
//       } catch (error) {
//         console.error("Failed to load roles:", error);
//       }
//     };
//     fetchRoles();
//   }, []);

//   // --- PASSWORD RESET ---
//   const handlePasswordReset = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setResetStatus(null);
//     try {
//       const token = localStorage.getItem("token");
//       await axios.post(
//         "/api/auth/reset-password",
//         { userId: params.userId, newPassword },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setResetStatus("Password reset successfully!");
//       setNewPassword("");
//     } catch {
//       setResetStatus("Failed to reset password.");
//     }
//   };

//   // --- ROLE CHANGE HANDLERS ---
//   const verifyPassword = async () => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.post(
//         "/api/auth/verify-password",
//         { password },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       setShowPasswordDialog(false);
//       setShowConfirmDialog(true);
//     } catch {
//       alert("Invalid password!");
//     }
//   };

//   const handleRoleChange = async () => {
//     try {
//       const token = localStorage.getItem("token");
//       await axios.put(
//         `/api/users/${params.userId}/role`,
//         { roleId: selectedRole },
//         { headers: { Authorization: `Bearer ${token}` } }
//       );
//       alert("User role updated!");
//       setShowConfirmDialog(false);
//       window.location.reload();
//     } catch (err) {
//       console.error(err);
//       alert("Failed to update role");
//     }
//   };

//   // --- PERMISSIONS TOGGLES ---
//   const togglePermission = (path: string[]) => {
//     const toggleNode = (nodes: PermissionNode[], path: string[]): PermissionNode[] =>
//       nodes.map((n) => {
//         if (n.name === path[0]) {
//           if (path.length === 1) {
//             return { ...n, value: !n.value };
//           } else if (n.children) {
//             return { ...n, children: toggleNode(n.children, path.slice(1)) };
//           }
//         }
//         return n;
//       });
//     setMergedPermissions((prev) => toggleNode(prev, path));
//   };

//   const capitalize = (str: string) =>
//     str
//       .replace(/-/g, " ")
//       .split(" ")
//       .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
//       .join(" ");

//   const renderPermissionTree = (nodes: PermissionNode[], path: string[] = []) => {
//     return nodes.map((node) => (
//       <div key={[...path, node.name].join(".")} className="ml-4 my-1">
//         <div className="flex items-center space-x-2">
//           <Switch
//             checked={Boolean(node.value)}
//             onCheckedChange={() => togglePermission([...path, node.name])}
//             id={[...path, node.name].join(".")}
//           />
//           <label htmlFor={[...path, node.name].join(".")} className="text-sm text-gray-700">
//             {capitalize(node.name)}
//           </label>
//         </div>
//         {node.children && renderPermissionTree(node.children, [...path, node.name])}
//       </div>
//     ));
//   };

//   const handleSavePermissions = async () => {
//   try {
//     const token = localStorage.getItem("token");

//     // Send mergedPermissions to backend for comparison
//     await axios.put(`/api/users/${params.userId}/permissions`,
//       { mergedPermissions, roleId: user?.role?._id },
//       { headers: { Authorization: `Bearer ${token}` } }
//     );

//     alert("Custom permissions updated!");
//   } catch (err) {
//     console.error(err);
//     alert("Failed to save permissions");
//   }
// };


//   if (!user) return <div>User not found</div>;

//   return (
//     <div className="p-6 space-y-8">
//       {/* PASSWORD RESET */}
//       <div>
//         <h2 className="text-lg font-bold mb-2">Reset User Password</h2>
//         <form onSubmit={handlePasswordReset} className="flex items-center gap-2">
//           <Input
//             type="password"
//             placeholder="New password"
//             value={newPassword}
//             onChange={(e) => setNewPassword(e.target.value)}
//             required
//           />
//           <Button type="submit" className="bg-red-600 text-white hover:bg-red-500">
//             Reset Password
//           </Button>
//         </form>
//         {resetStatus && <p className="mt-2 text-sm text-gray-700">{resetStatus}</p>}
//       </div>

//       {/* ROLE CHANGE */}
//       <div>
//         <h2 className="text-lg font-bold mb-4">User Role</h2>
//         <div className="flex items-center justify-between">
//           <p className="text-gray-700">
//             Current Role: <span className="font-semibold">{user.role?.role_name || "None"}</span>
//           </p>
//           <Button onClick={() => setShowRoleDialog(true)}>Change Role</Button>
//         </div>
//       </div>

//       {/* MERGED PERMISSIONS */}
//       <div>
//         <h2 className="text-lg font-bold mb-4">Permissions</h2>
//         {mergedPermissions.length > 0 ? (
//           renderPermissionTree(mergedPermissions)
//         ) : (
//           <p className="text-gray-500">No permissions assigned.</p>
//         )}
//       </div>

//       {/* Save Permission */}
//       <Button
//         className="bg-blue-600 text-white hover:bg-blue-500"
//         onClick={handleSavePermissions}
//       >
//         Save Permissions
//       </Button>


//       {/* Role Dialog */}
//       <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Select New Role</DialogTitle>
//           </DialogHeader>
//           <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
//             {roles.map((r) => (
//               <div key={r._id} className="flex items-center space-x-2">
//                 <RadioGroupItem value={r._id || ""} id={r._id || ""} />
//                 <label htmlFor={r._id}>{r.role_name}</label>
//               </div>
//             ))}
//           </RadioGroup>
//           <DialogFooter>
//             <Button
//               onClick={() => {
//                 setShowRoleDialog(false);
//                 setShowPasswordDialog(true);
//               }}
//             >
//               Next
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* Verify Password */}
//       <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Verify Password</DialogTitle>
//           </DialogHeader>
//           <Input
//             type="password"
//             placeholder="Enter your password"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//           />
//           <DialogFooter>
//             <Button onClick={verifyPassword}>Verify</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       {/* Confirm Role Change */}
//       <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Confirm Role Change</DialogTitle>
//           </DialogHeader>
//           <p>Are you sure you want to change this user's role?</p>
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
//               Cancel
//             </Button>
//             <Button onClick={handleRoleChange}>Yes, Change Role</Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }

// import axios from "axios";
// import { createFileRoute } from '@tanstack/react-router';
// import { useState, useEffect } from 'react';
// import { Switch } from '@/components/ui/switch'; // Import the Switch component from ShadCN UI

// export const Route = createFileRoute('/_navbarLayout/settings/users/$userId')({
//   component: RouteComponent,
//   loader: async ({ params }) => {
//     const { userId } = params;
//     try {
//       // add authorization header with bearer token
//       const response = await axios.get(`/api/users/${userId}`, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token')}`
//         }
//       }); // Fetch user info by userId
//       return { user: response.data };
//     } catch (error) {
//       console.error('Error fetching user:', error);
//       return { user: null };
//     }
//   },
// });

// function RouteComponent() {
//   const [newPassword, setNewPassword] = useState("");
//   const [resetStatus, setResetStatus] = useState<null | string>(null);

//   const handlePasswordReset = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setResetStatus(null);
//     try {
//       await axios.post(
//         "/api/auth/reset-password",
//         { userId: params.userId, newPassword },
//         {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem("token")}`,
//           },
//         }
//       );
//       setResetStatus("Password reset successfully!");
//       setNewPassword("");
//     } catch (error) {
//       setResetStatus("Failed to reset password.");
//     }
//   };

//   const params = Route.useParams() as { userId: string };
//   const { user } = Route.useLoaderData() as {
//     user: { firstName: string; lastName: string; access: Record<string, any>; is_admin: boolean; is_inOffice: boolean; } | null;
//   };

//   const [access, setAccess] = useState<Record<string, any>>(user?.access || {});
//   const [isAdmin, setIsAdmin] = useState(user?.is_admin || false);
//   const [isInOffice, setIsInOffice] = useState(user?.is_inOffice || false);
//   if (!user) {
//     return <div>User not found</div>;
//   }

//   const handleCheckboxChange = (key: string) => {
//     setAccess((prevAccess) => ({
//       ...prevAccess,
//       [key]: !prevAccess[key], // Toggle the value of the switch
//     }));
//   };

//   // Example for handling site_access toggles
//   const handleSiteToggle = (site: string) => {
//     setAccess((prev) => ({
//       ...prev,
//       site_access: {
//         ...prev.site_access,
//         [site]: !prev.site_access?.[site],
//       },
//     }));
//   };

//   const handleUpdate = async () => {
//     try {
//       // add authorization header with bearer token
//       await axios.put(`/api/users/${params.userId}`, {
//           access,
//           is_admin: isAdmin,
//           is_inOffice: isInOffice,
//       }, {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token')}`
//         }
//       });
//       alert('Access updated successfully!');
//     } catch (error) {
//       console.error('Error updating access:', error);
//       alert('Failed to update access');
//     }
//   };

//   useEffect(() => {
//     if (user) {
//       setAccess(user.access || {});
//       setIsAdmin(user.is_admin || false);
//       setIsInOffice(user.is_inOffice || false);
//     }
//   }, [user]);

//   return (
//     <div className='pl-4 pt-2'>
//       {/* Password Reset Form */}
//       <div className="mt-8">
//         <h2 className="text-lg font-bold mb-2">Reset User Password</h2>
//         <form onSubmit={handlePasswordReset} className="flex items-center gap-2">
//           <input
//             type="password"
//             className="border rounded px-3 py-2"
//             placeholder="New password"
//             value={newPassword}
//             onChange={e => setNewPassword(e.target.value)}
//             required
//           />
//           <button
//             type="submit"
//             className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
//           >
//             Reset Password
//           </button>
//         </form>
//         {resetStatus && (
//           <div className="mt-2 text-sm text-gray-700">{resetStatus}</div>
//         )}
//       </div>

//       {/* <h2 className="text-lg font-bold mb-4">Access Permissions</h2>
//       <form className="space-y-2">
//         {Object.entries(access).map(([key, value]) => (
//           <div key={key} className="flex items-center space-x-4">
//             <Switch
//               id={key}
//               checked={value}
//               onCheckedChange={() => handleCheckboxChange(key)} // Use onCheckedChange for Switch
//             />
//             <label htmlFor={key} className="text-sm font-medium text-gray-700">
//               {key}
//             </label>
//           </div>
//         ))}
//       </form> */}
//       <h2 className="text-lg font-bold mb-4">Access Permissions</h2>

//       {/* Admin / InOffice Toggles */}
//       <div className="flex items-center gap-4 mb-2">
//         <Switch checked={isAdmin} onCheckedChange={setIsAdmin} id="isAdmin" />
//         <label htmlFor="isAdmin">Admin</label>

//         <Switch checked={isInOffice} onCheckedChange={setIsInOffice} id="isInOffice" />
//         <label htmlFor="isInOffice">In Office</label>
//       </div>

//         {/* Permissions */}
//       <form className="space-y-2">
//         {/* 3️⃣ Site Access toggles */}
//         {access.site_access && typeof access.site_access === "object" && (
//           <div className="mb-2">
//             <div className="flex items-center space-x-4 font-medium text-gray-700">
//               <span>Site Access</span>
//             </div>
//             <div className="ml-6 mt-1 space-y-1">
//               {Object.entries(access.site_access as Record<string, boolean>).map(
//                 ([site, val]) => (
//                   <div key={site} className="flex items-center space-x-2">
//                     <Switch
//                       checked={Boolean(val)}
//                       onCheckedChange={() => handleSiteToggle(site)}
//                       id={site}
//                     />
//                     <label htmlFor={site} className="text-sm text-gray-700">
//                       {site}
//                     </label>
//                   </div>
//                 )
//               )}
//             </div>
//           </div>
//         )}

//         {/* 4️⃣ Other permissions (excluding site_access) */}
//         {Object.entries(access)
//           .filter(([key]) => key !== "site_access")
//           .map(([key, value]) => (
//             <div key={key} className="flex items-center space-x-4">
//               <Switch
//                 checked={Boolean(value)}
//                 onCheckedChange={() => handleCheckboxChange(key)}
//                 id={key}
//               />
//               <label htmlFor={key} className="text-sm text-gray-700">
//                 {key}
//               </label>
//             </div>
//           ))}
//       </form>


//       <button
//         onClick={handleUpdate}
//         className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//       >
//         Update
//       </button>
//     </div>
//   );
// }