import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useState } from 'react'
import axios from 'axios'
import { useAuth } from "@/context/AuthContext";

// Define the route for the Settings section using TanStack Router
export const Route = createFileRoute('/_navbarLayout/settings')({
  component: RouteComponent,
})

/**
 * RouteComponent
 * Renders the Settings section with a sidebar for navigation.
 * The sidebar contains links to Pay Points, Users, and Permissions settings.
 * The main area renders the selected settings page via <Outlet />.
 */
function RouteComponent() {

  const { user } = useAuth();
  const [cacheRefreshing, setCacheRefreshing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState('');

  // Retrieve access permissions from Auth provider
  // const access = user?.access || "{}" //markpoint
  const access = user?.access || {}

  const handleRefreshCache = async () => {
    setCacheRefreshing(true);
    setCacheMessage('');
    try {
      const res = await axios.post('/api/sql/refresh-dashboard-cache', null, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      setCacheMessage(res.data.message);
    } catch (err: any) {
      setCacheMessage(err.response?.data?.error || 'Cache refresh failed');
    } finally {
      setCacheRefreshing(false);
    }
  };
  // Props to apply to the active link for highlighting
  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  }

  // Sidebar navigation links for settings
  const links = [
    // { to: '/settings/paypoints', label: 'Pay Points' },
    { to: '/settings/users', label: 'Users' },
    { to: '/settings/permissions', label: 'Permissions' },
    { to: '/settings/sites', label: 'Sites' },
    { to: '/settings/roles', label: 'Roles' },
  ]

  return (
    <div className='flex pt-5 mx-auto'>
      {/* Sidebar navigation for settings */}
      <aside className='flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end'>
        {links.map((link) => (
          <Link key={link.to} className='p-2' to={link.to} activeProps={activeProps}>
            {link.label}
          </Link>
        ))}
        {access?.settings?.maintenance && (
          <Link key='/settings/maintenance' className='p-2' to='/settings/maintenance' activeProps={activeProps}>
            Maintenance
          </Link>
        )}
        {access?.settings?.notification && (
          <Link key='/settings/notification' className='p-2' to='/settings/notification' activeProps={activeProps}>
            Notifications
          </Link>
        )}
        <div className='mt-4 pt-4 border-t border-gray-300 border-dashed w-full flex flex-col items-end'>
          <button
            onClick={handleRefreshCache}
            disabled={cacheRefreshing}
            className='p-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed'
          >
            {cacheRefreshing ? 'Refreshing...' : 'Refresh Dashboard Cache'}
          </button>
          {cacheMessage && (
            <span className='text-xs text-gray-500 mt-1 pr-2'>{cacheMessage}</span>
          )}
        </div>
      </aside>
      {/* Main content area for the selected settings page */}
      <main className='w-3/4'>
        <Outlet />
      </main>
    </div>
  )
}