import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { AlertTriangle, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { getSocket } from "@/lib/websocket";

export default function MaintenanceBanner() {
  const [activeMaintenance, setActiveMaintenance] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const checkMaintenance = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/maintenance', {
        headers: { Authorization: `Bearer ${token || ''}` }
      });

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const potentialMaintenances = data.filter((m: any) => {
        // 1. Ongoing: Always show
        if (m.status === 'ongoing') return true;

        // 2. Completed: Show for 1 hour after actualEnd
        if (m.status === 'completed' && m.actualEnd) {
          return new Date(m.actualEnd) > oneHourAgo;
        }

        // 3. Cancelled: Show for 1 hour after updatedAt
        if (m.status === 'cancelled') {
          return new Date(m.updatedAt) > oneHourAgo;
        }

        // 4. Scheduled: Show if starting within 24 hours
        if (m.status === 'scheduled') {
          const startDate = new Date(m.scheduleStart);
          return startDate > now && startDate <= twentyFourHoursFromNow;
        }
        return false;
      });

      const sorted = potentialMaintenances.sort((a: any, b: any) => {
        const priority: Record<string, number> = {
          ongoing: 1,
          scheduled: 2,
          completed: 3,
          cancelled: 4
        };
        
        if (priority[a.status] !== priority[b.status]) {
          return priority[a.status] - priority[b.status];
        }
        // If same status, earliest start date first
        return new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime();
      });

      setActiveMaintenance(sorted[0] || null);
    } catch (err) {
      console.error("Banner fetch error:", err);
    }
  }, []);

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
      <div className="flex w-max animate-marquee pause-on-hover">
        <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
        <BannerContent activeMaintenance={activeMaintenance} timeLeft={timeLeft} />
      </div>
    </div>
  );
}

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
          <span className="font-mono font-bold text-xs text-amber-900 uppercase">Starts in: {timeLeft}</span>
        </div>
      )}
    </div>
  );
}