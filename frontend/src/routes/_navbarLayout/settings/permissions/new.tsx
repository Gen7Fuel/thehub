import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PermissionTree } from "@/components/custom/PermissionTree";
import { isApiError } from '@/api/core/errors';
import { permissionsApi } from '@/api/permissions/permissions.api';
import { permissionKeys } from '@/api/permissions/permissions.queries';
import type { PermissionNode } from '@/api/permissions/permissions.types';

export const Route = createFileRoute('/_navbarLayout/settings/permissions/new')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Initialize empty permission for the new page
  const permission = {
    module_name: "",
    structure: [],
  };

  // Handle save callback
  const createPermission = useMutation({
    mutationFn: permissionsApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: permissionKeys.all });
      alert("Permission created successfully!");
      navigate({ to: "/settings/permissions" });
    },
    onError: (error: unknown) => {
      if (isApiError(error) && error.status === 403) {
        navigate({ to: "/no-access" });
      } else {
        console.error(error);
        alert("Failed to create permission.");
      }
    },
  });

  const handleSave = (structure: PermissionNode[], moduleName: string) => {
    createPermission.mutate({ module_name: moduleName, structure });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto bg-gray-50 rounded-lg shadow-sm space-y-4">
      <h1 className="text-2xl font-semibold">Create New Permission</h1>
      <PermissionTree permission={permission} onSave={handleSave} />
    </div>
  );
}
