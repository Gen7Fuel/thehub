import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute(
  '/_navbarLayout/audit/templates/select/list',
)({
  component: RouteComponent,
})

interface SelectTemplate {
  _id: string;
  name: string;
  description?: string;
  options: { text: string }[];
}

function RouteComponent() {
  const [templates, setTemplates] = useState<SelectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("/api/audit/select-templates", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })
      .then(res => setTemplates(res.data))
      .catch(() => setError("Failed to load select templates"))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await axios.delete(`/api/audit/select-templates/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setTemplates(templates => templates.filter(t => t._id !== id));
    } catch {
      alert("Failed to delete template.");
    }
  };

  const handleEdit = (id: string) => {
    window.location.href = `/audit/templates/select/${id}`;
  };

  if (loading) return <div className="text-center mt-8">Loading...</div>;
  if (error) return <div className="text-red-600 text-center mt-8">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Select Templates</h2>
      {templates.length === 0 ? (
        <div className="text-center py-6 text-gray-500">No select templates found.</div>
      ) : (
        <ul className="space-y-6">
          {templates.map(template => (
            <li
              key={template._id}
              className="bg-white shadow border border-gray-200 rounded-xl px-6 py-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-lg">{template.name}</div>
                <div className="flex gap-2">
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
                </div>
              </div>
              {template.description && (
                <div className="text-sm text-gray-500 mb-2">{template.description}</div>
              )}
              <div>
                <span className="font-medium">Options:</span>
                <ul className="list-disc ml-6 mt-1">
                  {template.options && template.options.length > 0 ? (
                    template.options.map((option, idx) => (
                      <li key={idx} className="text-gray-800">{option.text}</li>
                    ))
                  ) : (
                    <li className="text-gray-400">No options</li>
                  )}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}