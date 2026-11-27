import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/context/AuthContext'
import { cycleCountPages, hasCycleCountPageAccess } from '@/lib/cycleCountPermissions'

export const Route = createFileRoute('/_navbarLayout/cycle-count/')({
  component: CycleCountIndex,
})

function CycleCountIndex() {
  const { user } = useAuth()
  if (!user) return null

  const page = cycleCountPages.find(({ permission }) => hasCycleCountPageAccess(user.access, permission))
  if (!page) return <Navigate to="/no-access" replace />

  if (page.to === '/cycle-count/inventory') {
    return <Navigate to={page.to} search={{ site: user.location || '', category: '' }} replace />
  }

  return <Navigate to={page.to} replace />
}
