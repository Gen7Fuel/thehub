import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import axios from "axios";
import { MasterDetailShell } from "@/components/custom/masterDetailShell";

export const Route = createFileRoute('/_navbarLayout/settings/roles')({
  component: RouteComponent,
  loader: async () => {
    try {
      // Fetch all roles from backend
      const response = await axios.get('/api/roles', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "settings",
        },
      });
      if (response.status === 403) {
        // explicitly catch 403s even if backend responds oddly
        return { roles: [], accessDenied: true };
      }
      return { roles: response.data, accessDenied: false };
    } catch (error) {
      console.error('Error fetching roles:', error);
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return { roles: [], accessDenied: true };
      }
      
      return { roles: [], accessDenied: false };
    }
  },
});

interface Role {
  _id: string;
  role_name: string;
  permissions: {
    name: string;
    children: { name: string }[];
  }[];
}

function RouteComponent() {
  const navigate = useNavigate();
  const { roles, accessDenied } = Route.useLoaderData() as {
    roles: Role[];
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

  return (
    <MasterDetailShell
      sidebar={
        <>
          {roles.map((role) => (
            <Link
              key={role._id}
              className="p-2 w-full"
              to="/settings/roles/$id"
              params={{ id: role._id }}
              activeProps={activeProps}
            >
              {role.role_name}
            </Link>
          ))}

          {/* Add New Role Button */}
          <Link
            to="/settings/roles/new"
            className="mt-4 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 w-full text-center"
          >
            + Add New Role
          </Link>
        </>
      }
    >
      <Outlet />
    </MasterDetailShell>
  );
}