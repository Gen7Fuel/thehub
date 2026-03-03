// import { createFileRoute, useNavigate } from "@tanstack/react-router";
// import { useEffect, useState } from "react";
// import axios from "axios";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";

// interface PermissionNode {
//   name: string;
//   children?: PermissionNode[];
// }

// interface PermissionTemplate {
//   _id: string;
//   module_name: string;
//   structure: PermissionNode[];
// }

// interface Role {
//   _id: string;
//   role_name: string;
//   description?: string;
//   permissions: PermissionNode[];
// }

// export const Route = createFileRoute("/_navbarLayout/settings/roles/$id")({
//   component: RouteComponent,
// });

// export function RouteComponent() {
//   const { id } = Route.useParams();

//   const [role, setRole] = useState<Role | null>(null);
//   const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
//   const [loading, setLoading] = useState(true);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const [roleRes, templatesRes] = await Promise.all([
//             axios.get<Role>(`/api/roles/${id}`, {
//               headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
//             }),
//             axios.get<PermissionTemplate[]>(`/api/permissions`, {
//               headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
//             }),
//         ]);
//         setRole(roleRes.data);
//         setTemplates(templatesRes.data);
//         setLoading(false);
//       } catch (err) {
//         console.error(err);
//         setLoading(false);
//       }
//     };
//     fetchData();
//   }, [id]);

//   const handleSave = async (updatedPermissions: PermissionNode[]) => {
//     if (!role) return;
//     try {
//       await axios.put(
//         `/api/roles/${id}`,
//         {
//           ...role,
//           permissions: updatedPermissions,
//         },
//         {
//           headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
//         }
//       );
//       alert("Role updated successfully!");
//     } catch (err) {
//       console.error(err);
//       alert("Failed to update role");
//     }
//   };


//   const handleDelete = async () => {
//     if (!role) return;
//     if (!confirm("Are you sure you want to delete this role?")) return;
//     try {
//       await axios.delete(`/api/roles/${id}`, {
//         headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
//       });
//       alert("Role deleted successfully!");
//       navigate({
//         to: "/settings/roles/",
//       });
//       // optionally redirect to roles list page
//     } catch (err) {
//       console.error(err);
//       alert("Failed to delete role");
//     }
//   };

//   if (loading || !role || templates.length === 0) return <div>Loading...</div>;

//   return (
//     <div className="p-6 space-y-6 max-w-4xl mx-auto">
//       <h1 className="text-2xl font-bold">Edit Role</h1>

//       <div>
//         <label>Role Name</label>
//         <Input
//           value={role.role_name}
//           onChange={(e) => setRole({ ...role, role_name: e.target.value })}
//         />
//       </div>

//       <div>
//         <label>Description</label>
//         <Input
//           value={role.description || ""}
//           onChange={(e) => setRole({ ...role, description: e.target.value })}
//         />
//       </div>

//       <RolePermissionEditor
//         templates={templates}
//         role={role}
//         onSave={handleSave}
//       />

//       <Button
//         className="bg-red-600 text-white hover:bg-red-500"
//         onClick={handleDelete}
//       >
//         Delete Role
//       </Button>
//     </div>
//   );
// }
import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import axios from "axios";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PermissionNode {
  name: string;
  permId: number;
  children?: PermissionNode[];
}

// interface PermissionTemplate {
//   _id: string;
//   module_name: string;
//   structure: PermissionNode[];
// }

interface Role {
  _id: string;
  role_name: string;
  description?: string;
  inStoreAccount: boolean;
  permissions: PermissionNode[];
}

export const Route = createFileRoute("/_navbarLayout/settings/roles/$id")({
  component: RouteComponent,
});

export function RouteComponent() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role | null>(null);
  // const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // For assign users dialog
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, _] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false); // New Dialog State

  // Combined Fetching Logic
  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = {
        Authorization: `Bearer ${token}`,
        "X-Required-Permission": "settings"
      };

      // Fetch Role and Users in parallel
      const [roleRes, usersRes] = await Promise.all([
        axios.get(`/api/roles/${id}`, { headers }),
        axios.get("/api/users/populate-roles", { headers })
      ]);

      const fetchedRole = roleRes.data;
      const allUsers = usersRes.data;

      setRole(fetchedRole);
      setUsers(allUsers);

      // Determine who is currently assigned to this role
      const currentlyAssigned = allUsers
        .filter((u: any) => {
          const userRoleId = typeof u.role === 'object' ? u.role?._id : u.role;
          return userRoleId === id;
        })
        .map((u: any) => u._id);

      setSelectedUsers(currentlyAssigned);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      if (err.response?.status === 403) {
        navigate({ to: "/no-access" });
      }
    } finally {
      // THIS IS THE KEY: Ensure loading ends regardless of success/fail (if role exists)
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [id]);


  // Save role permissions
  const handleSave = async (updatedPermissions: PermissionNode[]) => {
    if (!role) return;
    try {
      await axios.put(
        `/api/roles/${id}`,
        { ...role, permissions: updatedPermissions },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, "X-Required-Permission": "settings", } }
      );
      alert("Role updated successfully!");
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

  // Delete role
  const handleDelete = async () => {
    if (!role) return;
    if (!confirm("Are you sure you want to delete this role?")) return;
    try {
      await axios.delete(`/api/roles/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, "X-Required-Permission": "settings" },
      });
      alert("Role deleted successfully!");
      navigate({ to: "/settings/roles/" });
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(err);
        alert("Failed to delete role");
      }
    }
  };

  const [pendingInStoreAccount, setPendingInStoreAccount] = useState<boolean>(false);
  const [isUpdatingType, setIsUpdatingType] = useState(false);

  // Sync local state when dialog opens
  useEffect(() => {
    if (typeDialogOpen && role) {
      setPendingInStoreAccount(role.inStoreAccount);
    }
  }, [typeDialogOpen, role]);

  const handleUpdateAccountType = async () => {
    if (!role) return;
    setIsUpdatingType(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/roles/${id}`,
        { ...role, inStoreAccount: pendingInStoreAccount },
        { headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" } }
      );

      // Update main role state only after success
      setRole({ ...role, inStoreAccount: pendingInStoreAccount });
      setTypeDialogOpen(false);
      alert("Account type updated successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to update account type");
    } finally {
      setIsUpdatingType(false);
    }
  };

  // const assignedUserCount = useMemo(() => {
  //   return users.filter(u => {
  //     const userRoleId = typeof u.role === 'object' ? u.role?._id : u.role;
  //     return userRoleId === id;
  //   }).length;
  // }, [users, id]);
  const toggleUserSelection = (userId: string, isActive: boolean) => {
    if (!isActive) return; // Prevent checking/unchecking inactive users
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(i => i !== userId) : [...prev, userId]
    );
  };

  // Memoized count for the button
  const assignedUserCount = useMemo(() => {
    return users.filter(u => {
      const userRoleId = typeof u.role === 'object' ? u.role?._id : u.role;
      return userRoleId === id;
    }).length;
  }, [users, id]);

  // Use the refined openAssignUsersDialog to refresh user list when dialog opens
  const openAssignUsersDialog = async () => {
    setDialogOpen(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/users/populate-roles", {
        headers: { Authorization: `Bearer ${token}`, "X-Required-Permission": "settings" }
      });
      setUsers(res.data);

      const assignedIds = res.data
        .filter((u: any) => {
          const userRoleId = typeof u.role === 'object' ? u.role?._id : u.role;
          return userRoleId === id;
        })
        .map((u: any) => u._id);
      setSelectedUsers(assignedIds);
    } catch (err) {
      console.error("Failed to refresh users list", err);
    }
  };


  // const toggleUserSelection = (userId: string) => {
  //   setSelectedUsers(prev =>
  //     prev.includes(userId)
  //       ? prev.filter(id => id !== userId)
  //       : [...prev, userId]
  //   );
  // };

  const saveUserAssignments = async () => {
    try {
      await axios.put(`/api/roles/${id}/assign-users`,
        { userIds: selectedUsers },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, "X-Required-Permission": "settings", } }
      );
      alert("User role updated successfully!");
      setDialogOpen(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(err);
        alert("Failed to assign user role");
      }
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Role Details...</div>;
  if (!role) return <div className="p-10 text-center text-red-500">Role not found.</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Edit Role</h1>
      {/* Badge showing current type */}
      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${role.inStoreAccount ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
        {role.inStoreAccount ? "Store Account (Passcode)" : "Office Account (Password)"}
      </div>
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <label>Role Name</label>
          <Input
            value={role.role_name}
            onChange={(e) => setRole({ ...role, role_name: e.target.value })}
          />
        </div>

        <div className="flex-1">
          <label>Description</label>
          <Input
            value={role.description || ""}
            onChange={(e) => setRole({ ...role, description: e.target.value })}
          />
        </div>

        <div className="flex-1 flex flex-col space-y-1">
          <Button variant="outline" onClick={() => setTypeDialogOpen(true)}>
            Set Account Type
          </Button>
        </div>

        <div className="flex-1 flex items-end">
          <Button onClick={openAssignUsersDialog}>
            Assigned to {assignedUserCount} User(s)
          </Button>
        </div>
      </div>

      <RolePermissionEditor
        role={role}
        onSave={handleSave}
      />

      <Button
        className="bg-red-600 text-white hover:bg-red-500"
        onClick={handleDelete}
      >
        Delete Role
      </Button>

      {/* Assign Users Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Assign Users to Role: {role?.role_name}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 pr-2">
            <div className="grid grid-cols-1 gap-2">
              {users.map((u) => {
                const isActive = u.is_active !== false;
                const currentRoleName = u.role?.role_name || "No Role";

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
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        {u.email}
                        <span className={`font-mono px-2 py-0.5 rounded text-xs uppercase ${isActive
                          ? "text-blue-600 bg-blue-50 border border-blue-100"
                          : "text-red-600 bg-red-50 border border-red-100 font-bold"
                          }`}>
                          {!isActive ? "INACTIVE" : `Current: ${currentRoleName}`}
                        </span>
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      disabled={!isActive}
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

          <DialogFooter className="pt-4 border-t mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveUserAssignments}
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 3. Account Type Selection Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Account Type Preference</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <RadioGroup
              value={pendingInStoreAccount ? "store" : "office"}
              onValueChange={(val) => setPendingInStoreAccount(val === "store")}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3 border p-3 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                <RadioGroupItem value="office" id="office" />
                <Label htmlFor="office" className="flex flex-col cursor-pointer flex-1">
                  <span className="font-bold">Office Account</span>
                  <span className="text-xs text-muted-foreground">Uses standard Password login</span>
                </Label>
              </div>

              <div className="flex items-center space-x-3 border p-3 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                <RadioGroupItem value="store" id="store" />
                <Label htmlFor="store" className="flex flex-col cursor-pointer flex-1">
                  <span className="font-bold">Store Account</span>
                  <span className="text-xs text-muted-foreground">Uses 6-digit Passcode login</span>
                </Label>
              </div>
            </RadioGroup>

            {/* Warning Message Section */}
            {pendingInStoreAccount !== role.inStoreAccount && (
              <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Warning:</strong> You are switching to{" "}
                  {pendingInStoreAccount ? "Passcode" : "Password"} login.
                  All <strong>{assignedUserCount} user(s)</strong> assigned to this role will be required to use this new method immediately.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-end space-x-2">
            <Button variant="ghost" onClick={() => setTypeDialogOpen(false)} disabled={isUpdatingType}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAccountType}
              disabled={isUpdatingType || pendingInStoreAccount === role.inStoreAccount}
              className={pendingInStoreAccount !== role.inStoreAccount ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            >
              {isUpdatingType ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</>
              ) : (
                "Update Type"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}