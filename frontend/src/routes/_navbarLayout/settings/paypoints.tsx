import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { slugify } from '@/lib/utils';
import axios from "axios"

export const Route = createFileRoute('/_navbarLayout/settings/paypoints')({
  component: RouteComponent,
  loader: async () => {
    try {
      // add authorization header with bearer token
      const response = await axios.get('/api/locations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      return { locations: response.data };
    } catch (error) {
      console.error('Error fetching locations:', error);
      return { locations: [] };
    }
  },
});

function RouteComponent() {
  const { locations } = Route.useLoaderData() as { locations: { stationName: string }[] };

  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  };

  return (
    <div className="flex">
      <aside className="flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end">
        {locations.map((location) => (
          <Link
            key={location.stationName}
            className="p-2"
            to="/settings/paypoints/$site"
            params={{ site: slugify(location.stationName) }}
            activeProps={activeProps}
          >
            {location.stationName}
          </Link>
        ))}
      </aside>
      <main className="w-3/4">
        <Outlet />
      </main>
    </div>
  );
}