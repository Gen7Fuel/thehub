import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { VendorPicker } from '@/components/custom/vendorPicker'
import { Button } from '@/components/ui/button'

interface AssignedOrderRec { _id: string; vendor: string; filename: string }

export function OrderRecVendorAssignment({ orderRec, onAssigned }: {
  orderRec: { _id: string; site: string; source?: string; vendor?: string }
  onAssigned: (order: AssignedOrderRec) => void | Promise<void>
}) {
  const { user } = useAuth()
  const [vendor, setVendor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (orderRec.source !== 'scanner' || orderRec.vendor) return null

  async function assign() {
    if (!vendor || saving) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/order-rec/${orderRec._id}/vendor`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json',
          'X-Required-Permission': 'orderRec.workflow',
        },
        body: JSON.stringify({ vendor }),
        signal: AbortSignal.timeout(15000),
      })
      const updated = await response.json()
      if (!response.ok) throw new Error(updated.message || 'Unable to assign vendor.')
      await onAssigned(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign vendor. Please refresh and try again.')
    } finally { setSaving(false) }
  }

  return (
    <section aria-label="Vendor assignment" className="my-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Vendor pending</p>
      {user?.access?.orderRec?.value && user.access.orderRec.workflow === true ? (
        <>
          <p className="text-sm text-amber-900">Select the vendor for {orderRec.site} before placing this order.</p>
          <div className="flex flex-wrap items-center gap-2 [&_button]:h-11">
            <VendorPicker value={vendor} setVendor={setVendor} location={orderRec.site} disabled={saving} />
            <Button disabled={!vendor || saving} onClick={assign}>{saving ? 'Assigning…' : 'Assign vendor'}</Button>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </>
      ) : <p className="text-sm text-amber-900">Head office will select the vendor for this order.</p>}
    </section>
  )
}
