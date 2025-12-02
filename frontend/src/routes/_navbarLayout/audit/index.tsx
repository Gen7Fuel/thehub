import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/audit/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = user?.access || {};

  useEffect(() => {
    if (!user) return; // wait for auth load
    if (access?.stationAudit?.checklist) {
      navigate({to: "/audit/checklist"});
    } else if (access?.stationAudit?.visitor) {
      navigate({to: "/audit/visitor"});
    } else {
      navigate({to: "/audit/interface"});
    }
  }, [user]);

  return null; // or a loader/spinner
}