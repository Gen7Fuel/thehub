import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { slugify } from '@/lib/utils';
import { MasterDetailShell } from "@/components/custom/masterDetailShell";
import { quickCustomerQueries } from '@/api/quick-customers/quick-customers.queries';

export const Route = createFileRoute('/_navbarLayout/settings/quick-customers')({
  component: RouteComponent,
  loader: async ({ context }) => {
    try {
      return { locations: await context.queryClient.ensureQueryData(quickCustomerQueries.sites()) };
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
              to="/settings/quick-customers/$site"
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
