import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_navbarLayout/no-access/')({
  component: RouteComponent,
})

function RouteComponent() {
  return  (
    <div className="flex justify-center items-start min-h-screen pt-40">
      <div className="text-red-600 text-center text-lg font-semibold">
        Access Denied. Contact Admin.
      </div>
    </div>
)}