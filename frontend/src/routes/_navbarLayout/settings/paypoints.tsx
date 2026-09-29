import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { slugify } from '@/lib/utils';
import axios from "axios"
import { MasterDetailShell } from "@/components/custom/masterDetailShell";

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
    <MasterDetailShell
      sidebar={
        <>
          {locations.map((location) => (
            <Link
              key={location.stationName}
              className="p-2 w-full"
              to="/settings/paypoints/$site"
              params={{ site: slugify(location.stationName) }}
              activeProps={activeProps}
            >
              {location.stationName}
            </Link>
          ))}
        </>
      }
    >
      <Outlet />
    </MasterDetailShell>
  );
}