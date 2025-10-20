import { createFileRoute, Outlet } from "@tanstack/react-router";
import axios from "axios";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";


export const Route = createFileRoute("/_navbarLayout/settings/permissions/")({
  component: RouteComponent,
  loader: async () => {
    try {
      const response = await axios.get("/api/permissions", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      // console.log("Permissions response:", response.data); 
      return { permissions: response.data };
    } catch (error) {
      console.error("Error fetching permissions:", error);
      return { permissions: [] };
    }
  },
});

interface Permission {
  _id: string;
  name: string;
}

function RouteComponent() {
  const { permissions } = Route.useLoaderData() as {
    permissions: Permission[];
  };
  const { user } = useAuth();

  if (user) {
    console.log("email:", user.access[0]?.module_station_audit);
  } else {
    console.log("No user logged in");
  }

  const [newPermission, setNewPermission] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "/api/permissions",
        { name: newPermission },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      alert(response.data.message); // Add and Sync confirmation
      setStatus("Permission added!");
      setNewPermission("");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setStatus("Failed to add permission");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this permission?")) {
      return; // user canceled
    }

    try {
      await axios.delete(`/api/permissions/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setStatus("Permission deleted!");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setStatus("Failed to delete permission");
    }
  };

  const handleSync = async () => {
    try {
      const res = await axios.post(
        "/api/permissions/sync",
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      alert(res.data.message);
      setStatus(res.data.message);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setStatus("Failed to sync permissions");
    }
  };

const handleEdit = async (id: string, currentName: string) => {
  const newName = prompt(`Rename permission '${currentName}' to:`, currentName);
  if (!newName) return; // canceled
  if (newName.trim() === currentName.trim()) return;

  try {
    const response = await axios.put(
      `/api/permissions/${id}`,
      { newName: newName.trim() },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );

    // show success details: use alert to be visible
    const msg = response.data?.message || "Permission renamed successfully";
    alert(msg + (response.data?.usersModified !== undefined ? `\nUsers modified: ${response.data.usersModified}` : ""));
    setStatus((response.data?.message || "Renamed"));
    window.location.reload();
  } catch (err: any) {
    console.error("Rename error:", err);
    // Show backend-provided message if present
    const serverMsg = err.response?.data?.error || err.response?.data?.details || err.message;
    alert("Failed to rename permission: " + serverMsg);
    setStatus("Failed to rename permission: " + (serverMsg || ""));
  }
};

  return (
    <div className="flex">
      {/* Main content */}
      <main className="w-3/4 p-4">
        <h2 className="text-lg font-bold mb-2">Permissions</h2>

        {/* Add new permission */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="text"
            className="border rounded px-3 py-2 flex-1"
            placeholder="New permission"
            value={newPermission}
            onChange={(e) => setNewPermission(e.target.value)}
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add
          </button>
          <button
            type="button"
            onClick={handleSync}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Sync
          </button>
        </form>

        {/* List all permissions */}
        <ul className="space-y-2">
          {permissions.map((perm) => (
            <li
              key={perm._id}
              className="flex justify-between items-center border px-3 py-2 rounded"
            >
              <span>{perm.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(perm._id, perm.name)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(perm._id)}
                  className="px-4 py-2 bg-red-400 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {status && <div className="mt-2 text-sm">{status}</div>}
        <Outlet />
      </main>
    </div>
  );
}
