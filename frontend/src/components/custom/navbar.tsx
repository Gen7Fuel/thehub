import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { useEffect } from 'react'
import { isTokenExpired } from '../../lib/utils'

export default function Navbar() {
  const navigate = useNavigate() // Initialize the navigate function
  const matchRoute = useMatchRoute() // Initialize the matchRoute function

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (isTokenExpired(token)) {
      // Clear storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      localStorage.removeItem('location');
      localStorage.removeItem('access');
      navigate({ to: '/login' });
    }
  }, [navigate]);

  const isHome = matchRoute({ to: '/' })
  const isCashSummary = matchRoute({ to: '/daily-reports/cash-summary', fuzzy: true })
  const isShiftWorksheet = matchRoute({ to: '/daily-reports/shift-worksheet', fuzzy: true })
  const isPurchaseOrder = matchRoute({ to: '/po', fuzzy: true })
  const isKardpoll = matchRoute({ to: '/kardpoll', fuzzy: true })
  const isStatusSales = matchRoute({ to: '/status', fuzzy: true })
  const isReports = matchRoute({ to: '/reports', fuzzy: true })
  const isPayables = matchRoute({ to: '/payables', fuzzy: true })
  const isOrderRec = matchRoute({ to: '/order-rec', fuzzy: true })
  const isCycleCount = matchRoute({ to: '/cycle-count', fuzzy: true })
  const isVendor = matchRoute({ to: '/vendor', fuzzy: true })
  const isAudit = matchRoute({ to: '/audit', fuzzy: true })

  const headerText = () => {
    if (isHome) return 'Home'
    if (isCashSummary) return 'Cash Summary'
    if (isShiftWorksheet) return 'Shift Worksheet'
    if (isPurchaseOrder) return 'Purchase Order'
    if (isKardpoll) return 'Kardpoll'
    if (isStatusSales) return 'Status Sales'
    if (isReports) return 'Reports'
    if (isPayables) return 'Payables'
    if (isOrderRec) return 'Order Rec'
    if (isCycleCount) return 'Cycle Count'
    if (isVendor) return 'Vendor Management'
    if (isAudit) return 'Station Audits'
    return ''
  }

  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('location')
    localStorage.removeItem('access')

    // Redirect to the login page
    navigate({ to: '/login' })
  }

  const handleSettings = () => {
    // Redirect to the settings page
    navigate({ to: '/settings' })
  }

  const access = JSON.parse(localStorage.getItem('access') || '{}')

  return (
    <div className="absolute top-0 left-0 w-full bg-white border-b border-dashed border-gray-300 z-10">
      <div className="max-w-7xl mx-auto flex justify-between items-center p-2 relative">
        <Link to="/">
          <span className="text-xl font-bold">The Hub</span>
        </Link>

        {/* Centered Header */}
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold">
          {headerText()}
        </h1>

        <span className="flex gap-4">
          <span id="name" className="text-sm font-bold text-gray-600 flex items-center">
            {localStorage.getItem('name')}
          </span>
          {access.component_settings && (
            <Button variant="outline" onClick={handleSettings}>Settings</Button>
          )}
          <Button onClick={handleLogout}>Logout</Button>
        </span>
      </div>
    </div>
  );
}
