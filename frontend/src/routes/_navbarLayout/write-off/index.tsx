import { useAuth } from '@/context/AuthContext';
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react';

export const Route = createFileRoute('/_navbarLayout/write-off/')({
  component: RouteComponent,
})

function RouteComponent() {
    const navigate = useNavigate();
    const { user } = useAuth();
  
    // Redirect to /cycle-count/count on mount
    useEffect(() => {
      if (user?.access?.writeOff?.create) {
        navigate({ to: "/write-off/create" });
      } else if (user?.access?.writeOff?.requests) {
        navigate({ to: "/write-off/requests" });
      } else {
        navigate({ to: "/no-access" }); // Redirect to home or an appropriate page if no access
      }
    }, [navigate]);
  
    // The rest of the component is not needed
    return null;
}
