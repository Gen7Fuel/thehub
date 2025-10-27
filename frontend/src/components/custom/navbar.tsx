import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { useEffect, useState } from 'react'
import { isTokenExpired } from '../../lib/utils'
// import { getUserFromToken, useSocket } from '@/context/SignalContext'
import { useAuth } from "@/context/AuthContext";
import { HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Navbar component for the application
export default function Navbar() {
  // Initialize navigation and route matching hooks
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  // const { socketRef } = useSocket()

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
    // if (socketRef.current?.connected) {
    //   const user = getUserFromToken();
    //   if (user) {
    //     const room = `${user.email.split("@")[0]}'s room`;
    //     socketRef.current.emit('leave-room', room);
    //     console.log('🚪 Left room:', room);
    //   }
    //   socketRef.current.disconnect();
    //   console.log('🔌 Socket disconnected');
    // } else {
    //   console.log('⚠️ No socket to disconnect');
    // }
    
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

  let module_slug = window.location.href.split('/')[3]

  let help

  // Generate help text based on module_slug
  switch (module_slug) {
    case 'cycle-count':
      help = (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Enter your count directly in the Cycle Count form.
          </p>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>Updates sync in real time for all users working on the same count.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>When finished, click <strong>Save</strong> to record your entries.</span>
            </div>
          </div>
        </div>
      )
      break
    case 'order-rec':
      help = (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            View all Order Recs with file name, upload date, uploader, item categories, and status.
          </p>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>Click an Order Rec to open its details. Categories are collapsed — tap to expand.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>Click an item row to edit <strong>On Hand Qty</strong> or <strong>Cases to Order</strong>, then Save.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>Check items as done — when all items in a category are checked, it's marked complete.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>Add notes in the text box at the top and Save to store them.</span>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-600 font-semibold">•</span>
              <span>When all categories are done, click <strong>Notify</strong> to alert the back office.</span>
            </div>
          </div>
        </div>
      )
      break
    default:
      help = 'No help available for this page.'
  }

  return (
    // Navbar container
    <div className="absolute top-0 left-0 w-full bg-white border-b border-dashed border-gray-300 z-10">
      <div className="max-w-7xl mx-auto flex justify-between items-center p-2 relative">
        {/* Logo/Home link */}
        <Link to="/">
          <span className="text-xl font-bold">The Hub</span>
        </Link>

        {/* Centered dynamic header */}
        {/* <h1 className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold">
          {headerText()}
        </h1> */}
        <h1 className="hidden md:block absolute left-1/2 transform -translate-x-1/2 text-lg font-bold">
          {headerText()}
        </h1>

        {/* Right-side navigation buttons */}
        <span className="flex gap-4">
          <Button variant="outline" size="icon" onClick={() => setIsHelpOpen(true)}>
            <HelpCircle className="h-5 w-5" />
          </Button>
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

      {/* Help Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {help}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}