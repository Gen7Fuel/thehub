import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute(
  '/_navbarLayout/daily-reports/shift-worksheet',
)({
  component: RouteComponent,
});

function RouteComponent() {
  const matchRoute = useMatchRoute();

  const isCreateActive = matchRoute({ to: '/daily-reports/shift-worksheet/create' });
  const isListActive = matchRoute({ to: '/daily-reports/shift-worksheet' });

  return (
    <div className="flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        <Link to="/daily-reports/shift-worksheet/create" activeOptions={{ exact: true }}>
          <Button
            {...(isCreateActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Create
          </Button>
        </Link>
        <Link to="/daily-reports/shift-worksheet" activeOptions={{ exact: true }}>
          <Button
            {...(!isListActive && { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-l-none"
          >
            List
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  );
}