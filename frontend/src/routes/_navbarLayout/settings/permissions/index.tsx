import { createFileRoute, Outlet } from "@tanstack/react-router";
import axios from "axios";
import { useState } from "react";

export const Route = createFileRoute("/_navbarLayout/settings/permissions/")({
  component: RouteComponent,
  loader: async () => {
    try {
      const response = await axios.get("/api/permissions", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      console.log("Permissions response:", response.data); 
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

  const [newPermission, setNewPermission] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        "/api/permissions",
        { name: newPermission },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setStatus("Permission added!");
      setNewPermission("");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setStatus("Failed to add permission");
    }
  };

  const handleDelete = async (id: string) => {
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

  return (
    <div className="flex">
      {/* Sidebar like PayPoints */}
      {/* <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
        <Link
          to="/settings/permissions"
          activeProps={{ className: "bg-gray-100 rounded-md" }}
          className="p-2"
        >
          All Permissions
        </Link>
      </aside> */}

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
        </form>

        {/* List all permissions */}
        <ul className="space-y-2">
          {permissions.map((perm) => (
            <li
              key={perm._id}
              className="flex justify-between items-center border px-3 py-2 rounded"
            >
              <span>{perm.name}</span>
              <button
                onClick={() => handleDelete(perm._id)}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>

        {status && <div className="mt-2 text-sm">{status}</div>}
        <Outlet />
      </main>
    </div>
  );
}
