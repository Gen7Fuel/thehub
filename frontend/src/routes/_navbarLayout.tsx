// import Navbar from '@/components/custom/navbar'
// import MaintenanceBanner from '@/components/custom/MaintenanceBanner'
// import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

// export const Route = createFileRoute('/_navbarLayout')({
//   loader: () => {
//     const token = localStorage.getItem('token')
//     if (!token) {
//       throw redirect({ to: '/login' }) // Redirect to login if token is missing
//     }
//     return null
//   },
//   component: RouteComponent,
// })

// function RouteComponent() {
//   // return (
//   //   <>
//   //     <Navbar />
//   //     {/* <Outlet /> */}
//   //     <div className="flex-1 flex flex-col pt-[56px] pb-0">
//   //       <MaintenanceBanner />

//   //       <main className="flex-1 overflow-auto">
//   //         <Outlet />
//   //       </main>
//   //     </div>
//   //   </>
//   // )
//   return (
//     <div className="flex flex-col min-h-screen">
//       {/* Navbar stays at the top of the flow */}
//       <Navbar />

//       {/* This container now has NO forced top padding */}
//       <div className="flex flex-col flex-1">
//         {/* If this is null, it takes 0px. If it exists, it pushes <main> down */}
//         <MaintenanceBanner />

//         <main className="flex-1" >
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   )
// }
import { useState, useCallback } from 'react'
import { AlertTriangle, Clock, RefreshCw } from "lucide-react"
import Navbar from '@/components/custom/navbar'
import MaintenanceBanner from '@/components/custom/MaintenanceBanner'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout')({
  loader: () => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw redirect({ to: '/login' })
    }
    return null
  },
  component: RouteComponent,
})

function RouteComponent() {
  const [isLocked, setIsLocked] = useState(false);
  const [maintDetails, setMaintDetails] = useState<any>(null);
  // to avoid needing isLocked in the dependency array.
  const handleStatusChange = useCallback((locked: boolean, details?: any) => {
    setIsLocked((prev) => {
      if (prev === locked) return prev; // Avoid unnecessary state updates
      return locked;
    });

    if (details) {
      setMaintDetails(details);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Navbar stays visible but is covered by the overlay if isLocked is true */}
      <Navbar />

      <div className="flex flex-col flex-1">
        {/* We pass the state setter to the banner */}
        <MaintenanceBanner onStatusChange={handleStatusChange} />

        <main className="flex-1">
          <Outlet />
        </main>

      </div>
      {/* --- FULL SCREEN LOCKDOWN OVERLAY --- */}
      {isLocked && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 border-t-8 border-red-600 p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center animate-in fade-in zoom-in duration-300">

            {/* Icon Section */}
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600 w-10 h-10 animate-bounce" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
              System Lockdown
            </h2>

            <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              The Hub is currently undergoing essential maintenance to improve your experience.
              To protect your data, all interactions are paused until the update is complete.
            </p>

            {/* Estimated Time Card
            {maintDetails?.scheduleClose && (
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-5 flex items-center justify-center gap-4 mb-8 border border-slate-200 dark:border-slate-700">
                <Clock className="text-slate-400 w-6 h-6" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Estimated Availability
                  </p>
                  <p className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
                    {new Date(maintDetails.scheduleClose).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )} */}
            {/* --- Updated Estimated Time Card Logic --- */}
            {maintDetails?.scheduleClose ? (
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-5 flex items-center justify-center gap-4 mb-8 border border-slate-200 dark:border-slate-700">
                <Clock className="text-slate-400 w-6 h-6" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Estimated Availability
                  </p>
                  <p className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
                    {new Date(maintDetails.scheduleClose).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ) : (
              /* This displays when the backend is unreachable AND we are past the beacon time */
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 mb-8 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center justify-center gap-3 text-amber-700 dark:text-amber-500 mb-2">
                  <Clock className="w-5 h-5 animate-pulse" />
                  <span className="font-bold">Almost there!</span>
                </div>
                <p className="text-sm text-amber-800/80 dark:text-amber-400/80">
                  The update is taking slightly longer than expected. We are finalizing the system and will be back online shortly.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full gap-2 border-slate-300 dark:border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                Check Status Again
              </Button>

              <p className="text-xs text-slate-400 italic">
                This page will automatically unlock once maintenance concludes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
