import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import axios from 'axios'
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, FileText } from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/settings/maintenance/create')({
  component: CreateMaintenance,
})

function CreateMaintenance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scheduleStart: '',
    scheduleClose: '',
  });

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   try {
  //     await axios.post('/api/maintenance', formData, {
  //       headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  //       'X-Required-Permission': 'settings.maintenance' }
  //     });
  //     navigate({ to: '/settings/maintenance/' });
  //   } catch (err) {
  //     console.error("Save error", err);
  //     alert("Error creating schedule. Check console.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert the local datetime-local strings to actual Date objects
      // Then convert them to ISO strings (which are always UTC)
      const payload = {
        ...formData,
        scheduleStart: new Date(formData.scheduleStart).toISOString(),
        scheduleClose: new Date(formData.scheduleClose).toISOString(),
      };

      await axios.post('/api/maintenance', payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'settings.maintenance'
        }
      });

      navigate({ to: '/settings/maintenance/' });
    } catch (err) {
      console.error("Save error", err);
      alert("Error creating schedule.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate({ to: '/settings/maintenance/' })}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft size={20} className="mr-2" /> Back to List
      </button>

      <div className="bg-white border rounded-xl shadow-sm p-8">
        <h2 className="text-2xl font-bold mb-2">Schedule Maintenance</h2>
        <p className="text-gray-500 mb-8 border-b pb-4">Set up a new downtime window.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-2">
              <FileText size={16} /> Maintenance Name
            </label>
            <input
              required
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g., Monthly Database Optimization (This will be included in the notification emails)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} /> Start Date & Time (LocalTime)
              </label>
              <input
                required
                type="datetime-local"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.scheduleStart}
                onChange={(e) => setFormData({ ...formData, scheduleStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} /> Expected End Date & Time (LocalTime)
              </label>
              <input
                required
                type="datetime-local"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.scheduleClose}
                onChange={(e) => setFormData({ ...formData, scheduleClose: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Detailed Description</label>
            <textarea
              required
              rows={4}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Describe what will be affected...(This description will be included in the notification emails)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Once saved, this maintenance window will appear as a banner for all users 24 hours prior to start. Notifications can be sent out via emails to all users from the List Page.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="px-8 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Schedule'}
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