import axios from "axios";
import { slugToString } from '@/lib/utils';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

interface ArCustomer {
  _id: string
  name: string
}

interface QuickSelectEntry {
  _id: string
  name: string
  fleetCardNumber: string
  label: string
  order: number
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'X-Required-Permission': 'po.manageQuickCustomers',
})

export const Route = createFileRoute('/_navbarLayout/settings/quick-customers/$site')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const { site } = params;
    const stationName = slugToString(site);
    try {
      const response = await axios.get('/api/ar-customers/quick-select', {
        params: { stationName },
        headers: authHeaders(),
      });

      if (response.status === 403) {
        return { entries: [], stationName, accessDenied: true };
      }

      const data = response.data;
      return { entries: Array.isArray(data) ? data : [], stationName, accessDenied: false };
    } catch (error: any) {
      console.error('Error fetching quick-select customers:', error);

      if (axios.isAxiosError(error) && error.response?.status === 403) {
        return { entries: [], stationName, accessDenied: true };
      }

      return { entries: [], stationName, accessDenied: false };
    }
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const { entries: initialEntries, stationName, accessDenied } = Route.useLoaderData() as {
    entries: QuickSelectEntry[];
    stationName: string;
    accessDenied: boolean;
  };

  useEffect(() => {
    if (accessDenied) {
      navigate({ to: '/no-access' });
    }
  }, [accessDenied, navigate]);

  const [entries, setEntries] = useState<QuickSelectEntry[]>(initialEntries);
  const [fleetCardDrafts, setFleetCardDrafts] = useState<Record<string, string>>({});
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingLabelId, setSavingLabelId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(initialEntries);
    setFleetCardDrafts(Object.fromEntries(initialEntries.map((e) => [e._id, e.fleetCardNumber || ''])));
    setLabelDrafts(Object.fromEntries(initialEntries.map((e) => [e._id, e.label || ''])));
  }, [initialEntries]);

  const refresh = async () => {
    const res = await axios.get('/api/ar-customers/quick-select', {
      params: { stationName },
      headers: authHeaders(),
    });
    if (Array.isArray(res.data)) setEntries(res.data);
  };

  // Autocomplete for adding a new quick-select customer
  const [arCustomers, setArCustomers] = useState<ArCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    axios.get('/api/ar-customers', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then((res) => {
      if (Array.isArray(res.data)) setArCustomers(res.data);
    }).catch(() => {});
  }, []);

  const existingIds = useMemo(() => new Set(entries.map((e) => e._id)), [entries]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return arCustomers
      .filter((c) => !existingIds.has(c._id) && c.name?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [search, arCustomers, existingIds]);

  const handleAdd = async (customer: ArCustomer) => {
    setAdding(true);
    setSearch('');
    setShowSuggestions(false);
    try {
      await axios.post(`/api/ar-customers/${customer._id}/quick-select`, { stationName }, {
        headers: authHeaders(),
      });
      await refresh();
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }
      alert(error?.response?.data?.error || 'Failed to add quick-select customer.');
    } finally {
      setAdding(false);
    }
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    try {
      const res = await axios.put('/api/ar-customers/quick-select/move', { stationName, id, direction }, {
        headers: authHeaders(),
      });
      if (Array.isArray(res.data)) setEntries(res.data);
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }
      alert(error?.response?.data?.error || 'Failed to reorder.');
    }
  };

  const handleRemove = async (entry: QuickSelectEntry) => {
    if (!confirm(`Remove "${entry.name}" from quick-select for ${stationName}?`)) return;
    try {
      await axios.delete(`/api/ar-customers/${entry._id}/quick-select`, {
        params: { stationName },
        headers: authHeaders(),
      });
      await refresh();
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }
      alert(error?.response?.data?.error || 'Failed to remove.');
    }
  };

  const handleSaveLabel = async (entry: QuickSelectEntry) => {
    const draft = (labelDrafts[entry._id] || '').trim();
    setSavingLabelId(entry._id);
    try {
      await axios.put(`/api/ar-customers/${entry._id}/quick-select/label`, { stationName, label: draft }, {
        headers: authHeaders(),
      });
      await refresh();
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }
      alert(error?.response?.data?.error || 'Failed to save button label.');
    } finally {
      setSavingLabelId(null);
    }
  };

  const handleSaveFleetCard = async (entry: QuickSelectEntry) => {
    const draft = (fleetCardDrafts[entry._id] || '').trim();
    if (draft && !/^\d{16}$/.test(draft)) {
      alert('Fleet card number must be exactly 16 digits, or left blank.');
      return;
    }
    setSavingId(entry._id);
    try {
      await axios.put(`/api/ar-customers/${entry._id}/fleet-card`, { fleetCardNumber: draft }, {
        headers: authHeaders(),
      });
      await refresh();
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: '/no-access' });
        return;
      }
      alert(error?.response?.data?.error || 'Failed to save fleet card number.');
    } finally {
      setSavingId(null);
    }
  };

  if (accessDenied) return null;

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-4">Quick-Select Customers for {stationName}</h1>

      <div className="relative mb-6 max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true) }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search AR customers to add..."
          disabled={adding}
          className="border border-gray-300 rounded-md p-2 w-full"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
            {suggestions.map((c) => (
              <li
                key={c._id}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                onMouseDown={() => handleAdd(c)}
              >
                {c.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No quick-select customers configured for this site.</p>
      ) : (
        <ul className="space-y-3 max-w-2xl">
          {entries.map((entry, idx) => (
            <li key={entry._id} className="flex items-center gap-3 border border-gray-200 rounded-md p-3">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleMove(entry._id, 'up')}
                  disabled={idx === 0}
                  className="text-xs px-1 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(entry._id, 'down')}
                  disabled={idx === entries.length - 1}
                  className="text-xs px-1 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>

              <div className="flex-1">
                <div className="font-medium">{entry.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={labelDrafts[entry._id] ?? ''}
                    onChange={(e) => setLabelDrafts((prev) => ({ ...prev, [entry._id]: e.target.value }))}
                    placeholder={`Button text (default: "${entry.name.trim().split(' ')[0] || entry.name}")`}
                    className="border border-gray-300 rounded-md p-1 text-sm w-64"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveLabel(entry)}
                    disabled={savingLabelId === entry._id}
                    className="bg-blue-500 text-white px-2 py-1 rounded-md text-sm disabled:opacity-50"
                  >
                    {savingLabelId === entry._id ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fleetCardDrafts[entry._id] ?? ''}
                  onChange={(e) => setFleetCardDrafts((prev) => ({ ...prev, [entry._id]: e.target.value }))}
                  placeholder="16-digit fleet card #"
                  className="border border-gray-300 rounded-md p-1 text-sm w-40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleSaveFleetCard(entry)}
                  disabled={savingId === entry._id}
                  className="bg-blue-500 text-white px-2 py-1 rounded-md text-sm disabled:opacity-50"
                >
                  {savingId === entry._id ? 'Saving...' : 'Save'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(entry)}
                className="text-red-600 text-sm px-2 py-1 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
