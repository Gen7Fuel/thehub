import axios from "axios";
import { slugToString } from '@/lib/utils';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';

export const Route = createFileRoute('/_navbarLayout/settings/paypoints/$site')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { site } = params;
    try {
      const response = await axios.get(`/api/paypoints/${site}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "settings",
        },
      });

      if (response.status === 403) {
        return { paypoints: [], accessDenied: true };
      }

      const data = response.data;
      return { paypoints: Array.isArray(data) ? data : [], accessDenied: false };
    } catch (error: any) {
      console.error('Error fetching paypoints:', error);

      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return { paypoints: [], accessDenied: true };
      }

      return { paypoints: [], accessDenied: false };
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { site } = Route.useParams() as { site: string };
  const { paypoints, accessDenied } = Route.useLoaderData() as {
    paypoints: { _id: string; label: string }[];
    accessDenied: boolean;
  };

  // 🚦 Redirect to /no-access if permission revoked
  useEffect(() => {
    if (accessDenied) {
      navigate({ to: '/no-access' });
    }
  }, [accessDenied, navigate]);

  if (accessDenied) return null; 
  const [newPaypoint, setNewPaypoint] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPaypoint = async () => {
    if (!newPaypoint.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(
        `/api/paypoints/${site}`,
        { name: newPaypoint },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            "X-Required-Permission": "settings",
          },
          validateStatus: () => true, // prevents Axios from throwing automatically
        }
      );

      if (response.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }

      if (response.status !== 200 && response.status !== 201) {
        console.error('Unexpected response while adding paypoint:', response);
        alert('Failed to add paypoint.');
        return;
      }

      setNewPaypoint('');
      // ✅ Refresh the route to reload data
      navigate({ to: `/settings/paypoints/${site}`, replace: true });

    } catch (error: any) {
      console.error('Error adding paypoint:', error);
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: '/no-access' });
      } else {
        alert('Error adding paypoint. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-4">Paypoints for {slugToString(site)}</h1>

      {/* Input for new paypoint */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newPaypoint}
          onChange={(e) => setNewPaypoint(e.target.value)}
          placeholder="Enter new paypoint"
          className="border border-gray-300 rounded-md p-2 flex-1"
        />
        <button
          onClick={handleAddPaypoint}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* List of paypoints */}
      <ul className="list-disc pl-5">
        {paypoints.length > 0 ? (
          paypoints.map((paypoint) => (
            <li key={paypoint._id} className="mb-2">
              {paypoint.label}
            </li>
          ))
        ) : (
          <li className="text-gray-500">No paypoints available.</li>
        )}
      </ul>
    </div>
  );
}