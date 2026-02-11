import Navbar from '@/components/custom/navbar'
import MaintenanceBanner from '@/components/custom/MaintenanceBanner'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout')({
  loader: () => {
    const token = localStorage.getItem('token')
    if (!token) {
      throw redirect({ to: '/login' }) // Redirect to login if token is missing
    }
    return null
  },
  component: RouteComponent,
})

function RouteComponent() {
  // return (
  //   <>
  //     <Navbar />
  //     {/* <Outlet /> */}
  //     <div className="flex-1 flex flex-col pt-[56px] pb-0">
  //       <MaintenanceBanner />

  //       <main className="flex-1 overflow-auto">
  //         <Outlet />
  //       </main>
  //     </div>
  //   </>
  // )
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar stays at the top of the flow */}
      <Navbar />

      {/* This container now has NO forced top padding */}
      <div className="flex flex-col flex-1">
        {/* If this is null, it takes 0px. If it exists, it pushes <main> down */}
        <MaintenanceBanner />

        <main className="flex-1" >
          <Outlet />
        </main>
      </div>
    </div>
  )
}