// import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
// import axios from "axios"

// export const Route = createFileRoute('/_navbarLayout/settings/users')({
//   component: RouteComponent,
//   loader: async () => {
//     try {
//       // add authorization header with bearer token
//       const response = await axios.get('/api/users', {
//         headers: {
//           Authorization: `Bearer ${localStorage.getItem('token')}`
//         }
//       });
//       return { users : response.data };
//     } catch (error) {
//       console.error('Error fetching users:', error);
//       return { users: [] };
//     }
//   },
// });

// interface User {
//   _id: string;
//   email: string;
//   password: string;
//   firstName: string;
//   lastName: string;
//   is_active: boolean;
//   is_admin: boolean;
//   stationName: string;
//   __v: number;
// }

// function RouteComponent() {
//   const { users } = Route.useLoaderData() as { users: User[] };

//   const activeProps = {
//     className: 'bg-gray-100 rounded-md',
//   };

//   return (
//     <div className="flex">
//       <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
//         {users.map((user) => (
//           <Link
//             key={user._id}
//             className="p-2"
//             to="/settings/users/$userId"
//             params={{ userId: user._id }}
//             activeProps={activeProps}
//           >
//             {user.firstName} {user.lastName}
//           </Link>
//         ))}
//       </aside>
//       <main className="w-3/4">
//         <Outlet />
//       </main>
//     </div>
//   );
// }
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import axios from "axios";
import { useState } from "react";
import { Switch } from "@/components/ui/switch"; // assuming you use shadcn/ui Switch

export const Route = createFileRoute('/_navbarLayout/settings/users')({
  component: RouteComponent,
  loader: async () => {
    try {
      const response = await axios.get('/api/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      return { users: response.data };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { users: [] };
    }
  },
});

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  is_active: boolean;
}

function RouteComponent() {
  const { users: initialUsers } = Route.useLoaderData() as { users: User[] };
  const [users, setUsers] = useState<User[]>(initialUsers);

  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  };

  const handleToggle = async (userId: string, currentValue: boolean) => {
    try {
      const updatedValue = !currentValue;
      setUsers(prev =>
        prev.map(user =>
          user._id === userId ? { ...user, is_active: updatedValue } : user
        )
      );

      await axios.patch(
        `/api/users/${userId}/active`,
        { is_active: updatedValue },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
    } catch (error) {
      console.error("Failed to update user status:", error);
      // Revert state if API fails
      setUsers(prev =>
        prev.map(user =>
          user._id === userId ? { ...user, is_active: !user.is_active } : user
        )
      );
    }
  };

  return (
    <div className="flex">
      <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed space-y-2">
        {users.map((user) => (
          <div key={user._id} className="flex items-center justify-between w-full">
            {user.is_active ? (
              <Link
                to="/settings/users/$userId"
                params={{ userId: user._id }}
                activeProps={activeProps}
                className="p-2 w-full text-left"
              >
                {user.firstName} {user.lastName}
              </Link>
            ) : (
              <span className="p-2 w-full text-left text-gray-400 cursor-not-allowed">
                {user.firstName} {user.lastName}
              </span>
            )}
            <Switch
              checked={user.is_active}
              onCheckedChange={() => handleToggle(user._id, user.is_active)}
            />
          </div>
        ))}
      </aside>
      <main className="w-3/4">
        <Outlet />
      </main>
    </div>
  );
}