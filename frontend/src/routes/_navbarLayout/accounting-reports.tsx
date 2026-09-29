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
  const isArCustomerActive = matchRoute({
    to: "/accounting-reports/ar-customer-report",
  });

  const { user } = useAuth();
  const access = user?.access || {};

  const hasInfonet = Boolean(access?.accounting?.accountingReports?.infonet);
  const hasEOD = Boolean(
    access?.accounting?.accountingReports?.endOfDayReport?.value
  );
  const hasArCustomer = Boolean(
    access?.accounting?.accountingReports?.arCustomerReport
  );

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
              className={hasEOD || hasArCustomer ? "rounded-r-none" : ""}
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
              className={`
                ${hasInfonet ? "rounded-l-none" : ""} 
                ${hasArCustomer ? "rounded-r-none" : ""}
              `.trim()}
            >
              EOD Reports
            </Button>
          </Link>
        )}

        {/* A/R Customer Report tab button */}
        {hasArCustomer && (
          <Link
            to="/accounting-reports/ar-customer-report"
            activeOptions={{ exact: true }}
          >
            <Button
              {...(!isArCustomerActive && ({ variant: "outline" } as object))}
              className={hasInfonet || hasEOD ? "rounded-l-none" : ""}
            >
              A/R Customer Reports
            </Button>
          </Link>
        )}
      </div>

      {/* Render nested route content */}
      <Outlet />
    </div>
  );
}