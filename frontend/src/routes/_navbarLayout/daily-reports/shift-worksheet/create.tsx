import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { useAuth } from "@/context/AuthContext";
import axios from "axios"

export const Route = createFileRoute(
  '/_navbarLayout/daily-reports/shift-worksheet/create',
)({
  component: RouteComponent,
  // loader: async () => {
  //   const { user } = useAuth() 
  //   const location = user?.location;
  //   if (!location) {
  //     console.error('Location not found in localStorage');
  //     return { paypoints: [] };
  //   }

  //   try {
  //     const response = await axios.get(`/api/paypoints/${location}`, {
  //       headers: {
  //         Authorization: `Bearer ${localStorage.getItem('token')}`
  //       }
  //     });
  //     const data = response.data;
  //     return { paypoints: Array.isArray(data) ? data : [] }; // Ensure data is an array
  //   } catch (error) {
  //     console.error('Error fetching paypoints:', error);
  //     return { paypoints: [] }; // Fallback to an empty array on error
  //   }
  // },
});

function RouteComponent() {
  const { user } = useAuth();
  const location = user?.location;
  const [paypoints, setPaypoints] = useState<any[]>([]);

  useEffect(() => {
    if (!location) return;

    const fetchPaypoints = async () => {
      try {
        const response = await axios.get(`/api/paypoints/${location}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        setPaypoints(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Error fetching paypoints:", err);
        setPaypoints([]);
      }
    };

    fetchPaypoints();
  }, [location]);

  const [shiftReportNumber, setShiftReportNumber] = useState('');
  const [isPM, setIsPM] = useState(false); // Default to AM (false)
  const [tillLocation, setTillLocation] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const shift = isPM ? 'PM' : 'AM'; // Determine shift based on isPM

    try {
      const response = await axios.post('/api/shift-worksheet/', {
        report_number: shiftReportNumber,
        shift,
        till_location: tillLocation,
        location: location,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          "X-Required-Permission": "dailyReports",
        }
      });

      if (response.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }

      if (response.status === 200 || response.status === 201) {
        const data = response.data;
        console.log('Shift Worksheet Created:', data);
        alert('Shift Worksheet created successfully!');
        navigate({ to: '/daily-reports/shift-worksheet' });
      } else {
        const errorData = response.data;
        console.error('Error creating Shift Worksheet:', errorData);
        alert(`Error: ${errorData.error || 'Failed to create Shift Worksheet'}`);
      }
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        navigate({ to: "/no-access" });
        return;
      }
      console.error('Error creating Shift Worksheet:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };


  return (
    <div className="flex items-center justify-center p-8">
      <div className="max-w-md w-full p-4 border border-dashed border-gray-300 rounded-md space-y-4">
        <h2 className="text-lg font-bold">Create Shift Worksheet</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shift Report Number */}
          <div>
            <label htmlFor="shiftReportNumber" className="block text-sm font-medium text-gray-700">
              Shift Report Number
            </label>
            <Input
              id="shiftReportNumber"
              type="text"
              value={shiftReportNumber}
              onChange={(e) => setShiftReportNumber(e.target.value)}
              placeholder="Enter shift report number"
              required
            />
          </div>

          {/* Shift Switch */}
          <div className="flex items-center justify-between">
            <label htmlFor="shift" className="text-sm font-medium text-gray-700">
              Shift
            </label>
            <div className="flex items-center space-x-2">
              <Switch id="shift" checked={isPM} onCheckedChange={setIsPM} />
              <span className="text-sm font-medium text-gray-700">{isPM ? 'PM' : 'AM'}</span>
            </div>
          </div>

          {/* Till Location Dropdown */}
          <div>
            <label htmlFor="tillLocation" className="block text-sm font-medium text-gray-700">
              Till Location
            </label>
            <Select onValueChange={(value) => setTillLocation(value)} defaultValue="">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Till Locations</SelectLabel>
                  {paypoints.length > 0 ? (
                    paypoints.map((paypoint) => (
                      <SelectItem key={paypoint._id} value={paypoint.label}>
                        {paypoint.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="No paypoints available." disabled>
                      No paypoints available
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={!shiftReportNumber || !tillLocation}>
            Submit
          </Button>
        </form>
      </div>
    </div>
  );
}