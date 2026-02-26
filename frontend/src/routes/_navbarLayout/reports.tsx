import { Button } from '@/components/ui/button';
import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_navbarLayout/reports')({
  component: RouteComponent,
});

function RouteComponent() {
  const matchRoute = useMatchRoute();

  const isSalesSummaryActive = matchRoute({ to: '/reports/sales-summary', fuzzy: true });
  const isOtherActive = matchRoute({ to: '/reports/other', fuzzy: true });

  return (
    <div className="p-5">
      <div className="flex flex-col items-center">
        {/* Grouped buttons */}
        <div className="flex mb-4">
          <Link to="/reports/sales-summary" activeOptions={{ exact: true }}>
            <Button
              {...(isSalesSummaryActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
              className="rounded-r-none"
            >
              Sales Summary
            </Button>
          </Link>
          <Link to="/reports/other">
            <Button
              {...(isOtherActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
              className="rounded-l-none"
            >
              Other
            </Button>
          </Link>
        </div>
        <Outlet />
      </div>
    </div>
  );
}