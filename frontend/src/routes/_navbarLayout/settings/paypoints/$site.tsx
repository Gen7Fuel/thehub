import axios from "axios";
import { slugToString } from '@/lib/utils';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_navbarLayout/settings/paypoints/$site')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { site } = params;
    try {
      // add authorization header with bearer token
      const response = await axios.get(`/api/paypoints/${site}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = response.data;
      return { paypoints: Array.isArray(data) ? data : [] }; // Ensure data is an array
    } catch (error) {
      console.error('Error fetching paypoints:', error);
      return { paypoints: [] }; // Fallback to an empty array on error
    }
  },
});

function RouteComponent() {
  const { site } = Route.useParams() as { site: string };
  const { paypoints } = Route.useLoaderData() as { paypoints: { _id: string; label: string }[] };
  const [newPaypoint, setNewPaypoint] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleAddPaypoint = async () => {
    if (!newPaypoint.trim()) return;

    setLoading(true);
    try {
      // add authorization header with bearer token
      await axios.post(`/api/paypoints/${site}`, { name: newPaypoint }, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      setNewPaypoint('');
      // Refresh the page to reload data from the loader
      navigate({ to: `/settings/paypoints/${site}`, replace: true });
    } catch (error) {
      console.error('Error adding paypoint:', error);
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