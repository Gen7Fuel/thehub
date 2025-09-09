import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import axios from "axios"

export const Route = createFileRoute('/_navbarLayout/settings/users')({
  component: RouteComponent,
  loader: async () => {
    try {
      // add authorization header with bearer token
      const response = await axios.get('/api/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      return { users : response.data };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { users: [] };
    }
  },
});

interface User {
  _id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  is_active: boolean;
  is_admin: boolean;
  stationName: string;
  __v: number;
}

function RouteComponent() {
  const { users } = Route.useLoaderData() as { users: User[] };

  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  };

  return (
    <div className="flex">
      <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
        {users.map((user) => (
          <Link
            key={user._id}
            className="p-2"
            to="/settings/users/$userId"
            params={{ userId: user._id }}
            activeProps={activeProps}
          >
            {user.firstName} {user.lastName}
          </Link>
        ))}
      </aside>
      <main className="w-3/4">
        <Outlet />
      </main>
    </div>
  );
}