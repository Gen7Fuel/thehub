import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/cash-summary/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = user?.access || {};

  useEffect(() => {
    if (!user) return;

    if (access?.accounting?.cashSummary?.form) {
      navigate({
        to: "/cash-summary/form",
        search: (prev: any) => ({ ...prev }),
      });
    } 
    else if (access?.accounting?.cashSummary?.report?.value) {
      navigate({
        to: "/cash-summary/report",
        search: (prev: any) => ({ ...prev }),
      });
    } 
    else {
      navigate({ to: "/no-access" });
    }

  }, [user]);

  return null;
}
