import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/_navbarLayout/accounting-reports/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  const access = user?.access || {};

  const hasInfonet = access?.accounting?.accountingReports?.infonet;
  const hasEOD = access?.accounting?.accountingReports?.endOfDayReport;

  if (hasInfonet) {
    return <Navigate to="/accounting-reports/infonet" replace />;
  }

  if (hasEOD) {
    return <Navigate to="/accounting-reports/end-of-day" replace />;
  }

  return <Navigate to="/" replace />;
}