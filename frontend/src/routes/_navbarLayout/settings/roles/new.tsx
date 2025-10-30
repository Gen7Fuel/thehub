import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import axios from "axios";

// Permission node inside a role
export interface PermissionNode {
  name: string;
  value?: boolean;
  children?: PermissionNode[];
}

// Permission template from collection
export interface PermissionTemplate {
  _id: string;
  module_name: string;
  structure: PermissionNode[];
}

// Role type
export interface Role {
  _id?: string; // optional for new roles
  role_name: string;
  description?: string;
  permissions: PermissionNode[];
}

export const Route = createFileRoute("/_navbarLayout/settings/roles/new")({
  component: RouteComponent,
});

export function RouteComponent() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>({
    role_name: "",
    description: "",
    permissions: [],
  });
  const [loading, setLoading] = useState(true);

  // Convert PermissionNode[] from Permission collection to Role's PermissionNode[] with `value`
  const mapPermissionNodes = (nodes: any[]): PermissionNode[] => {
    return nodes.map(node => ({
      name: node.name,
      value: false, // default for new role
      children: node.children ? mapPermissionNodes(node.children) : [],
    }));
  };

  // Convert PermissionTemplate[] from API to Role permissions
  const mapPermissionsToRole = (permissions: PermissionTemplate[]): PermissionNode[] => {
    return permissions.map(module => ({
      name: module.module_name,  // keep module_name as top-level
      value: false,
      children: mapPermissionNodes(module.structure),
    }));
  };

  // Fetch permissions from the collection
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get<PermissionTemplate[]>("/api/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const mappedPermissions = mapPermissionsToRole(res.data);
        setRole(prev => ({ ...prev, permissions: mappedPermissions }));
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  // Create new role
  const handleCreate = async () => {
    if (!role.role_name.trim()) {
      alert("Role name is required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/roles", role, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Role created successfully!");
      navigate({ to: "/settings/roles/" });
    } catch (err) {
      console.error(err);
      alert("Failed to create role");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Create New Role</h1>

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
      </div>

      {/* RolePermissionEditor without onSave → hides the save button */}
      <RolePermissionEditor
        role={role}
        onChange={(updatedPermissions) =>
            setRole({ ...role, permissions: updatedPermissions })
        }
      />


      <Button
        onClick={handleCreate}
        className="bg-blue-600 text-white hover:bg-blue-500"
      >
        Create Role
      </Button>
    </div>
  );
}