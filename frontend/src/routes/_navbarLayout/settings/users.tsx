import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MasterDetailShell } from "@/components/custom/masterDetailShell";
import { isApiError } from '@/api/core/errors';
import { usersApi } from '@/api/users/users.service';
import { userQueries } from '@/api/users/users.queries';

export const Route = createFileRoute('/_navbarLayout/settings/users')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      const users = await context.queryClient.ensureQueryData(userQueries.list());
      return { users, accessDenied: false };
    } catch (error: unknown) {
      console.error('Error fetching users:', error);
      const accessDenied = isApiError(error) && error.status === 403;
      return { users: [], accessDenied };
    }
  },
});

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  is_active: boolean;
  is_loggedIn: boolean; // ✅ New field
}

function RouteComponent() {
  const navigate = useNavigate();
  const { users: initialUsers, accessDenied } = Route.useLoaderData() as {
    users: User[];
    accessDenied: boolean;
  };

  const [users, setUsers] = useState<User[]>(initialUsers);
  const [search, setSearch] = useState("");
  // Password input
  const [password, setPassword] = useState("");

  // Show dialogs
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showLogoutConfirmDialog, setShowLogoutConfirmDialog] = useState(false);


  useEffect(() => {
    if (accessDenied) navigate({ to: '/no-access' });
  }, [accessDenied, navigate]);

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    return users.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const handleToggle = async (userId: string, currentValue: boolean) => {
    try {
      const updatedValue = !currentValue;
      setUsers(prev =>
        prev.map(user => user._id === userId ? { ...user, is_active: updatedValue } : user)
      );

      const target = users.find((user) => user._id === userId);
      await usersApi.setActive(userId, target ? `${target.firstName} ${target.lastName}` : userId, updatedValue);
    } catch (err: any) {
      setUsers(prev =>
        prev.map(user => user._id === userId ? { ...user, is_active: !user.is_active } : user)
      );
      if (isApiError(err) && err.status === 403) navigate({ to: "/no-access" });
      else console.error("Failed to update user status:", err);
    }
  };

  const handleLogoutAll = async () => {
    try {
      await usersApi.logoutAll();

      alert("All users logged out successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to logout users.");
    }

    setShowLogoutConfirmDialog(false);
  };


  const verifyPassword = async () => {
    try {
      await usersApi.verifyAdministrator(password, 'Administrator verification requested before logging out all users');

      // Password correct → close this dialog & open confirmation
      setShowPasswordDialog(false);
      setShowLogoutConfirmDialog(true);

    } catch {
      alert("Invalid password!");
    }
  };


  return (
    <>
      <MasterDetailShell
        sidebar={
          <>
            {/* Search + Logout All */}
            <div className="flex items-center gap-2 mb-4 w-full">
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Button
                className="bg-red-600 text-white hover:bg-red-500"
                onClick={() => {
                  const loggedInIds = users.filter(u => u.is_loggedIn).map(u => u._id);
                  if (!loggedInIds.length) return alert("No users are currently logged in.");

                  // setLogoutUserIds(loggedInIds); // store for confirm dialog
                  setPassword("");
                  setShowPasswordDialog(true); // first ask for password
                }}
              >
                Logout All Users
              </Button>
            </div>

            {filteredUsers.map((user) => (
              <div key={user._id} className="flex items-center justify-between w-full">
                {user.is_active ? (
                  <Link
                    to="/settings/users/$userId"
                    params={{ userId: user._id }}
                    activeProps={{
                      className: 'bg-gray-100 rounded-md'
                    }}
                    className={`p-2 w-full text-left ${user.is_loggedIn ? "text-green-600 font-semibold" : ""
                      }`}
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
            ))
            }
          </>
        }
      >
        <Outlet />
      </MasterDetailShell>

      <Dialog open={showLogoutConfirmDialog} onOpenChange={setShowLogoutConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
          </DialogHeader>

          <p>Are you sure you want to log out all users?</p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutConfirmDialog(false)}>
              Cancel
            </Button>

            <Button
              className="bg-red-600 text-white"
              onClick={handleLogoutAll}
            >
              Yes, Logout Users
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Password</DialogTitle>
          </DialogHeader>

          <Input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <DialogFooter>
            <Button onClick={verifyPassword}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
