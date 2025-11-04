import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import axios from "axios";

export const Route = createFileRoute('/_navbarLayout/settings/roles')({
  component: RouteComponent,
  loader: async () => {
    try {
      // Fetch all roles from backend
      const response = await axios.get('/api/roles', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return { roles: response.data };
    } catch (error) {
      console.error('Error fetching roles:', error);
      return { roles: [] };
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
  const { roles } = Route.useLoaderData() as { roles: Role[] };

  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  };

  return (
    <div className="flex">
      {/* Sidebar list of roles */}
      <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
        {roles.map((role) => (
          <Link
            key={role._id}
            className="p-2 w-full text-right"
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
      </aside>

      {/* Content area (shows selected role or new form) */}
      <main className="w-3/4">
        <Outlet />
      </main>
    </div>
  );
}