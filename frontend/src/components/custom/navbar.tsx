import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { useEffect, useState } from 'react'
import { isTokenExpired } from '../../lib/utils'
import { getDB, clearPendingActions, saveOrderRec } from "@/lib/indexedDB"
import { isActuallyOnline } from "@/lib/network";
import axios from "axios";
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
      console.log("checking for backend connectivity:",online)
      if (online) {
        console.log("Running updates")
        syncPendingActions();
      } else {
        console.warn("⚠️ Offline during periodic check — skipping sync");
      }
    }, 60 * 1000); // 1 min

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, []);



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
  const isSupport = matchRoute({ to: '/support', fuzzy: true })
  const isSafesheet = matchRoute({ to: '/safesheet', fuzzy: true })

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
    if (isSafesheet) return 'Safe Sheet'
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
  // const access = user?.access || '{}' //markpoint
  const access = user?.access || {}

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
  // async function syncPendingActions() {
  //   // const online = await isActuallyOnline();
  //   // if (!online) {
  //   //   console.warn("🚫 Not truly online — skipping sync.");
  //   //   return;
  //   // }

  //   const db = await getDB();
  //   const tx = db.transaction("pendingActions", "readonly");
  //   const actions = await tx.store.getAll();

  //   if (!actions.length) return;

  //   console.log(`🛰️ Syncing ${actions.length} pending actions...`);

  //   for (const action of actions) {
  //     try {
  //       if (action.type === "TOGGLE_ITEM") {
  //         await axios.put(
  //           `/api/order-rec/${action.orderId}/item/${action.catIdx}/${action.itemIdx}`,
  //           { completed: action.completed, isChanged: action.isChanged },
  //           { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
  //         );
  //       }

  //       // 🆕 Handle full order update (from your form)
  //       else if (action.type === "UPDATE_ORDER_REC") {
  //         const orderId = action.id;
  //         if (!orderId) {
  //           console.error("❌ Missing order ID for UPDATE_ORDER_REC");
  //           continue;
  //         }

  //         const res = await axios.put(
  //           `/api/order-rec/${orderId}`,
  //           { categories: action.payload.categories },
  //           { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
  //         );

  //         // Optional: also update local IndexedDB cache with latest synced record
  //         const orderToSave = { ...res.data, id: res.data._id || res.data.id };
  //         await saveOrderRec(orderToSave);
  //       }

  //       // Add other cases (NOTES, SAVE_ITEM, etc.)

  //     } catch (err) {
  //       console.error("⚠️ Sync failed for action:", action, err);
  //       return; // stop and retry later (same behavior)
  //     }
  //   }

  //   await clearPendingActions();
  //   console.log("✅ Sync complete — all pending actions cleared");
  // }
  async function syncPendingActions() {
    let pending;

    do {
      await new Promise(res => setTimeout(res, 300));

      const db = await getDB();
      const tx = db.transaction("pendingActions", "readonly");
      pending = await tx.store.getAll();

      if (!pending.length) break;

      console.log(`🛰️ Syncing ${pending.length} pending actions...`);
      const failed: any[] = [];

      for (const action of pending) {
        try {
          if (action.type === "TOGGLE_ITEM") {
            // 🔹 Perform backend update
            await axios.put(
              `/api/order-rec/${action.orderId}/item/${action.catIdx}/${action.itemIdx}`,
              { completed: action.completed, isChanged: action.isChanged },
              { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );

            // 🔹 Fetch the latest record from backend and cache it
            const res = await axios.get(`/api/order-rec/${action.orderId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            const latest = { ...res.data, id: res.data._id || res.data.id };
            await saveOrderRec(latest);

            console.log("✅ Synced and refreshed order record:", latest.id);
          }

          else if (action.type === "UPDATE_ORDER_REC") {
            const orderId = action.id;
            const res = await axios.put(
              `/api/order-rec/${orderId}`,
              { categories: action.payload.categories },
              { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );

            const latest = { ...res.data, id: res.data._id || res.data.id };
            await saveOrderRec(latest);
          }

          else if (action.type === "SAVE_EXTRA_NOTE") {
            // 🔹 Perform backend update
            await axios.patch(
              `/api/order-rec/${action.orderId}`,
              { extraItemsNote: action.note },
              { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );

            // 🔹 Fetch latest record from backend and cache it
            const res = await axios.get(`/api/order-rec/${action.orderId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
            });
            const latest = { ...res.data, id: res.data._id || res.data.id };
            await saveOrderRec(latest);
          }

        } catch (err) {
          console.error("⚠️ Failed syncing", action, err);
          failed.push(action);
        }
      }

      // ✅ Clear successful ones
      await clearPendingActions();

      // 🔁 Requeue failed ones
      if (failed.length) {
        const dbw = await getDB();
        const txw = dbw.transaction("pendingActions", "readwrite");
        for (const f of failed) await txw.store.add(f);
        await txw.done;
        console.warn(`🔁 ${failed.length} actions retained for retry`);
        break;
      }
    } while (pending.length > 0);

    console.log("✅ Pending sync done");
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
          {/* {access.module_dashboard && ( //markpoint */}
          {access.dashboard && (
            <Button variant="ghost" onClick={() => navigate({ to: '/dashboard' })}>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          )}
          {/* Settings button, shown if user has access */}
          {/* {access.component_settings && ( //markpoint */}
          {access.settings && ( 
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