import { useAuth } from '@/context/AuthContext';
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react';

export const Route = createFileRoute('/_navbarLayout/write-off/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Determine the path
    let targetPath = "/no-access";
    if (user?.access?.writeOff?.create) targetPath = "/write-off/create";
    else if (user?.access?.writeOff?.requests) targetPath = "/write-off/requests";

    // Navigate and preserve user location if possible
    navigate({
      to: targetPath,
      search: user?.location ? { site: user.location } : undefined
    });
  }, [user, navigate]);

  return null;
}
