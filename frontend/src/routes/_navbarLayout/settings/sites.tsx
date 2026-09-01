import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import axios from "axios"
import { MasterDetailShell } from "@/components/custom/masterDetailShell";

export const Route = createFileRoute('/_navbarLayout/settings/sites')({
  component: RouteComponent,
  loader: async () => {
    try {
      // add authorization header with bearer token
      const response = await axios.get('/api/locations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      return { locations : response.data };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { locations: [] };
    }
  },
});

interface Location {
  _id: string;
  stationName: string;
  legalName: string;
  INDNumber: string;
  kardpollCode: string;
  csoCode: string;
  timezone: string;
  email: string;
}

function RouteComponent() {
  const { locations } = Route.useLoaderData() as { locations: Location[] };
  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  };

  return (
    <MasterDetailShell
      sidebar={
        <>
          {locations.map((location) => (
            <Link
              key={location._id}
              className="p-2 w-full"
              to="/settings/sites/$id"
              params={{ id: location._id }}
              activeProps={activeProps}
            >
              {location.stationName} - {location.csoCode} - {location.INDNumber}
            </Link>
          ))}

          {/* Add New Site Button */}
          <Link
            to="/settings/sites/new"
            className="mt-4 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-300 w-full text-center"
          >
            + Add New Site
          </Link>
        </>
      }
    >
      <Outlet />
    </MasterDetailShell>
  );
}
