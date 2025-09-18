import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute(
  '/_navbarLayout/audit/templates/checklist/list',
)({
  component: RouteComponent,
})

interface AuditTemplate {
  _id: string;
  name: string;
  description?: string;
  sites?: string[];
}

function RouteComponent() {
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("/api/audit", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then(res => setTemplates(res.data))
      .catch(() => setError("Failed to load audit templates"))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (id: string) => {
    window.location.href = `/audit/templates/checklist/${id}`;
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await axios.delete(`/api/audit/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setTemplates(templates => templates.filter(t => t._id !== id));
    } catch {
      alert("Failed to delete template.");
    }
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Audit Checklist Templates</h2>
      <table className="w-full border-collapse bg-white shadow rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-6 py-3 font-medium text-gray-700">Name</th>
            <th className="text-left px-6 py-3 font-medium text-gray-700">Description</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {templates.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center py-6 text-gray-500">
                No audit templates found.
              </td>
            </tr>
          ) : (
            templates.map(template => (
              <tr key={template._id} className="border-b last:border-b-0">
                <td className="px-6 py-4 text-gray-900">{template.name}</td>
                <td className="px-6 py-4 text-gray-800">{template.description || <span className="text-gray-400">No description</span>}</td>
                <td className="px-6 py-4 flex gap-2 justify-end">
                  <button
                    onClick={() => handleEdit(template._id)}
                    className="p-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                    title="Edit"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="p-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-700 transition"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}