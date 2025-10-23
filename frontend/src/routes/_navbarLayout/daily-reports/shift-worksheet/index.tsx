import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { DatePicker } from '@/components/custom/datePicker';
import { LocationPicker } from '@/components/custom/locationPicker';
import axios from "axios"
import { toUTCstring } from '@/lib/utils';
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute(
  '/_navbarLayout/daily-reports/shift-worksheet/',
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth()
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [location, setLocation] = useState<string>(user?.location || '');
  const [worksheets, setWorksheets] = useState<{ _id: string; report_number: number; shift: string; till_location: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchWorksheets = async () => {
    if (!date || !location) {
      setWorksheets([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`/api/shift-worksheet`, {
        params: {
          startDate: toUTCstring(date.toISOString().split('T')[0] + 'T00:00:00.000Z'),
          endDate: toUTCstring(date.toISOString().split('T')[0] + 'T23:59:59.999Z'),
          location,
        },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = response.data;
      setWorksheets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching shift worksheets:', error);
      setWorksheets([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when the component mounts or when `date` or `location` changes
  useEffect(() => {
    fetchWorksheets();
  }, [date, location]);

  const access = user?.access || '{}'

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-row gap-4 mb-4">
        <DatePicker date={date} setDate={setDate} />
        <LocationPicker
          setStationName={setLocation}
          value="stationName"
          {...(!access.component_po_location_filter ? { disabled: true } : {})}
        />
      </div>

      {/* Results */}
      <div>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : worksheets.length > 0 ? (
          <table className="table-auto w-full border-collapse border border-gray-300">
            <thead>
              <tr>
                <th className="border border-gray-300 px-4 py-2">Report Number</th>
                <th className="border border-gray-300 px-4 py-2">Shift</th>
                <th className="border border-gray-300 px-4 py-2">Till Location</th>
              </tr>
            </thead>
            <tbody>
              {worksheets.map((worksheet) => (
                <tr key={worksheet._id}>
                  <td className="border border-gray-300 px-4 py-2">
                    <Link
                      to="/daily-reports/shift-worksheet/$worksheet"
                      params={{ worksheet: worksheet._id }}
                      className="text-blue-500 hover:underline"
                    >
                      {worksheet.report_number}
                    </Link>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">{worksheet.shift}</td>
                  <td className="border border-gray-300 px-4 py-2">{worksheet.till_location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500">No worksheets found for the selected date and location.</p>
        )}
      </div>
      <Outlet />
    </div>
  );
}

export default RouteComponent;