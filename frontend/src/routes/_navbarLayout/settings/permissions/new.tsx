import { createFileRoute, useNavigate } from '@tanstack/react-router';
import axios from "axios";
import { PermissionTree } from "@/components/custom/PermissionTree";

export const Route = createFileRoute('/_navbarLayout/settings/permissions/new')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  // Initialize empty permission for the new page
  const permission = {
    module_name: "",
    structure: [],
  };

  // Handle save callback
  const handleSave = async (structure: any[], moduleName: string) => {
    try {
      await axios.post(`/api/permissions`, {
        module_name: moduleName,
        structure,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "settings", },
      });
      alert("Permission created successfully!");
      navigate({ to: "/settings/permissions" });
    } catch (error: any) {
      if (error.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(error);
        alert("Failed to create permission.");
      }
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm space-y-4">
      <h1 className="text-2xl font-semibold">Create New Permission</h1>
      <PermissionTree permission={permission} onSave={handleSave} />
    </div>
  );
}