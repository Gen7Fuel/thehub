import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/_navbarLayout/accounting-reports")({
  component: RouteComponent,
});

function RouteComponent() {
  const matchRoute = useMatchRoute();

  const isInfonetActive = matchRoute({ to: "/accounting-reports/infonet" });
  const idEODActive = matchRoute({ to: "/accounting-reports/end-of-day" });

  const { user } = useAuth();
  const access = user?.access || {};

  const hasInfonet = Boolean(access?.accounting?.accountingReports?.infonet);
  const hasEOD = Boolean(access?.accounting?.accountingReports?.endOfDayReport);

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Navigation buttons */}
      <div className="flex mb-4">
        {/* Infonet tab button */}
        {hasInfonet && (
          <Link
            to="/accounting-reports/infonet"
            activeOptions={{ exact: true }}
          >
            <Button
              {...(!isInfonetActive && ({ variant: "outline" } as object))}
              className={hasEOD ? "rounded-r-none" : ""}
            >
              Infonet Reports
            </Button>
          </Link>
        )}

        {/* EOD tab button */}
        {hasEOD && (
          <Link
            to="/accounting-reports/end-of-day"
            activeOptions={{ exact: true }}
          >
            <Button
              {...(!idEODActive && ({ variant: "outline" } as object))}
              className={hasEOD && hasInfonet ? "rounded-l-none" : ""}
            >
              EOD Reports
            </Button>
          </Link>
        )}
      </div>

      {/* Render nested route content */}
      <Outlet />
    </div>
  );
}