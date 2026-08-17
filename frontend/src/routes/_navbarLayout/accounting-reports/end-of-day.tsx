import { createFileRoute } from '@tanstack/react-router';
import { Construction, Clock, Sparkles } from 'lucide-react';

export const Route = createFileRoute(
  '/_navbarLayout/accounting-reports/end-of-day',
)({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
        {/* Animated / Accent Icon Badge */}
        <div className="relative mx-auto w-16 h-16 mb-6 flex items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <Construction className="w-8 h-8" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
          End of Day Report
        </h1>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-semibold mb-4">
          <Clock className="w-3.5 h-3.5" />
          <span>Work Under Progress</span>
        </div>

      </div>
    </div>
  );
}