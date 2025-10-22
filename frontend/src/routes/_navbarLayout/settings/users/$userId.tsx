import axios from "axios";
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch'; // Import the Switch component from ShadCN UI

export const Route = createFileRoute('/_navbarLayout/settings/users/$userId')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { userId } = params;
    try {
      // add authorization header with bearer token
      const response = await axios.get(`/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }); // Fetch user info by userId
      return { user: response.data };
    } catch (error) {
      console.error('Error fetching user:', error);
      return { user: null };
    }
  },
});

function RouteComponent() {
  const [newPassword, setNewPassword] = useState("");
  const [resetStatus, setResetStatus] = useState<null | string>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    try {
      await axios.post(
        "/api/auth/reset-password",
        { userId: params.userId, newPassword },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setResetStatus("Password reset successfully!");
      setNewPassword("");
    } catch (error) {
      setResetStatus("Failed to reset password.");
    }
  };

  const params = Route.useParams() as { userId: string };
  const { user } = Route.useLoaderData() as {
    user: { firstName: string; lastName: string; access: Record<string, any>; is_admin: boolean; is_inOffice: boolean; } | null;
  };

  const [access, setAccess] = useState<Record<string, any>>(user?.access || {});
  const [isAdmin, setIsAdmin] = useState(user?.is_admin || false);
  const [isInOffice, setIsInOffice] = useState(user?.is_inOffice || false);
  if (!user) {
    return <div>User not found</div>;
  }

  const handleCheckboxChange = (key: string) => {
    setAccess((prevAccess) => ({
      ...prevAccess,
      [key]: !prevAccess[key], // Toggle the value of the switch
    }));
  };

  // Example for handling site_access toggles
  const handleSiteToggle = (site: string) => {
    setAccess((prev) => ({
      ...prev,
      site_access: {
        ...prev.site_access,
        [site]: !prev.site_access?.[site],
      },
    }));
  };

  const handleUpdate = async () => {
    try {
      // add authorization header with bearer token
      await axios.put(`/api/users/${params.userId}`, { 
          access,
          is_admin: isAdmin,
          is_inOffice: isInOffice,
      }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Access updated successfully!');
    } catch (error) {
      console.error('Error updating access:', error);
      alert('Failed to update access');
    }
  };

  useEffect(() => {
    setAccess(user?.access || {});
  }, [user]);

  return (
    <div className='pl-4 pt-2'>
      {/* Password Reset Form */}
      <div className="mt-8">
        <h2 className="text-lg font-bold mb-2">Reset User Password</h2>
        <form onSubmit={handlePasswordReset} className="flex items-center gap-2">
          <input
            type="password"
            className="border rounded px-3 py-2"
            placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset Password
          </button>
        </form>
        {resetStatus && (
          <div className="mt-2 text-sm text-gray-700">{resetStatus}</div>
        )}
      </div>

      {/* <h2 className="text-lg font-bold mb-4">Access Permissions</h2>
      <form className="space-y-2">
        {Object.entries(access).map(([key, value]) => (
          <div key={key} className="flex items-center space-x-4">
            <Switch
              id={key}
              checked={value}
              onCheckedChange={() => handleCheckboxChange(key)} // Use onCheckedChange for Switch
            />
            <label htmlFor={key} className="text-sm font-medium text-gray-700">
              {key}
            </label>
          </div>
        ))}
      </form> */}
      <h2 className="text-lg font-bold mb-4">Access Permissions</h2>

      {/* Admin / InOffice Toggles */}
      <div className="flex items-center gap-4 mb-2">
        <Switch checked={isAdmin} onCheckedChange={setIsAdmin} id="isAdmin" />
        <label htmlFor="isAdmin">Admin</label>

        <Switch checked={isInOffice} onCheckedChange={setIsInOffice} id="isInOffice" />
        <label htmlFor="isInOffice">In Office</label>
      </div>

        {/* Permissions */}
      <form className="space-y-2">
        {/* 3️⃣ Site Access toggles */}
        {access.site_access && typeof access.site_access === "object" && (
          <div className="mb-2">
            <div className="flex items-center space-x-4 font-medium text-gray-700">
              <span>Site Access</span>
            </div>
            <div className="ml-6 mt-1 space-y-1">
              {Object.entries(access.site_access as Record<string, boolean>).map(
                ([site, val]) => (
                  <div key={site} className="flex items-center space-x-2">
                    <Switch
                      checked={Boolean(val)}
                      onCheckedChange={() => handleSiteToggle(site)}
                      id={site}
                    />
                    <label htmlFor={site} className="text-sm text-gray-700">
                      {site}
                    </label>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* 4️⃣ Other permissions (excluding site_access) */}
        {Object.entries(access)
          .filter(([key]) => key !== "site_access")
          .map(([key, value]) => (
            <div key={key} className="flex items-center space-x-4">
              <Switch
                checked={Boolean(value)}
                onCheckedChange={() => handleCheckboxChange(key)}
                id={key}
              />
              <label htmlFor={key} className="text-sm text-gray-700">
                {key}
              </label>
            </div>
          ))}
      </form>


      <button
        onClick={handleUpdate}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Update
      </button>
    </div>
  );
}