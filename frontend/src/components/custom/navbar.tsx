import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { useEffect } from 'react'
import { isTokenExpired } from '../../lib/utils'
import { getUserFromToken, useSocket } from '@/context/SignalContext'
import { useAuth } from "@/context/AuthContext";

// Navbar component for the application
export default function Navbar() {
  // Initialize navigation and route matching hooks
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const { socketRef } = useSocket()

  // Effect: Check token expiration on mount and redirect to login if expired
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (isTokenExpired(token)) {
      // Clear sensitive data and redirect to login
      localStorage.removeItem('token');
      // localStorage.removeItem('email');
      // localStorage.removeItem('location');
      // localStorage.removeItem('access');
      navigate({ to: '/login' });
    }
  }, [navigate]);

  // Route matchers for header text and navigation highlighting
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
  const isDashboard = matchRoute({ to: '/dashboard', fuzzy: true })

  // Returns the header text based on the current route
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
    if (isDashboard) return 'Dashboard'
    return ''
  }

  // Handles user logout: disconnects from socket, clears storage and redirects to login
  const handleLogout = () => {
    // Disconnect from socket and leave room
    if (socketRef.current?.connected) {
      const user = getUserFromToken();
      if (user) {
        const room = `${user.email.split("@")[0]}'s room`;
        socketRef.current.emit('leave-room', room);
        console.log('🚪 Left room:', room);
      }
      socketRef.current.disconnect();
      console.log('🔌 Socket disconnected');
    } else {
      console.log('⚠️ No socket to disconnect');
    }
    
    // Clear all stored data
    localStorage.removeItem('token')
    // Navigate to login
    navigate({ to: '/login' })
  }

  // Handles navigation to the settings page
  const handleSettings = () => {
    navigate({ to: '/settings' })
  }

  // Get access permissions from localStorage

  const { user } = useAuth();
  console.log("Users access from navbar:", user?.access)
  const access = user?.access || '{}'

  return (
    // Navbar container
    <div className="absolute top-0 left-0 w-full bg-white border-b border-dashed border-gray-300 z-10">
      <div className="max-w-7xl mx-auto flex justify-between items-center p-2 relative">
        {/* Logo/Home link */}
        <Link to="/">
          <span className="text-xl font-bold">The Hub</span>
        </Link>

        {/* Centered dynamic header */}
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold">
          {headerText()}
        </h1>

        {/* Right-side navigation buttons */}
        <span className="flex gap-4">
          {/* Dashboard button, shown if user has access */}
          {access.module_dashboard && (
            <Button variant="ghost" onClick={() => navigate({ to: '/dashboard' })}>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          )}
          {/* Settings button, shown if user has access */}
          {access.component_settings && (
            <Button variant="outline" onClick={handleSettings}>Settings</Button>
          )}
          {/* Logout button */}
          <Button onClick={handleLogout}>Logout</Button>
        </span>
      </div>
    </div>
  );
}