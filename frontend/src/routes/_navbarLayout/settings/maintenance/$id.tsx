import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, FileText, Save } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/settings/maintenance/$id')({
  component: EditMaintenance,
})

function EditMaintenance() {
  const { id } = useParams({ from: '/_navbarLayout/settings/maintenance/$id' });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scheduleStart: '',
    scheduleClose: '',
  });

  // Helper to convert DB ISO UTC string to local datetime-local input format
  const formatToLocalInput = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
  };

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const res = await axios.get(`/api/maintenance/${id}`, {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'X-Required-Permission': 'settings.maintenance' 
          }
        });
        
        setFormData({
          name: res.data.name,
          description: res.data.description,
          scheduleStart: formatToLocalInput(res.data.scheduleStart),
          scheduleClose: formatToLocalInput(res.data.scheduleClose),
        });
      } catch (err) {
        console.error("Fetch error", err);
        alert("Could not load maintenance details.");
      } finally {
        setFetching(false);
      }
    };
    fetchExisting();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        // Convert back to UTC ISO for the database
        scheduleStart: new Date(formData.scheduleStart).toISOString(),
        scheduleClose: new Date(formData.scheduleClose).toISOString(),
      };

      await axios.put(`/api/maintenance/${id}`, payload, {
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Required-Permission': 'settings.maintenance' 
        }
      });
      
      navigate({ to: '/settings/maintenance/' });
    } catch (err) {
      console.error("Update error", err);
      alert("Error updating schedule.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="p-8 text-center text-gray-500">Loading schedule data...</div>;

  return (
    <div className="w-full p-8 max-w-4xl mx-auto">
      <button 
        onClick={() => navigate({ to: '/settings/maintenance/' })}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft size={20} className="mr-2" /> Back to List
      </button>

      <div className="bg-white border rounded-xl shadow-sm p-8">
        <div className="flex justify-between items-start mb-8 border-b pb-4">
          <div>
            <h2 className="text-2xl font-bold">Edit Maintenance</h2>
            <p className="text-gray-500">Update the details or timing for this window.</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            ID: {id}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <FileText size={16} /> Maintenance Name
            </label>
            <input
              required
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          {/* Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} /> Start Date & Time
              </label>
              <input
                required
                type="datetime-local"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.scheduleStart}
                onChange={(e) => setFormData({...formData, scheduleStart: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} /> Expected End Date & Time
              </label>
              <input
                required
                type="datetime-local"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.scheduleClose}
                onChange={(e) => setFormData({...formData, scheduleClose: e.target.value})}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Detailed Description</label>
            <textarea
              required
              rows={4}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button 
              type="submit" 
              className="px-8 bg-blue-600 hover:bg-blue-700 text-white flex gap-2"
              disabled={loading}
            >
              <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate({ to: '/settings/maintenance/' })}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}