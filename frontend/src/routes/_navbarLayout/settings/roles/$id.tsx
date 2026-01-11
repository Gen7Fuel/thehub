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
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import axios from "axios";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
  permissions: PermissionNode[];
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: { _id: string };
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
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");

        // Fetch role and users in parallel
        const [roleRes, usersRes] = await Promise.all([
          axios.get<Role>(`/api/roles/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Required-Permission": "settings",
            },
          }),
          axios.get<User[]>("/api/users", {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Required-Permission": "settings",
            },
          }),
        ]);

        setRole(roleRes.data);
        setUsers(usersRes.data);

        // Compute assigned users
        const assignedIds = usersRes.data
          .filter((u) => u.role?._id === id)
          .map((u) => u._id);
        setSelectedUsers(assignedIds);

        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setLoading(false);

        // Handle 403 specifically
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate({to:"/no-access"});
        }
      }
    };

    fetchData();
  }, [id]);


  // Save role permissions
  const handleSave = async (updatedPermissions: PermissionNode[]) => {
    if (!role) return;
    try {
      await axios.put(
        `/api/roles/${id}`,
        { ...role, permissions: updatedPermissions },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,"X-Required-Permission": "settings", } }
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,"X-Required-Permission": "settings" },
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

  // Open assign users dialog
  const openAssignUsersDialog = async () => {
    setDialogOpen(true);
    try {
      const res = await axios.get<User[]>("/api/users", {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,"X-Required-Permission": "settings", }
      });
      
      setUsers(res.data); // update state for rendering
      
      // Compute assigned users using the fetched data directly
      const assignedIds = res.data
        .filter(u => u.role?.toString() === id)
        .map(u => u._id);
      setSelectedUsers(assignedIds);

    } catch (err: any) {
      if (err.response?.status === 403) {
          // Redirect to no-access page
          navigate({ to: "/no-access" });
      } else {
        console.error(err);
      }
    }
  };


  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const saveUserAssignments = async () => {
    try {
      await axios.put(`/api/roles/${id}/assign-users`, 
        { userIds: selectedUsers }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,"X-Required-Permission": "settings", } }
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

  if (loading || !role ) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Edit Role</h1>

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

        <div className="flex-1 flex items-end">
          <Button onClick={openAssignUsersDialog}>
            Assigned to {selectedUsers.length} User(s)
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Users to Role</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto mt-2">
            {users.map(u => (
              <label key={u._id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u._id)}
                  onChange={() => toggleUserSelection(u._id)}
                />
                <span>{u.firstName} {u.lastName} ({u.email})</span>
              </label>
            ))}
          </div>

          <DialogFooter className="mt-4 flex justify-end space-x-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveUserAssignments}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}