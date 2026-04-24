import { Link, useLocation, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { useCallback, useEffect, useState } from 'react'
import { isTokenExpired } from '../../lib/utils'
import axios from 'axios'
import { getSocket } from "@/lib/websocket";
import { syncPendingActions } from "@/lib/utils"
import { isActuallyOnline } from "@/lib/network";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, HelpCircle, LogOut, Settings as SettingsIcon, LayoutDashboard, Home as HomeIcon, KeyRound, ExternalLink, Bell } from 'lucide-react'
import { clearLocalDB } from "@/lib/orderRecIndexedDB";
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
  const [forceLogoutMessage, setForceLogoutMessage] = useState<string | null>(null);
  // Inside your Navbar Component
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/notification', {
          headers: { Authorization: `Bearer ${token || ''}` }
        });
        // Count only unread items from the list
        const count = res.data.filter((n: any) => !n.isRead && n.status !== 'archived').length;
        setUnreadCount(count);
      } catch (err) {
        console.error("Error fetching unread count", err);
      }
    };

    fetchUnreadCount();

    // Listen for the 'notificationRead' event from the Notification Page
    const handleRead = () => {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    window.addEventListener('notificationRead', handleRead);
    return () => window.removeEventListener('notificationRead', handleRead);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (isTokenExpired(token)) {
      // Call backend logout so is_loggedIn becomes false
      if (token) {
        axios.post("/api/auth/logout", {}, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => {
          console.warn("Logout API failed:", err);
        });
      }

      // Clear token locally
      localStorage.removeItem('token');


      // Clear IndexedDB
      clearLocalDB();

      alert("Your session has expired. Please log in again.");
      // Redirect
      navigate({ to: '/login' });
    }
  }, [navigate]);



  // checking for api health and syncing db once in online mode every 1 mins
  useEffect(() => {
    // 1️⃣ Sync when back online
    const handleOnline = async () => {
      const online = await isActuallyOnline();
      if (online) {
        console.log("🌐 Online — attempting background sync...");
        syncPendingActions();
      } else {
        console.warn("⚠️ Still offline — skipping sync");
      }
    };

    window.addEventListener("online", handleOnline);

    // Also sync every 1 minute if actually online
    const interval = setInterval(async () => {
      const online = await isActuallyOnline();
      console.log("checking for backend connectivity:", online)
      if (online) {
        console.log("Running updates")
        syncPendingActions();
      } else {
        console.warn("⚠️ Offline during periodic check — skipping sync");
      }
    }, 15 * 1000); // 15 sec

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, []);



  // Route matchers for header text and navigation highlighting
  const isHome = matchRoute({ to: '/' })
  const isCashSummary = matchRoute({ to: '/cash-summary', fuzzy: true })
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
  const isSupport = matchRoute({ to: '/support', fuzzy: true })
  const isSafesheet = matchRoute({ to: '/safesheet', fuzzy: true })
  const isCashRec = matchRoute({ to: '/cash-rec', fuzzy: true })
  const isFuelRec = matchRoute({ to: '/fuel-rec', fuzzy: true })

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
    if (isSupport) return 'Support'
    if (isSafesheet) return 'Safesheet'
    if (isCashRec) return 'Cash Rec'
    if (isFuelRec) return 'Fuel Rec'
    return ''
  }

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");

      if (token) {
        await axios.post("/api/auth/logout", {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      // don't block logout if server fails
      console.warn("Logout API failed:", err);
    }

    // Same as before
    localStorage.removeItem('token');
    clearLocalDB();
    navigate({ to: '/login' });
  }

  // Handles navigation to the settings page
  const handleSettings = () => {
    navigate({ to: '/settings' })
  }

  const handlePasswordReset = () => {
    navigate({ to: '/reset-password' })
  }

  // Get access permissions from localStorage

  const { user, refreshTokenFromBackend } = useAuth();
  // Retrieve access permissions from auth provider
  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {}
  const handlePermissionsUpdated = async () => {
    // console.log("Permissions update received via socket");
    // console.log("Before update:",localStorage.getItem('token'));
    await refreshTokenFromBackend();
    // console.log("After update:",localStorage.getItem('token'));
  };

  // 1. Function to fetch the actual count from the server
  const refreshUnreadCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      // Note: I recommend a generic "all unread" count for the Bell icon 
      // vs the "since last login" count for the Popup.
      const res = await axios.get('/api/notification/unread-count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(res.data.count);
    } catch (err) {
      console.error("Error syncing count", err);
    }
  }, []);

  // 2. Initial load and Event Listener
  useEffect(() => {
    refreshUnreadCount();

    // Listen for the "Read" event from the Notification Page
    window.addEventListener('notificationRead', refreshUnreadCount);

    return () => window.removeEventListener('notificationRead', refreshUnreadCount);
  }, [refreshUnreadCount]);

  // useEffect(() => {
  //   const socket = getSocket();

  //   // Define the handler for new notifications
  //   const handleNewNotification = () => {
  //     console.log("🔔 Socket: New notification received");
  //     refreshUnreadCount();
  //   };

  //   socket.on("connect", () => {
  //     if (user?.id) {
  //       socket.emit("join-room", user?.id);
  //     }
  //     // console.log("socket from auth ", socket.id);
  //   });
  //   // console.log("Listeners now:", socket.listeners("permissions-updated"));

  //   // Add the notification listener
  //   socket.on("new-notification", handleNewNotification);

  //   socket.on("permissions-updated", handlePermissionsUpdated);

  //   // socket.on("force-logout", (data) => {
  //   //   alert(data.message || "You have been logged out by an admin.");

  //   //   localStorage.removeItem("token");
  //   //   clearLocalDB();

  //   //   navigate({ to: "/login" });
  //   // });
  //   socket.on("force-logout", (data) => {
  //     setForceLogoutMessage(data.message || "You have been logged out by an admin.");
  //   });


  //   return () => {
  //     socket.off("permissions-updated", handlePermissionsUpdated);
  //     socket.off("force-logout");
  //     socket.off("new-notification", handleNewNotification);
  //   };
  // }, [user])

  useEffect(() => {
    const socket = getSocket();

    const joinRoom = () => {
      if (user?.id) {
        console.log("📤 Emitting join-room for:", user.id);
        socket.emit("join-room", user.id);
      }
    };

    // 1. If already connected, join immediately
    if (socket.connected) {
      joinRoom();
    }

    // 2. Also listen for the connect event (for refreshes/reconnects)
    socket.on("connect", joinRoom);

    const handleNewNotification = () => {
      refreshUnreadCount();
    };

    socket.on("new-notification", handleNewNotification);
    socket.on("permissions-updated", handlePermissionsUpdated);
    socket.on("force-logout", (data) => {
      setForceLogoutMessage(data.message || "You have been logged out by an admin.");
    });

    return () => {
      socket.off("connect", joinRoom);
      socket.off("permissions-updated", handlePermissionsUpdated);
      socket.off("force-logout");
      socket.off("new-notification", handleNewNotification);
    };
  }, [user]); // Re-run when user changes

  useEffect(() => {
    if (forceLogoutMessage) {
      const timer = setTimeout(() => {
        // Perform logout actions
        localStorage.removeItem("token");
        clearLocalDB();
        navigate({ to: "/login" });
      }, 3000); // 3 seconds delay

      return () => clearTimeout(timer);
    }
  }, [forceLogoutMessage]);

  // 1. Define base URL
  const DOCS_BASE_URL = "https://docs.gen7fuel.com/share";

  // 1. TanStack's hook (e.g., "/infonet-report")
  const location = useLocation();

  // 2. Extract the module slug from the URL (e.g., "infonet-report")
  const module_slug = location.pathname.split('/').filter(Boolean)[0] || '';

  const getDocContent = (slug: string) => {
    switch (slug) {
      case 'audit':
        return { title: 'Station Audits', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/station-audits-22uoVYgRfG` };
      case 'po':
        return { title: 'Purchase Orders', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/purchase-order-Jjf8hbmjcT` };
      case 'payables':
        return { title: 'Payables & Payouts', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/payables-and-payouts-zlNABR1hBI` };
      case 'cash-summary':
        return { title: 'Cash Summary', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/cash-summary-Sm6CWBVpgi` };
      case 'safesheet':
        return { title: 'Safesheet Guide', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/safesheet-NasYIFjhzC` };
      case 'cash-rec':
        return { title: 'Cash Reconciliation', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/cash-rec-eUeiKLLjg6` };
      case 'fuel-rec':
        return { title: 'Fuel Reconciliation', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/fuel-rec-Z4kivBO3Tg` };
      case 'order-rec':
        return { title: 'Order Reconciliation', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/order-rec-5985gQP73S` };
      case 'cycle-count':
        return { title: 'Cycle Counting', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/cycle-count-psiNrrRMeS` };
      case 'vendor':
        return { title: 'Vendor Management', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/vendor-management-xXFLPVRW5c` };
      case 'category':
        return { title: 'Category Management', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/category-management-G7GY640Yrd` };
      case 'write-off':
        return { title: 'Write-offs & Markdowns', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/write-offs-and-markdowns-jqHcm9CCbD` };
      case 'infonet-report':
        return { title: 'Infonet Tax Report', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/infonet-tax-report-bNWL7qOUTA` };
      case 'fuel-management':
        return { title: 'Fuel Management', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/fuel-management-6Ag4MFLA2U` };
      case 'dashboard':
        return { title: 'Dashboard', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/dashboard-pjDseu6OE6` };
      default:
        return { title: 'The Hub User Guide', url: `${DOCS_BASE_URL}/9b0j5ary4m/p/the-hub-user-guide-JX89JyLv77` };
    }
  };

  const { title, url } = getDocContent(module_slug);

  return (
    // Navbar container
    <div className="sticky top-0 left-0 w-full bg-white border-b border-dashed border-gray-300 z-10">
      <div className="max-w-7xl mx-auto flex justify-between items-center p-2 relative">
        {/* Logo/Home link */}
        <Link to="/">
          <HomeIcon className="h-6 w-6 md:hidden" />
          <span className="hidden md:inline text-xl font-bold">The Hub</span>
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
          {/* Notification Button */}
          {access?.notification?.value && (
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => navigate({ to: '/notification' })}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-medium text-white">
                  {unreadCount}
                </span>
              )}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => setIsHelpOpen(true)}>
            <HelpCircle className="h-5 w-5" />
          </Button>
          {/* Dashboard button, shown if user has access */}
          {/* {access.module_dashboard && ( //markpoint */}
          {access?.academy && (
            <Button variant="outline" onClick={() => navigate({ to: '/academy' })}>
              <GraduationCap className="h-5 w-5 md:hidden" />
              <span className="hidden md:inline">Academy</span>
            </Button>
          )}
          {access?.dashboard && (
            <Button variant="outline" onClick={() => navigate({ to: '/dashboard' })}>
              <LayoutDashboard className="h-5 w-5 md:hidden" />
              <span className="hidden md:inline">Dashboard</span>
            </Button>
          )}
          {/* Settings button, shown if user has access */}
          {/* {access.component_settings && ( //markpoint */}
          {access?.settings?.value && (
            <Button variant="outline" onClick={handleSettings}>
              <SettingsIcon className="h-5 w-5" />
            </Button>
          )}
          {/* Reset Password Button */}
          {access?.passwordReset && (
            <Button variant="outline" title="Reset Password" onClick={handlePasswordReset}>
              <KeyRound className="h-5 w-5" />
            </Button>
          )}
          {/* Logout button */}
          <Button onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </span>
      </div>
      {/* Help Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
          <DialogHeader className="p-4 border-b bg-gray-50 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
            </div>

            {/* Optional: Open in New Tab Button */}
            <Button
              variant="ghost"
              size="sm"
              className="mr-6 hidden md:flex items-center gap-2 text-gray-500 hover:text-gray-900"
              onClick={() => window.open(url, '_blank')}
            >
              <span className="text-xs">Open in New Tab</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <div className="flex-1 w-full bg-white relative">
            {/* The Iframe Implementation */}
            <iframe
              src={url}
              title={title}
              className="w-full h-full border-none"
              loading="lazy"
              // Ensure "allow-forms" is added if your docs have search bars/contact forms
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* Render logout modal */}
      {forceLogoutMessage && (
        <Dialog open={!!forceLogoutMessage} onOpenChange={() => { /* do nothing */ }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Logged Out</DialogTitle>
            </DialogHeader>
            <p>{forceLogoutMessage}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}