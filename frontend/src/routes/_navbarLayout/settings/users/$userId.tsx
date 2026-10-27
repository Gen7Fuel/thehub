import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPHiddenSlot,
} from "@/components/custom/input-otp-masked";
import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { isApiError } from '@/api/core/errors';
import { usersApi } from '@/api/users/users.service';
import { userQueries } from '@/api/users/users.queries';

export const Route = createFileRoute("/_navbarLayout/settings/users/$userId")({
  component: RouteComponent,
  loader: async ({ params, context }) => {
    try {
      const user = await context.queryClient.ensureQueryData(userQueries.detail(params.userId));
      return { user, noAccess: false };
    } catch (error: unknown) {
      console.error("Error fetching user:", error);

      // Check for 403 and set noAccess flag
      const noAccess = isApiError(error) && error.status === 403;
      return { user: null, noAccess };
    }
  },
});

export interface PermissionNode {
  name: string;
  permId: number;
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
      email: string;
      access: Record<string, any>;
      is_admin: boolean;
      is_inOffice: boolean;
      is_logged_in: boolean;
      last_login: Date;
      role?: { _id: string; role_name: string; inStoreAccount?: boolean };
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
  const [_, setResetStatus] = useState<null | string>(null);

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
        const sites = await usersApi.listSites(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
        setLocations(sites);
      } catch (err) {
        console.error("Error loading locations:", err);
      }
    };
    fetchLocations();
  }, [user?._id, user?.site_access]);

  const [isTargetStoreAccount, setIsTargetStoreAccount] = useState<boolean | null>(null);

  useEffect(() => setIsTargetStoreAccount(user?.role?.inStoreAccount ?? false), [user?.role]);

  const toggleSiteAccess = (site: string) => {
    setSiteAccess((prev) => ({
      ...prev,
      [site]: !prev[site],
    }));
  };

  const handleSaveSiteAccess = async () => {
    try {
      setSavingAccess(true);
      await usersApi.updateSiteAccess(params.userId, `${user?.firstName} ${user?.lastName}`, siteAccess);
      alert("Site access updated!");
    } catch (err: any) {
      if (isApiError(err) && err.status === 403) {
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
        const availableRoles = await usersApi.listRoles(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
        setRoles(availableRoles);
      } catch (error: any) {
        if (isApiError(error) && error.status === 403) {
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
      await usersApi.resetPassword(params.userId, `${user?.firstName} ${user?.lastName}`, newPassword);
      setResetStatus("Password reset successfully!");
      setNewPassword("");
      alert("User Password Reset Succesfull!");
      navigate({ to: `/settings/users/${user?._id}` });
    } catch (error: any) {
      if (isApiError(error) && error.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      }
      setResetStatus("Failed to reset password.");
    }
  };

  const verifyPassword = async () => {
    try {
      await usersApi.verifyAdministrator(password, `Administrator verification requested before managing ${user?.firstName} ${user?.lastName}`);

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
      await usersApi.updateRole(params.userId, `${user?.firstName} ${user?.lastName}`, selectedRole);
      alert("User role updated!");
      setShowConfirmDialog(false);
      window.location.reload();
    } catch (err: any) {
      if (isApiError(err) && err.status === 403) {
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
      if (!user?.role?._id) throw new Error('User must have a role before permissions can be updated');
      await usersApi.updatePermissions(params.userId, `${user.firstName} ${user.lastName}`, mergedPermissions, user.role._id);
      alert("Permissions updated!");
    } catch (err: any) {
      if (isApiError(err) && err.status === 403) {
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
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
            {/* <form onSubmit={handlePasswordReset} className="flex items-center gap-3 flex-wrap mb-6">
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
            </form> */}
            {/* Password/Passcode Reset Form */}
            <form onSubmit={handlePasswordReset} className="flex items-center gap-3 flex-wrap mb-6">
              <div className="flex-1 min-w-[200px] space-y-1.5">
              {isTargetStoreAccount ? (
                <InputOTP
                  maxLength={6}
                  value={newPassword}
                  onChange={setNewPassword}
                  inputMode="numeric"
                >
                  <InputOTPGroup className="bg-white">
                    {[...Array(6)].map((_, i) => (
                      <InputOTPHiddenSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              ) : (
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-white"
                />
              )}
              </div>

              <Button
                type="submit"
                className="bg-orange-600 text-white hover:bg-orange-700 h-10 shadow-sm"
              >
                Reset Password
              </Button>
            </form>

            {/* {resetStatus && <p className="mt-3 text-sm text-gray-700">{resetStatus}</p>} */}

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
                disabled={!user.is_logged_in}
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
                  await usersApi.logout(user._id, `${user.firstName} ${user.lastName}`);
                  setShowLogoutConfirmDialog(false)
                  alert("User logged out successfully!");
                  navigate({ to: `/settings/users/${user._id}` });
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
