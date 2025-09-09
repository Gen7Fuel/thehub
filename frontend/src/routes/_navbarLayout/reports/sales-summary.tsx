import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_navbarLayout/reports/sales-summary')({
  component: RouteComponent,
});

function RouteComponent() {
  const matchRoute = useMatchRoute();

  const isUploadActive = matchRoute({ to: '/reports/sales-summary/upload' });
  const isReportActive = matchRoute({ to: '/reports/sales-summary' });

  return (
    <div className="flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        <Link to="/reports/sales-summary/upload" activeOptions={{ exact: true }}>
          <Button
            {...(isUploadActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Upload
          </Button>
        </Link>
        <Link to="/reports/sales-summary">
          <Button
            {...(isReportActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-l-none"
          >
            Report
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  );
}