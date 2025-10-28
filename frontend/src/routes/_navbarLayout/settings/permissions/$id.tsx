import { createFileRoute, useNavigate } from '@tanstack/react-router';
import axios from "axios";
import { PermissionTree } from "@/components/custom/PermissionTree"; // Import the improved UI component

export const Route = createFileRoute('/_navbarLayout/settings/permissions/$id')({
  component: RouteComponent,
  loader: async ({ params }) => {
    try {
      const response = await axios.get(`/api/permissions/${params.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      return { permission: response.data || null };
    } catch (error) {
      console.error("Error fetching permission:", error);
      return { permission: null };
    }
  },
});

function RouteComponent() {
  const { permission } = Route.useLoaderData() as { permission: any };
  const navigate = useNavigate();

  if (!permission) return <div className="p-4 text-red-500">Permission not found.</div>;

  // Handle save callback
  const handleSave = async (structure: any[], moduleName: string) => {
    try {
      await axios.put(`/api/permissions/${permission._id}`, {
        module_name: moduleName,
        structure,
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      alert("Permission updated successfully!");
      navigate({ to: "/settings/permissions" });
    } catch (error) {
      console.error(error);
      alert("Failed to update permission.");
    }
  };

  return <PermissionTree permission={permission} onSave={handleSave} />;
}