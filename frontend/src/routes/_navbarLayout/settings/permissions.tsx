import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { MasterDetailShell } from "@/components/custom/masterDetailShell";
import { isApiError } from '@/api/core/errors';
import { permissionQueries } from '@/api/permissions/permissions.queries';
import type { Permission } from '@/api/permissions/permissions.types';

export const Route = createFileRoute('/_navbarLayout/settings/permissions')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      const permissions = await context.queryClient.ensureQueryData(permissionQueries.list());
      return { permissions, accessDenied: false };
    } catch (error: unknown) {
      console.error('Error fetching permissions:', error);
      if (isApiError(error) && error.status === 403) {
        return { permissions: [], accessDenied: true };
      }
      return { permissions: [], accessDenied: false };
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { permissions, accessDenied } = Route.useLoaderData() as {
    permissions: Permission[];
    accessDenied: boolean;
  };

  // 🚦 Redirect when access is denied
  useEffect(() => {
    if (accessDenied) {
      navigate({ to: '/no-access' });
    }
  }, [accessDenied, navigate]);

  if (accessDenied) return null; // avoid flicker before redirect

  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  };
  
  // captalise the first letter for easy reading only for diaplay
  const fromCamelCase = (str: string) => {
    if (!str) return "";
    return str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  };

  return (
    <MasterDetailShell
      sidebar={
        <>
          {permissions.map((permission) => (
            <Link
              key={permission._id}
              className="p-2 w-full"
              to="/settings/permissions/$id"
              params={{ id: permission._id }}
              activeProps={activeProps}
            >
              {fromCamelCase(permission.module_name)}
            </Link>
          ))}

          {/* Add New Permission Button */}
          <Link
            to="/settings/permissions/new"
            className="mt-4 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 w-full text-center"
          >
            + Add New Permission
          </Link>
        </>
      }
    >
      <Outlet />
    </MasterDetailShell>
  );
}
