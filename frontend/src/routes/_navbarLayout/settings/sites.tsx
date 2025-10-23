import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import axios from "axios"

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
    <div className="flex">
      <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
        {locations.map((location) => (
          <Link
            key={location._id}
            className="p-2"
            to="/settings/sites/$id"
            params={{ id: location._id }}
            activeProps={activeProps}
          >
            {location.stationName} - {location.csoCode}
          </Link>
        ))}

        {/* Add New Site Button */}
        <Link
          to="/settings/sites/new"
          className="mt-4 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-300 w-full text-center"
        >
          + Add New Site
        </Link>
      </aside>

      <main className="w-3/4">
        <Outlet />
      </main>
    </div>
  );
}