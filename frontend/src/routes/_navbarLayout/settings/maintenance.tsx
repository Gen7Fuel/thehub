import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/_navbarLayout/settings/maintenance')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: '/settings/maintenance/' });
  }, [navigate]);

  return (
    <div className="flex">
      {/* Content area (show details or form) */}
      <main className='flex-1 min-h-screen bg-gray-50'>
        <Outlet />
      </main>
    </div>
  )
}
