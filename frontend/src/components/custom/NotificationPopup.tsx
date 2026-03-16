import { X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NotificationPopupProps {
  message: string;
  onClose: () => void;
  onView: () => void;
}

export default function NotificationPopup({ message, onClose, onView }: NotificationPopupProps) {
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100000] w-full max-w-md px-4 animate-in slide-in-from-top duration-500">
      <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 shadow-[0_20px_50px_rgba(59,130,246,0.2)] rounded-2xl p-4 flex items-center gap-4">
        {/* Animated Icon Container */}
        <div className="relative shrink-0">
          <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
            <Bell className="h-5 w-5 text-white animate-bounce" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Hub Updates
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-tight">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 border-l pl-3 border-slate-100">
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-8 px-3 rounded-lg"
            onClick={onView}
          >
            Review
          </Button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}