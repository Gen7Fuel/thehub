import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'
import { triggerBackgroundSync } from '@/lib/utils'
import { savePendingAction } from '@/lib/orderRecIndexedDB'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'

export const Route = createFileRoute('/_navbarLayout/payables/review')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Get individual payable variables from store
  const payableVendorName = useFormStore((state) => state.payableVendorName)
  const payableLocation = useFormStore((state) => state.payableLocation)
  const payableNotes = useFormStore((state) => state.payableNotes)
  const payablePaymentMethod = useFormStore((state) => state.payablePaymentMethod)
  const payableAmount = useFormStore((state) => state.payableAmount)
  const payableImages = useFormStore((state) => state.payableImages)
  const date = useFormStore((state) => state.date)
  const resetPayableForm = useFormStore((state) => state.resetPayableForm)

  useEffect(() => {
    if (!date || !payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) {
      navigate({ to: "/payables" })
    }
  }, [date, payableVendorName, payableLocation, payablePaymentMethod, payableAmount, navigate])

  // A ref guard (not just React state) closes the double-tap window: state
  // only blocks a second click after the next re-render commits, which is a
  // real gap on a slow device — the ref is checked synchronously. Mirrors
  // po/receipt.tsx's submit guard.
  const isSubmittingRef = useRef(false)

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return
    if (!date || !payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) return

    isSubmittingRef.current = true
    setIsSubmitting(true)

    // Location name only — resolving it to the location's ObjectId requires
    // a network call (GET /api/locations), so that lookup is deferred to
    // sync time (syncOneAction's CREATE_PAYABLE branch in lib/utils.ts)
    // rather than done here, keeping this step entirely local.
    const payload = {
      vendorName: payableVendorName,
      location: payableLocation,
      notes: payableNotes,
      paymentMethod: payablePaymentMethod,
      amount: payableAmount,
      date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    }

    try {
      // Always save locally first — the ONLY awaited step here is a local
      // IndexedDB write (sub-100ms), never a network call. Mirrors the
      // always-queue pattern po/receipt.tsx uses for purchase orders.
      await savePendingAction({ type: 'CREATE_PAYABLE', images: payableImages, payload, queuedAt: Date.now() })

      // Fire-and-forget: kicks off an immediate sync attempt so a
      // genuinely-online user's payable leaves the "Pending upload" state
      // within a couple of seconds rather than waiting for the navbar's
      // next 15s poll — but since this is never awaited, it can never block
      // navigation, no matter how long connectivity detection or the actual
      // upload takes.
      triggerBackgroundSync()

      resetPayableForm()
      navigate({ to: '/payables/list' })
    } catch (err) {
      // Only a broken/unavailable IndexedDB lands here (e.g. quota
      // exceeded, private-browsing restrictions) — genuinely rare, and
      // there's no local queue to fall back to if local storage itself is
      // the thing that failed.
      console.error('Failed to save payable locally:', err)
      isSubmittingRef.current = false
      setIsSubmitting(false)
      alert('Error saving payable entry. Please try again.')
    }
  }

  const paymentMethodLabels = {
    safe: 'Safe',
    till: 'Till',
    cheque: 'Cheque',
    on_account: 'On Account',
    other: 'Other'
  }

  if (!payableVendorName || !payableLocation || !payablePaymentMethod || !payableAmount) {
    return null
  }

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Review Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Review Payable Entry</h2>
        
        <div className="bg-gray-50 p-4 rounded-md space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Vendor Name:</strong>
              <p>{payableVendorName}</p>
            </div>
            <div>
              <strong>Location:</strong>
              <p>{payableLocation}</p>
            </div>
            <div>
              <strong>Payment Method:</strong>
              <p>{paymentMethodLabels[payablePaymentMethod as keyof typeof paymentMethodLabels]}</p>
            </div>
            <div>
              <strong>Amount:</strong>
              <p>${payableAmount.toFixed(2)}</p>
            </div>
          </div>
          
          {payableNotes && (
            <div>
              <strong>Notes:</strong>
              <p>{payableNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Images Review */}
      {payableImages.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-md font-semibold">Attached Images ({payableImages.length})</h3>
          <div className="grid grid-cols-3 gap-4">
            {payableImages.map((image, index) => (
              <img 
                key={index}
                src={image} 
                alt={`Invoice ${index + 1}`} 
                className="border border-dashed border-gray-300 rounded-md w-full h-24 object-cover" 
              />
            ))}
          </div>
        </div>
      )}

      <hr className="border-t border-dashed border-gray-300" />

      {/* Navigation Section */}
      <div className="flex justify-between">
        <Link to="/payables/images">
          <Button variant="outline">Back</Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="min-w-[100px]"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            'Submit'
          )}
        </Button>
      </div>
    </div>
  )
}