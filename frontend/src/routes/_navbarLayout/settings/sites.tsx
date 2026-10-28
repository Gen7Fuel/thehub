import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { MasterDetailShell } from "@/components/custom/masterDetailShell";
import { siteQueries } from '@/api/sites/sites.queries';
import type { Site } from '@/api/sites/sites.types';

export const Route = createFileRoute('/_navbarLayout/settings/sites')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      const locations = await context.queryClient.ensureQueryData(siteQueries.list());
      return { locations };
    } catch (error) {
      console.error('Error fetching users:', error);
      return { locations: [] };
    }
  },
});

function RouteComponent() {
  const { locations } = Route.useLoaderData() as { locations: Site[] };
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
