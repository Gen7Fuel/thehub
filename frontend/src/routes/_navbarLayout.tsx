import Navbar from '@/components/custom/navbar'
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
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}