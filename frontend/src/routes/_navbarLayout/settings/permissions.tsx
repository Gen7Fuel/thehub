import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import axios from "axios";

export const Route = createFileRoute('/_navbarLayout/settings/permissions')({
  component: RouteComponent,
  loader: async () => {
    try {
      // Fetch all permissions from backend
      const response = await axios.get('/api/permissions', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return { permissions: response.data };
    } catch (error) {
      console.error('Error fetching permissions:', error);
      return { permissions: [] };
    }
  },
});

interface Permission {
  _id: string;
  module_name: string;
  components: {
    name: string;
    children: string[];
  }[];
}

function RouteComponent() {
  const { permissions } = Route.useLoaderData() as { permissions: Permission[] };

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
    <div className="flex">
      {/* Sidebar list of modules */}
      <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
        {permissions.map((permission) => (
          <Link
            key={permission._id}
            className="p-2 w-full text-right"
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
      </aside>

      {/* Content area (show details or form) */}
      <main className="w-3/4">
        <Outlet />
      </main>
    </div>
  );
}