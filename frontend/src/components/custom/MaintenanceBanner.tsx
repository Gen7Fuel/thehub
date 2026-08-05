import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { getSocket } from "@/lib/websocket";
import { useAuth } from "@/context/AuthContext";
import { ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";

interface MaintenanceBannerProps {
  onStatusChange?: (isLocked: boolean, details?: any) => void;
}

export default function MaintenanceBanner({ onStatusChange }: MaintenanceBannerProps) {
  const [activeMaintenance, setActiveMaintenance] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const { user } = useAuth();

  // const checkMaintenance = useCallback(async () => {
  //   try {
  //     const token = localStorage.getItem('token');
  //     if (!token) {
  //       setActiveMaintenance(null);
  //       onStatusChange?.(false);
  //       return;
  //     }

  //     const { data } = await axios.get('/api/maintenance', {
  //       headers: { Authorization: `Bearer ${token}` }
  //     });

  //     const now = new Date();
  //     const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  //     const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  //     const potentialMaintenances = data.filter((m: any) => {
  //       if (m.status === 'ongoing') return true;
  //       if (m.status === 'completed' && m.actualEnd) {
  //         return new Date(m.actualEnd) > oneHourAgo;
  //       }
  //       if (m.status === 'cancelled') {
  //         const updatedAt = new Date(m.updatedAt);
  //         const startDate = new Date(m.scheduleStart);
  //         return updatedAt > oneHourAgo && (startDate <= twentyFourHoursFromNow || m.notificationSent === true);
  //       }
  //       if (m.status === 'scheduled') {
  //         const startDate = new Date(m.scheduleStart);
  //         return startDate > now && startDate <= twentyFourHoursFromNow;
  //       }
  //       return false;
  //     });

  //     const sorted = potentialMaintenances.sort((a: any, b: any) => {
  //       const priority: Record<string, number> = { ongoing: 1, scheduled: 2, completed: 3, cancelled: 4 };
  //       if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
  //       return new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime();
  //     });

  //     const topPriority = sorted[0] || null;
  //     setActiveMaintenance(topPriority);

  //     // --- LOCKDOWN & BYPASS LOGIC ---
  //     // if (topPriority?.status === 'ongoing') {
  //     //   // Store beacon for resilience (as discussed)
  //     //   localStorage.setItem('hub_maint_beacon', topPriority.scheduleClose);

  //     //   // Check permission: settings -> maintenance
  //     //   const canBypass = user?.access?.settings?.maintenance === true;

  //     //   if (canBypass) {
  //     //     onStatusChange?.(false); // Admin: show banner but NO overlay
  //     //   } else {
  //     //     onStatusChange?.(true, topPriority); // Regular User: Show overlay
  //     //   }
  //     // } else {
  //     //   localStorage.removeItem('hub_maint_beacon');
  //     //   onStatusChange?.(false);
  //     // }

  //     // --- LOCKDOWN & BYPASS LOGIC ---
  //     if (topPriority?.status === 'ongoing') {
  //       const canBypass = user?.access?.settings?.maintenance === true;

  //       if (canBypass) {
  //         // Admin: Store privileged flag, remove regular lock
  //         localStorage.setItem('hub_maint_privileged', 'admin');
  //         localStorage.removeItem('hub_maint_beacon');
  //         onStatusChange?.(false);
  //       } else {
  //         // Regular User: Store regular lock, remove privileged flag (safety)
  //         localStorage.setItem('hub_maint_beacon', topPriority.scheduleClose);
  //         localStorage.removeItem('hub_maint_privileged');
  //         onStatusChange?.(true, topPriority);
  //       }
  //     } else {
  //       // Clear everything when maintenance is officially over
  //       localStorage.removeItem('hub_maint_beacon');
  //       localStorage.removeItem('hub_maint_privileged');
  //       onStatusChange?.(false);
  //     }
  //   } catch (err: any) {
  //     console.error("Banner fetch error:", err);

  //     // === RESET STATE ON ANY ERROR (Auth, Network, Timeout, etc.) ===
  //     setActiveMaintenance(null);
  //     localStorage.removeItem('hub_maint_beacon');
  //     localStorage.removeItem('hub_maint_privileged');
  //     onStatusChange?.(false);

  //     // === STRICT 503 CHECK: Only trigger lockdown if server explicitly returns 503 Maintenance ===
  //     if (err.response?.status === 503) {
  //       const maintData = err.response.data;
  //       localStorage.setItem('hub_maint_beacon', maintData.endTime);
  //       const ongoingDetails = {
  //         status: 'ongoing',
  //         scheduleClose: maintData.endTime
  //       };
  //       setActiveMaintenance(ongoingDetails);
  //       onStatusChange?.(true, ongoingDetails);
  //     }
  //   }
  // }, [user, onStatusChange]);

  const checkMaintenance = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setActiveMaintenance(null);
      onStatusChange?.(false);
      return;
    }

    // Helper to process ongoing status for regular user vs admin
    const applyLockdownLogic = (maintData: any) => {
      // Check permission from user token / context
      const canBypass = user?.access?.settings?.maintenance === true;

      if (canBypass) {
        localStorage.setItem('hub_maint_privileged', 'admin');
        localStorage.removeItem('hub_maint_beacon');
        setActiveMaintenance(maintData);
        onStatusChange?.(false); // Admin: Keep banner, no blocking overlay
      } else {
        localStorage.setItem('hub_maint_beacon', maintData.scheduleClose || '');
        localStorage.removeItem('hub_maint_privileged');
        setActiveMaintenance(maintData);
        onStatusChange?.(true, maintData); // Regular User: Show blocking overlay
      }
    };

    try {
      // 1. Primary Attempt: Query Main Backend
      const { data } = await axios.get('/api/maintenance', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const potentialMaintenances = data.filter((m: any) => {
        if (m.status === 'ongoing') return true;
        if (m.status === 'completed' && m.actualEnd) {
          return new Date(m.actualEnd) > oneHourAgo;
        }
        if (m.status === 'cancelled') {
          const updatedAt = new Date(m.updatedAt);
          const startDate = new Date(m.scheduleStart);
          return updatedAt > oneHourAgo && (startDate <= twentyFourHoursFromNow || m.notificationSent === true);
        }
        if (m.status === 'scheduled') {
          const startDate = new Date(m.scheduleStart);
          return startDate > now && startDate <= twentyFourHoursFromNow;
        }
        return false;
      });

      const sorted = potentialMaintenances.sort((a: any, b: any) => {
        const priority: Record<string, number> = { ongoing: 1, scheduled: 2, completed: 3, cancelled: 4 };
        if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
        return new Date(a.scheduleStart).getTime() - new Date(a.scheduleStart).getTime();
      });

      const topPriority = sorted[0] || null;

      if (topPriority?.status === 'ongoing') {
        applyLockdownLogic(topPriority);
      } else {
        // Officially ended/cleared by server response
        setActiveMaintenance(topPriority);
        localStorage.removeItem('hub_maint_beacon');
        localStorage.removeItem('hub_maint_privileged');
        onStatusChange?.(false);
      }

    } catch (primaryErr: any) {
      console.warn("Main backend unavailable for maintenance check. Falling back to auth-backend...", primaryErr);

      try {
        // 2. Fallback Attempt: Query Auth-Backend Endpoint
        const { data: authData } = await axios.get('/login-auth/maintenance-status', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (authData.active && authData.maintenance) {
          applyLockdownLogic(authData.maintenance);
          return;
        } else {
          // Auth backend responded cleanly and verified maintenance is NOT active
          setActiveMaintenance(null);
          localStorage.removeItem('hub_maint_beacon');
          localStorage.removeItem('hub_maint_privileged');
          onStatusChange?.(false);
          return;
        }

      } catch (fallbackErr: any) {
        console.error("Both primary backend and auth-backend failed to respond:", fallbackErr);

        // 3. FAIL-SAFE BEACON CHECK
        // If BOTH backends are unreachable (e.g. database down or network crash), 
        // check if we previously set a local beacon for this session.
        const existingBeacon = localStorage.getItem('hub_maint_beacon');
        const isPrivileged = localStorage.getItem('hub_maint_privileged') === 'admin';

        if (existingBeacon && !isPrivileged) {
          // Enforce existing maintenance lock rather than kicking user into an broken app
          const fallbackMaintenanceObj = {
            status: 'ongoing',
            scheduleClose: existingBeacon,
            title: 'System Maintenance',
            message: 'The system is undergoing maintenance. Please try again shortly.'
          };
          setActiveMaintenance(fallbackMaintenanceObj);
          onStatusChange?.(true, fallbackMaintenanceObj);
        } else {
          // Reset only if no active beacon existed prior to the outage
          setActiveMaintenance(null);
          onStatusChange?.(false);
        }
      }
    }
  }, [user, onStatusChange]);

  useEffect(() => {
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkMaintenance]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("maintenanceUpdated", checkMaintenance);
    return () => { socket.off("maintenanceUpdated"); };
  }, [checkMaintenance]);

  useEffect(() => {
    if (!activeMaintenance || activeMaintenance.status !== 'scheduled') return;
    const timer = setInterval(() => {
      const distance = new Date(activeMaintenance.scheduleStart).getTime() - new Date().getTime();
      if (distance < 0) {
        setTimeLeft("Starting now...");
        checkMaintenance();
        return;
      }
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMaintenance, checkMaintenance]);

  if (!activeMaintenance) return null;

  const bannerConfig = {
    ongoing: "bg-red-600 text-white border-red-700",
    scheduled: "bg-amber-100 text-amber-900 border-amber-200",
    completed: "bg-emerald-600 text-white border-emerald-700",
    cancelled: "bg-blue-600 text-white border-blue-700",
  };

  return (
    <div className={`w-full overflow-hidden py-2 border-b relative z-40 transition-colors duration-500 ${bannerConfig[activeMaintenance.status as keyof typeof bannerConfig]}`}>
      {/* The Admin Bypass Badge (Floating above the marquee) */}
      {activeMaintenance.status === 'ongoing' && user?.access?.settings?.maintenance && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold border border-white/30 shadow-lg">
          <ShieldCheck className="w-4 h-4" />
          ADMIN BYPASS ACTIVE
        </div>
      )}

      {/* The Marquee Container */}
      <div className="flex w-max animate-marquee pause-on-hover">
        <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
        <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
        {/* <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
        <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} /> */}
      </div>
    </div>
  );
}

// Helper component for the repeating marquee content
function BannerContent({ activeMaintenance, timeLeft }: any) {
  const status = activeMaintenance.status;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const startDisp = formatDate(activeMaintenance.scheduleStart);
  const endDisp = formatDate(activeMaintenance.scheduleClose);

  return (
    <div className="flex items-center gap-12 px-6 shrink-0">
      <div className="flex items-center gap-3">
        {status === 'ongoing' && <AlertTriangle size={18} className="animate-pulse" />}
        {status === 'scheduled' && <Clock size={18} />}
        {status === 'completed' && <CheckCircle2 size={18} />}
        {status === 'cancelled' && <XCircle size={18} />}

        <span className="text-sm font-bold uppercase tracking-wide">
          {status === 'ongoing' && `⚠️ SYSTEM MAINTENANCE IN PROGRESS: The Hub is currently offline. Please DO NOT save work. Estimated completion: ${endDisp}.`}
          {status === 'scheduled' && `📢 UPCOMING MAINTENANCE: The Hub will be offline from ${startDisp} to ${endDisp}. Please save work 5 mins before start.`}
          {status === 'completed' && `✅ MAINTENANCE COMPLETED: The system is now fully operational. You may resume all activities.`}
          {status === 'cancelled' && `🚫 MAINTENANCE CANCELLED: The update scheduled for ${startDisp} has been cancelled. Continue working normally.`}
        </span>
      </div>

      {status === 'scheduled' && (
        <div className="flex items-center gap-2 bg-amber-200 px-3 py-0.5 rounded-full border border-amber-300">
          <span className="font-mono font-bold text-xs text-amber-900 uppercase italic">Starts in: {timeLeft}</span>
        </div>
      )}
    </div>
  );
}

// import { useEffect, useState, useCallback } from 'react';
// import axios from 'axios';
// import { getSocket } from "@/lib/websocket";
// import { useAuth } from "@/context/AuthContext"; // Ensure this path is correct for your project
// import { ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";

// interface MaintenanceBannerProps {
//   onStatusChange?: (isLocked: boolean, details?: any) => void;
// }

// export default function MaintenanceBanner({ onStatusChange }: MaintenanceBannerProps) {
//   const [activeMaintenance, setActiveMaintenance] = useState<any>(null);
//   const [timeLeft, setTimeLeft] = useState<string>("");
//   const { user } = useAuth();

//   const checkMaintenance = useCallback(async () => {
//     try {
//       const token = localStorage.getItem('token');
//       const { data } = await axios.get('/api/maintenance', {
//         headers: { Authorization: `Bearer ${token || ''}` }
//       });

//       const now = new Date();
//       const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
//       const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

//       const potentialMaintenances = data.filter((m: any) => {
//         if (m.status === 'ongoing') return true;
//         if (m.status === 'completed' && m.actualEnd) {
//           return new Date(m.actualEnd) > oneHourAgo;
//         }
//         if (m.status === 'cancelled') {
//           const updatedAt = new Date(m.updatedAt);
//           const startDate = new Date(m.scheduleStart);
//           return updatedAt > oneHourAgo && (startDate <= twentyFourHoursFromNow || m.notificationSent === true);
//         }
//         if (m.status === 'scheduled') {
//           const startDate = new Date(m.scheduleStart);
//           return startDate > now && startDate <= twentyFourHoursFromNow;
//         }
//         return false;
//       });

//       const sorted = potentialMaintenances.sort((a: any, b: any) => {
//         const priority: Record<string, number> = { ongoing: 1, scheduled: 2, completed: 3, cancelled: 4 };
//         if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
//         return new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime();
//       });

//       const topPriority = sorted[0] || null;
//       setActiveMaintenance(topPriority);

//       // --- LOCKDOWN & BYPASS LOGIC ---
//       // if (topPriority?.status === 'ongoing') {
//       //   // Store beacon for resilience (as discussed)
//       //   localStorage.setItem('hub_maint_beacon', topPriority.scheduleClose);

//       //   // Check permission: settings -> maintenance
//       //   const canBypass = user?.access?.settings?.maintenance === true;

//       //   if (canBypass) {
//       //     onStatusChange?.(false); // Admin: show banner but NO overlay
//       //   } else {
//       //     onStatusChange?.(true, topPriority); // Regular User: Show overlay
//       //   }
//       // } else {
//       //   localStorage.removeItem('hub_maint_beacon');
//       //   onStatusChange?.(false);
//       // }

//       // --- LOCKDOWN & BYPASS LOGIC ---
//       if (topPriority?.status === 'ongoing') {
//         const canBypass = user?.access?.settings?.maintenance === true;

//         if (canBypass) {
//           // Admin: Store privileged flag, remove regular lock
//           localStorage.setItem('hub_maint_privileged', 'admin');
//           localStorage.removeItem('hub_maint_beacon');
//           onStatusChange?.(false);
//         } else {
//           // Regular User: Store regular lock, remove privileged flag (safety)
//           localStorage.setItem('hub_maint_beacon', topPriority.scheduleClose);
//           localStorage.removeItem('hub_maint_privileged');
//           onStatusChange?.(true, topPriority);
//         }
//       } else {
//         // Clear everything when maintenance is officially over
//         localStorage.removeItem('hub_maint_beacon');
//         localStorage.removeItem('hub_maint_privileged');
//         onStatusChange?.(false);
//       }
//     } catch (err: any) {
//       console.error("Banner fetch error:", err);

//       // === FIX: Don't lock the screen for Auth errors ===
//       // If the token is expired (401) or unauthorized (403), let the 
//       // Auth system handle the redirect. Do NOT trigger a maintenance lock.
//       if (err.response?.status === 401 || err.response?.status === 403) {
//         return;
//       }

//       // === Admin Bypass Check ===
//       if (localStorage.getItem('hub_maint_privileged') === 'admin') {
//         onStatusChange?.(false);
//         return;
//       }

//       // 1. Priority: If server explicitly says 503 Maintenance
//       if (err.response?.status === 503) {
//         const maintData = err.response.data;
//         localStorage.setItem('hub_maint_beacon', maintData.endTime);
//         onStatusChange?.(true, {
//           status: 'ongoing',
//           scheduleClose: maintData.endTime
//         });
//         return;
//       }

//       // 2. Resilience: Handle network errors (Backend Down)
//       // Only trigger this if it's a network error (no response) or 5xx server error
//       if (!err.response || err.response.status >= 500) {
//         let beacon = localStorage.getItem('hub_maint_beacon');

//         if (!beacon) {
//           const safetyTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
//           localStorage.setItem('hub_maint_beacon', safetyTime);
//           beacon = safetyTime;
//         }

//         const now = new Date();
//         const estimatedEnd = new Date(beacon);

//         if (now < estimatedEnd) {
//           onStatusChange?.(true, { status: 'ongoing', scheduleClose: beacon });
//         } else {
//           onStatusChange?.(true, { status: 'ongoing', scheduleClose: null });
//         }
//       }
//     }
//   }, [user, onStatusChange]);

//   useEffect(() => {
//     checkMaintenance();
//     const interval = setInterval(checkMaintenance, 5 * 60 * 1000);
//     return () => clearInterval(interval);
//   }, [checkMaintenance]);

//   useEffect(() => {
//     const socket = getSocket();
//     socket.on("maintenanceUpdated", checkMaintenance);
//     return () => { socket.off("maintenanceUpdated"); };
//   }, [checkMaintenance]);

//   useEffect(() => {
//     if (!activeMaintenance || activeMaintenance.status !== 'scheduled') return;
//     const timer = setInterval(() => {
//       const distance = new Date(activeMaintenance.scheduleStart).getTime() - new Date().getTime();
//       if (distance < 0) {
//         setTimeLeft("Starting now...");
//         checkMaintenance();
//         return;
//       }
//       const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
//       const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
//       const seconds = Math.floor((distance % (1000 * 60)) / 1000);
//       setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
//     }, 1000);
//     return () => clearInterval(timer);
//   }, [activeMaintenance, checkMaintenance]);

//   if (!activeMaintenance) return null;

//   const bannerConfig = {
//     ongoing: "bg-red-600 text-white border-red-700",
//     scheduled: "bg-amber-100 text-amber-900 border-amber-200",
//     completed: "bg-emerald-600 text-white border-emerald-700",
//     cancelled: "bg-blue-600 text-white border-blue-700",
//   };

//   return (
//     <div className={`w-full overflow-hidden py-2 border-b relative z-40 transition-colors duration-500 ${bannerConfig[activeMaintenance.status as keyof typeof bannerConfig]}`}>
//       {/* The Admin Bypass Badge (Floating above the marquee) */}
//       {activeMaintenance.status === 'ongoing' && user?.access?.settings?.maintenance && (
//         <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold border border-white/30 shadow-lg">
//           <ShieldCheck className="w-4 h-4" />
//           ADMIN BYPASS ACTIVE
//         </div>
//       )}

//       {/* The Marquee Container */}
//       <div className="flex w-max animate-marquee pause-on-hover">
//         <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
//         <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
//         {/* <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
//         <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} /> */}
//       </div>
//     </div>
//   );
// }

// // Helper component for the repeating marquee content
// function BannerContent({ activeMaintenance, timeLeft }: any) {
//   const status = activeMaintenance.status;

//   const formatDate = (date: string) => {
//     return new Date(date).toLocaleString([], {
//       month: 'short',
//       day: 'numeric',
//       hour: '2-digit',
//       minute: '2-digit'
//     });
//   };

//   const startDisp = formatDate(activeMaintenance.scheduleStart);
//   const endDisp = formatDate(activeMaintenance.scheduleClose);

//   return (
//     <div className="flex items-center gap-12 px-6 shrink-0">
//       <div className="flex items-center gap-3">
//         {status === 'ongoing' && <AlertTriangle size={18} className="animate-pulse" />}
//         {status === 'scheduled' && <Clock size={18} />}
//         {status === 'completed' && <CheckCircle2 size={18} />}
//         {status === 'cancelled' && <XCircle size={18} />}

//         <span className="text-sm font-bold uppercase tracking-wide">
//           {status === 'ongoing' && `⚠️ SYSTEM MAINTENANCE IN PROGRESS: The Hub is currently offline. Please DO NOT save work. Estimated completion: ${endDisp}.`}
//           {status === 'scheduled' && `📢 UPCOMING MAINTENANCE: The Hub will be offline from ${startDisp} to ${endDisp}. Please save work 5 mins before start.`}
//           {status === 'completed' && `✅ MAINTENANCE COMPLETED: The system is now fully operational. You may resume all activities.`}
//           {status === 'cancelled' && `🚫 MAINTENANCE CANCELLED: The update scheduled for ${startDisp} has been cancelled. Continue working normally.`}
//         </span>
//       </div>

//       {status === 'scheduled' && (
//         <div className="flex items-center gap-2 bg-amber-200 px-3 py-0.5 rounded-full border border-amber-300">
//           <span className="font-mono font-bold text-xs text-amber-900 uppercase italic">Starts in: {timeLeft}</span>
//         </div>
//       )}
//     </div>
//   );
// }