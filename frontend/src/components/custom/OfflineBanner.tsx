import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { isActuallyOnline } from "@/lib/network";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;

    const handleOffline = () => { if (mounted) setIsOffline(true); };
    const handleOnline = async () => {
      const ok = await isActuallyOnline();
      if (mounted) setIsOffline(!ok);
    };

    handleOnline();

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      mounted = false;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-red-600 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>No internet connection. Please check your network.</span>
    </div>
  );
}
