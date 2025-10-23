import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

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
  // Props to apply to the active link for highlighting
  const activeProps = {
    className: 'bg-gray-100 rounded-md',
  }

  // Sidebar navigation links for settings
  const links = [
    { to: '/settings/paypoints', label: 'Pay Points' },
    { to: '/settings/users', label: 'Users' },
    { to: '/settings/permissions', label: 'Permissions' },
    { to: '/settings/permissions-new', label: 'Permissions New' },
    { to: '/settings/sites', label: 'Sites' }
  ]

  return (
    <div className='flex pt-15 mx-auto'>
      {/* Sidebar navigation for settings */}
      <aside className='flex flex-col w-1/4 p-4 border-r border-gray-300 border-dashed justify-start items-end'>
        {links.map((link) => (
          <Link key={link.to} className='p-2' to={link.to} activeProps={activeProps}>
            {link.label}
          </Link>
        ))}
      </aside>
      {/* Main content area for the selected settings page */}
      <main className='w-3/4'>
        <Outlet />
      </main>
    </div>
  )
}