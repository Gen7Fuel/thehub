import { savePendingAction } from "@/lib/orderRecIndexedDB";
import { triggerBackgroundSync } from "@/lib/utils";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
// import Webcam from "react-webcam"
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

export const Route = createFileRoute('/_navbarLayout/po/receipt')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setReceipt = useFormStore((state) => state.setReceipt);
  const receipt = useFormStore((state) => state.receipt);

  const fleetCardNumber = useFormStore((state) => state.fleetCardNumber);
  const noFleetCard = useFormStore((state) => state.noFleetCard);
  const poNumber = useFormStore((state) => state.poNumber);
  const customerName = useFormStore((state) => state.customerName);
  const driverName = useFormStore((state) => state.driverName);
  const vehicleInfo = useFormStore((state) => state.vehicleInfo);
  const licensePlate = useFormStore((state) => state.licensePlate);
  const quantity = useFormStore((state) => state.quantity);
  const amount = useFormStore((state) => state.amount);
  const fuelType = useFormStore((state) => state.fuelType);
  const date = useFormStore((state) => state.date);
  const stationName = useFormStore((state) => state.stationName);
  const purchaseType = useFormStore((state) => state.purchaseType);
  const itemsDescription = useFormStore((state) => state.itemsDescription);

  useEffect(() => {
    const fuelInvalid = purchaseType === 'fuel' && (!fuelType || quantity === 0);
    const nonFuelInvalid = purchaseType === 'non-fuel' && !itemsDescription;
    if (!date || !customerName || !driverName || amount === 0 || fuelInvalid || nonFuelInvalid) {
      navigate({ to: "/po" });
    }
  }, [date, customerName, driverName, fuelType, quantity, amount, purchaseType, itemsDescription]);

  const handleRetryCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setReceipt(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  // A ref guard (not just React state) closes the double-tap window: state
  // only blocks a second click after the next re-render commits, which is a
  // real gap on a slow device — the ref is checked synchronously.
  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmittingRef.current || !receipt) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const selectedStation = stationName || "Rankin";

    const payload = {
      source: "PO",
      date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      stationName: selectedStation,
      fleetCardNumber: fleetCardNumber || "",
      noFleetCard: noFleetCard || false,
      poNumber: poNumber || "",
      quantity: purchaseType === 'fuel' ? quantity : 0,
      amount,
      productCode: purchaseType === 'fuel' ? fuelType : 'NON-FUEL',
      trx: "",
      signature: "",
      customerName,
      driverName,
      vehicleMakeModel: vehicleInfo,
      licensePlate,
      purchaseType,
      itemsDescription: purchaseType === 'non-fuel' ? itemsDescription : '',
    };

    try {
      // Always save locally first — the ONLY awaited step here is a local
      // IndexedDB write (sub-100ms), never a network call. This is what
      // makes the button structurally unable to hang: there is nothing in
      // this critical path that can be slow, stuck, or offline in the first
      // place. See order-rec/$id.tsx for the same always-queue pattern.
      await savePendingAction({ type: "CREATE_PURCHASE_ORDER", receipt, payload, queuedAt: Date.now() });

      // Fire-and-forget: kicks off an immediate sync attempt so a
      // genuinely-online user's PO leaves the "Pending upload" state within
      // a couple of seconds rather than waiting for the navbar's next 15s
      // poll — but since this is never awaited, it can never block
      // navigation, no matter how long connectivity detection or the actual
      // upload takes.
      triggerBackgroundSync();

      navigate({ to: "/po/list" });
    } catch (err) {
      // Only a broken/unavailable IndexedDB lands here (e.g. quota
      // exceeded, private-browsing restrictions) — genuinely rare, and
      // there's no local queue to fall back to if local storage itself is
      // the thing that failed.
      console.error("Failed to save purchase order locally:", err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      alert("Error saving purchase order. Please try again.");
    }
  };

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-4 max-w-md mx-auto">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleRetryCapture}
      />

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Receipt Preview</h2>
          {receipt && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="mr-2 h-3 w-3" />
              Retake
            </Button>
          )}
        </div>

        {/* Constrained Preview Area */}
        <div className="relative w-full h-[50vh] bg-slate-100 rounded-lg border overflow-hidden flex items-center justify-center">
          {receipt ? (
            <div className="w-full h-full overflow-auto">
              <img
                src={receipt}
                alt="Captured Receipt"
                className="w-full h-auto min-h-full object-contain bg-slate-900"
              />
            </div>
          ) : (
            <div className="text-center p-6">
              <p className="text-slate-500 text-sm mb-4">No receipt image found.</p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Capture Now
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
        <p className="text-[11px] text-blue-700 font-medium uppercase tracking-wider">PO Summary</p>
        <div className="flex justify-between text-sm pt-1">
          <span className="font-bold">{customerName || 'N/A'}</span>
          {purchaseType === 'fuel' ? (
            <span className="text-slate-600">{quantity}L • C${amount}</span>
          ) : (
            <span className="text-slate-600 max-w-[55%] text-right truncate">{itemsDescription} • C${amount}</span>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Link to="/po" className="flex-none">
          <Button variant="outline">Edit Info</Button>
        </Link>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !receipt}
          className="flex-1 bg-green-700 hover:bg-green-800 shadow-md"
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            "Finalize & Submit"
          )}
        </Button>
      </div>
    </div>
  );
}
