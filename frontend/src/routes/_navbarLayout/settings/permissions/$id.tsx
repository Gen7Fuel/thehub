import { createFileRoute, useNavigate } from '@tanstack/react-router';
import axios from "axios";
import { PermissionTree } from "@/components/custom/PermissionTree"; // Import the improved UI component

export const Route = createFileRoute('/_navbarLayout/settings/permissions/$id')({
  component: RouteComponent,
  loader: async ({ params }) => {
    try {
      const response = await axios.get(`/api/permissions/${params.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "settings",
        },
      });
      return { permission: response.data || null };
    } catch (error: any) {
      console.error("Error fetching permission:", error);

      // Check if it's a 403 error
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return { permission: null, noAccess: true };
      }

      return { permission: null, noAccess: false };
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { permission, noAccess } = Route.useLoaderData() as { permission: any; noAccess?: boolean };

  // Redirect to /no-access if 403
  if (noAccess) {
    navigate({to:'/no-access'});
    return null; // Prevent rendering anything else
  }

  if (!permission) return <div className="p-4 text-red-500">Permission not found.</div>;

  // Handle save callback
  // const handleSave = async (structure: any[], moduleName: string, oldModuleName: string) => {
  const handleSave = async (structure: any[], moduleName: string) => {
    try {
      await axios.put(`/api/permissions/${permission._id}`, {
        module_name: moduleName,
        // old_module_name: oldModuleName,
        structure,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "settings",
        },
      });
      alert("Permission updated successfully!");
      navigate({ to: "/settings/permissions" });
    } catch (error: any) {
      if (error.response?.status === 403) {
        // Redirect to no-access page
        navigate({ to: "/no-access" });
      } else {
        console.error(error);
        alert("Failed to update permission.");
      }
    }
  };

  return <PermissionTree permission={permission} onSave={handleSave} />;
}