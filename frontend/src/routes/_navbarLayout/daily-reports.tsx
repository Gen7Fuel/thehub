import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_navbarLayout/daily-reports')({
  component: RouteComponent,
})

function RouteComponent() {
  const matchRoute = useMatchRoute();

  const isShiftWorksheetActive = matchRoute({ to: '/daily-reports/shift-worksheet', fuzzy: true });
  const isCashSummaryActive = matchRoute({ to: '/daily-reports/cash-summary', fuzzy: true });

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Grouped buttons */}
      <div className="flex mb-4">
        <Link to="/daily-reports/shift-worksheet" activeOptions={{ exact: true }}>
          <Button
            {...(isShiftWorksheetActive ? {} : { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-r-none"
          >
            Shift Worksheet
          </Button>
        </Link>
        <Link to="/daily-reports/cash-summary" activeOptions={{ exact: true }}>
          <Button
            {...(!isCashSummaryActive && { variant: 'outline' } as object)} // Conditionally add variant
            className="rounded-l-none"
          >
            Cash Summary
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  );
}