import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PermissionTree } from "@/components/custom/PermissionTree"; // Import the improved UI component
import { isApiError } from '@/api/core/errors';
import { permissionsApi } from '@/api/permissions/permissions.api';
import { permissionKeys, permissionQueries } from '@/api/permissions/permissions.queries';
import type { Permission, PermissionNode } from '@/api/permissions/permissions.types';

export const Route = createFileRoute('/_navbarLayout/settings/permissions/$id')({
  component: RouteComponent,
  loader: async ({ params, context }) => {
    try {
      const permission = await context.queryClient.ensureQueryData(permissionQueries.detail(params.id));
      return { permission, noAccess: false };
    } catch (error: unknown) {
      console.error("Error fetching permission:", error);
      if (isApiError(error) && error.status === 403) {
        return { permission: null, noAccess: true };
      }
      return { permission: null, noAccess: false };
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { permission, noAccess } = Route.useLoaderData() as { permission: Permission | null; noAccess: boolean };

  useEffect(() => {
    if (noAccess) navigate({ to: '/no-access' });
  }, [navigate, noAccess]);

  const updatePermission = useMutation({
    mutationFn: ({ structure, moduleName }: { structure: PermissionNode[]; moduleName: string }) =>
      permissionsApi.update(permission!._id, { module_name: moduleName, structure }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(permissionKeys.detail(updated._id), updated);
      await queryClient.invalidateQueries({ queryKey: permissionKeys.lists() });
      alert("Permission updated successfully!");
      navigate({ to: "/settings/permissions" });
    },
    onError: (error: unknown) => {
      if (isApiError(error) && error.status === 403) {
        navigate({ to: "/no-access" });
      } else {
        console.error(error);
        alert("Failed to update permission.");
      }
    },
  });

  if (noAccess) return null;

  if (!permission) return <div className="p-4 text-red-500">Permission not found.</div>;

  // Handle save callback
  // const handleSave = async (structure: any[], moduleName: string, oldModuleName: string) => {
  const handleSave = (structure: PermissionNode[], moduleName: string) => {
    updatePermission.mutate({ structure, moduleName });
  };

  return <PermissionTree permission={permission} onSave={handleSave} />;
}
