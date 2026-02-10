import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, ChevronDown, ChevronUp, Clock, User } from 'lucide-react'
import { Button } from "@/components/ui/button" // Assuming you use a UI library
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute('/_navbarLayout/settings/maintenance/')({
  component: RouteComponent,
})

export interface IMaintenance {
  _id: string;
  name: string;
  description: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

  // Dates stored as strings from JSON response
  scheduleStart: string;
  scheduleClose: string;
  actualStart?: string;
  actualEnd?: string;

  // Populated User Fields
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  startedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  closedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };

  notificationSent: boolean;
  createdAt: string;
  updatedAt: string;
}

function RouteComponent() {
  const navigate = useNavigate();
  const [maintenanceList, setMaintenanceList] = useState<IMaintenance[]>([]);
  const [filter, setFilter] = useState('scheduled'); // scheduled, ongoing, completed
  const [openId, setOpenId] = useState<string | null>(null);
  const statuses = ['scheduled', 'ongoing', 'completed', 'cancelled'];

  useEffect(() => {
    fetchMaintenance();
  }, []);

  const fetchMaintenance = async () => {
    try {
      const response = await axios.get('/api/maintenance', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'settings.maintenance'
        }
      });
      // Map the response to include an open state for accordion logic if needed locally
      setMaintenanceList(response.data);
    } catch (err) {
      console.error("Failed to fetch maintenance", err);
    }
  };

  const filteredList = maintenanceList.filter(item => item.status === filter);

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  // const formatDate = (date: string) => new Date(date).toLocaleString();
  // This helper correctly converts the UTC DB string back to User's Local Time
  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartMaintenance = async (id: string) => {
    if (!window.confirm("Are you sure you want to start this maintenance? The app will become inaccessible to all users immediately.")) return;
    try {
      await axios.put(`/api/maintenance/${id}`, {
        status: 'ongoing'
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'X-Required-Permission': 'settings.maintenance' }
      });
      fetchMaintenance(); // Refresh the list
    } catch (err) {
      alert("Failed to start maintenance.");
    }
  };

  const handleEndMaintenance = async (id: string) => {
    if (!window.confirm("Are you sure you want to end this maintenance early? The app will become accessible to all users immediately.")) return;

    try {
      await axios.put(`/api/maintenance/${id}`, {
        status: 'completed'
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'X-Required-Permission': 'settings.maintenance' }
      });
      fetchMaintenance(); // Refresh the list
    } catch (err) {
      alert("Failed to end maintenance.");
    }
  };

  const handleNotifyUsers = async (id: string) => {
    if (!window.confirm("Send maintenance notification emails to all active users?")) return;
    try {
      await axios.post(`/api/maintenance/${id}/notify`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'X-Required-Permission': 'settings.maintenance' }
      });
      alert("Notification emails have been queued.");
      fetchMaintenance();
    } catch (err) {
      alert("Failed to send notifications.");
    }
  };

  const handleCancelMaintenance = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this maintenance? Users will be notified via email.")) return;
    try {
      await axios.post(`/api/maintenance/${id}/cancel`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'X-Required-Permission': 'settings.maintenance'
        }
      });
      alert("Maintenance cancelled and users notified.");
      fetchMaintenance();
    } catch (err) {
      alert("Failed to cancel maintenance.");
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-60px)] p-8">
      <div className="max-w-6xl mx-auto">

        {/* Header Section: Title and Button side-by-side */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Schedule Maintenance</h1>
            <p className="text-gray-500 text-sm">Manage application downtime and notifications.</p>
          </div>

          <Button
            onClick={() => navigate({ to: '/settings/maintenance/create' })}
            className="flex gap-2 items-center bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus size={18} /> Schedule New
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md capitalize transition-all ${filter === status
                ? 'bg-white shadow-sm text-blue-600 font-semibold'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Maintenance Accordion List */}
        <div className="space-y-4">
          {filteredList.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed rounded-lg text-gray-400">
              No {filter} maintenance records found.
            </div>
          ) : (
            filteredList.map((item) => (
              <div key={item._id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
                {/* Accordion Header */}
                <button
                  onClick={() => toggleAccordion(item._id)}
                  className="w-full px-5 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-bold text-gray-700 text-lg">{item.name}</span>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Clock size={14} /> {formatDate(item.scheduleStart)} — {formatDate(item.scheduleClose)}</span>
                      <span className="flex items-center gap-1"><User size={14} /> {item.createdBy?.firstName} {item.createdBy?.lastName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge
                      className={`
                      ${item.status === 'ongoing' ? 'bg-red-500 hover:bg-red-600' : ''}
                      ${item.status === 'scheduled' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                      ${item.status === 'completed' ? 'bg-green-600 hover:bg-green-700' : ''}
                      ${item.status === 'cancelled' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                      capitalize text-white border-none
                    `}
                    >
                      {item.status}
                    </Badge>
                    {openId === item._id ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </button>

                {/* Accordion Content */}
                {openId === item._id && (
                  <div className="p-6 border-t bg-white animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left Column: Details */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold uppercase text-gray-400">Description</label>
                          <p className="mt-1 text-gray-700 leading-relaxed">{item.description}</p>
                        </div>
                        <div className="flex gap-10">
                          <div>
                            <label className="text-xs font-bold uppercase text-gray-400">Email Triggered</label>
                            <p className={`mt-1 font-medium ${item.notificationSent ? 'text-green-600' : 'text-orange-500'}`}>
                              {item.notificationSent ? '✓ Sent to Users' : '○ Pending'}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase text-gray-400">System Wide</label>
                            <p className="mt-1 text-gray-700">Yes</p>
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Timestamps/Audit */}
                      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                        <h4 className="font-semibold text-sm border-b pb-2 mb-2">Execution Logs</h4>
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Actual Start:</span>
                            <span className="font-mono">{item.actualStart ? formatDate(item.actualStart) : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Started By:</span>
                            <span>{item.startedBy ? `${item.startedBy.firstName}` : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Actual End:</span>
                            <span className="font-mono">{item.actualEnd ? formatDate(item.actualEnd) : '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ended By:</span>
                            <span>{item.closedBy ? `${item.closedBy.firstName}` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 pt-4 border-t flex gap-3">
                      {item.status === 'ongoing' && (
                        <Button
                          variant="destructive"
                          onClick={() => handleEndMaintenance(item._id)}
                        >
                          End Maintenance Now
                        </Button>
                      )}
                      {item.status === 'scheduled' && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => navigate({ to: `/settings/maintenance/${item._id}` })}
                          >
                            Edit Schedule
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleStartMaintenance(item._id)}
                          >
                            Start Maintenance Now
                          </Button>
                        </>
                      )}
                      {item.status === 'scheduled' && !item.notificationSent && (
                        <Button
                          variant="outline"
                          className="border-orange-500 text-orange-600 hover:bg-orange-50"
                          onClick={() => handleNotifyUsers(item._id)}
                        >
                          📧 Notify Users
                        </Button>
                      )}
                      {item.status === 'scheduled' && (
                        <Button
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleCancelMaintenance(item._id)}
                        >
                          Cancel Schedule
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}