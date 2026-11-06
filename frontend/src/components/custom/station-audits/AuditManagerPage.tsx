import type { LucideIcon } from 'lucide-react'
import { Navigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { hasAuditManagerAccess, hasAuditManagerPermission, type AuditManagerPermission } from '@/lib/auditManagerPermissions'

export function AuditManagerPage({
  permission,
  title,
  description,
  icon: Icon,
}: {
  permission: AuditManagerPermission
  title: string
  description: string
  icon: LucideIcon
}) {
  const { user } = useAuth()
  if (!user) return null

  const access = user.access
  if (!hasAuditManagerAccess(access) || !hasAuditManagerPermission(access, permission)) {
    return <Navigate to="/no-access" replace />
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-10 sm:px-5">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
              <p className="mt-1 text-sm font-normal text-slate-500">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">
            CRUD controls will be added in the next step.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
