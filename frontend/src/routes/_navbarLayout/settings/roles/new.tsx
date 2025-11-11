import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RolePermissionEditor } from "@/components/custom/RolePermissionEditor";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import axios from "axios";

export interface PermissionNode {
  name: string;
  value?: boolean;
  children?: PermissionNode[];
}

export interface PermissionTemplate {
  _id: string;
  module_name: string;
  structure: PermissionNode[];
}

export interface Role {
  _id?: string;
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
  const [permissionTemplates, setPermissionTemplates] = useState<PermissionTemplate[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("none");

  // Map helper
  const mapPermissionNodes = (nodes: any[]): PermissionNode[] =>
    nodes.map((node) => ({
      name: node.name,
      value: node.value ?? false,
      children: node.children ? mapPermissionNodes(node.children) : [],
    }));

  const mapPermissionsToRole = (permissions: PermissionTemplate[]): PermissionNode[] =>
    permissions.map((module) => ({
      name: module.module_name,
      value: false,
      children: mapPermissionNodes(module.structure),
    }));

  // Fetch both: base permission templates and roles
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const [permRes, roleRes] = await Promise.all([
          axios.get<PermissionTemplate[]>("/api/permissions", {
            headers: { Authorization: `Bearer ${token}`,"X-Required-Permission": "settings" },
          }),
          axios.get<Role[]>("/api/roles", {
            headers: { Authorization: `Bearer ${token}`,"X-Required-Permission": "settings" },
          }),
        ]);

        setPermissionTemplates(permRes.data);
        setAllRoles(roleRes.data);

        // Default: show base permissions (no template)
        const mappedPermissions = mapPermissionsToRole(permRes.data);
        setRole((prev) => ({ ...prev, permissions: mappedPermissions }));
      } catch (err) {
        console.error("Error loading templates or roles:", err);
        // Handle 403 specifically
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          navigate({to:"/no-access"});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle template selection
const handleTemplateSelect = (templateId: string) => {
  setSelectedTemplate(templateId);

  if (templateId === "none") {
    // Reset to base permissions
    const mapped = mapPermissionsToRole(permissionTemplates);
    setRole((prev) => ({
      ...prev,
      permissions: mapped,
    }));
    console.log("Template cleared → using base permissions:", mapped);
  } else {
    const selectedRole = allRoles.find((r) => r._id === templateId);
    if (selectedRole && selectedRole.permissions) {
      const clonedPermissions = JSON.parse(
        JSON.stringify(selectedRole.permissions)
      );

      console.log("Applying permissions from template:", selectedRole.role_name);

      // Update permissions in role state
      setRole((prev) => ({
        ...prev,
        permissions: clonedPermissions,
      }));
    } else {
      console.warn("Selected role has no permissions or was not found.");
    }
  }
};

  // Create new role
  const handleCreate = async () => {
    if (!role.role_name.trim()) {
      alert("Role name is required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/roles", role, {
        headers: { Authorization: `Bearer ${token}`,"X-Required-Permission": "settings" },
      });
      alert("Role created successfully!");
      navigate({ to: "/settings/roles/" });
    } catch (err: any) {
      if (err.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(err);
        alert("Failed to create role");
      }
    }
  };

  if (loading) return <div>Loading...</div>;
  console.log(role)

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

      {/* --- TEMPLATE DROPDOWN --- */}
      <div>
        <label>Use Existing Role as Template</label>
        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
          <SelectTrigger className="w-full mt-1">
            <SelectValue placeholder="Select a role template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Template Selected (Start Fresh)</SelectItem>
            {allRoles.map((r) => (
              <SelectItem key={r._id} value={r._id!}>
                {r.role_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* --- PERMISSIONS EDITOR --- */}
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