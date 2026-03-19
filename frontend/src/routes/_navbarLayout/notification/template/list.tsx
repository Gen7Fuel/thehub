import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { Edit3, Trash2, Code } from 'lucide-react';
import axios from 'axios';

export const Route = createFileRoute('/_navbarLayout/notification/template/list')({
  component: TemplateList,
});

function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/notification/template', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Required-Permission': 'notification.template'
        }
      });
      setTemplates(res.data);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;

    try {
      await axios.delete(`/api/notification/template/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Required-Permission': 'notification.template'
        }
      });

      // If successful, update the local state
      setTemplates(templates.filter((t: any) => t._id !== id));

    } catch (err: any) {
      console.error("Full Error Object:", err); // ADD THIS: Check your browser console

      // Check if we have a response from the server
      if (err.response) {
        const status = err.response.status;
        const errorMessage = err.response.data?.message || "Server Error";

        if (status === 400) {
          alert(errorMessage); // This will now show your "linked to existing notifications" message
        } else if (status === 403) {
          navigate({ to: '/no-access' }); // Redirect to a 403 Forbidden page if the user doesn't have permission
          return;
        } else {
          alert(`Error ${status}: ${errorMessage}`);
        }
      } else {
        // This handles network errors or cases where the server didn't respond
        alert("Network error: Could not reach the server.");
      }
    }
  };
  if (loading) return <div className="p-10 text-center">Loading templates...</div>;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Template Name</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Slug</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500">Fields</th>
              <th className="p-4 text-xs font-bold uppercase text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {templates.map((t: any) => (
              <tr key={t._id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  <div className="font-semibold text-gray-800">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.description || 'No description'}</div>
                </td>
                <td className="p-4 font-mono text-xs text-blue-600 font-semibold">{t.slug}</td>
                <td className="p-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs gap-1">
                    <Code className="h-3 w-3" /> {t.fields?.length || 0} variables
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => navigate({
                      to: '/notification/template',
                      // We will handle passing the ID for editing in the next step
                      search: { editId: t._id }
                    })}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(t._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && (
          <div className="p-10 text-center text-gray-500">No templates found. Go to Create Builder to start.</div>
        )}
      </div>
    </div>
  );
}