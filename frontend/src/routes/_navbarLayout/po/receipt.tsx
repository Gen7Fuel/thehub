import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { uploadBase64Image } from "@/lib/utils";
import { domain } from "@/lib/constants";
import { Camera, Loader2 } from "lucide-react";
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
// import Webcam from "react-webcam"
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

export const Route = createFileRoute('/_navbarLayout/po/receipt')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  // const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setReceipt = useFormStore((state) => state.setReceipt);
  const receipt = useFormStore((state) => state.receipt);

  const fleetCardNumber = useFormStore((state) => state.fleetCardNumber);
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

  // const capture = () => {
  //   if (webcamRef.current) {
  //     const imageSrc = webcamRef.current.getScreenshot();
  //     if (imageSrc) setReceipt(imageSrc);
  //   }
  // };

  // const handleRetry = () => setReceipt("");

  // const videoConstraints = {
  //   height: 640,
  //   facingMode: "environment",
  // };

  // Triggered by the "Retry" button
  const handleRetryCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setReceipt(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  // ---------------------------------------------------------
  // 🚀 SAME SUBMIT LOGIC FROM SIGNATURE PAGE (signature = "")
  // ---------------------------------------------------------
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) throw new Error("Please upload a receipt before submitting.");

      const { filename } = await uploadBase64Image(receipt, "receipt.jpg");

      const authHeaders = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "X-Required-Permission": "po",
      };

      const authAxios = async (fn: () => Promise<any>) => {
        try {
          return await fn();
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            navigate({ to: "/no-access" });
          }
          throw err;
        }
      };

      // Fleet upsert and change-notification are now handled by the backend POST /api/purchase-orders.

      // Use selected stationName from store, fallback to 'Rankin' if empty
      const selectedStation = stationName || "Rankin";

      // ---- Submit PO without signature ----
      const poResponse = await authAxios(() =>
        axios.post(
          `${domain}/api/purchase-orders`,
          {
            source: "PO",
            date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            stationName: selectedStation,
            fleetCardNumber: fleetCardNumber || "",
            poNumber: poNumber || "",
            quantity: purchaseType === 'fuel' ? quantity : 0,
            amount,
            productCode: purchaseType === 'fuel' ? fuelType : 'NON-FUEL',
            trx: "",
            signature: "",
            receipt: filename,
            customerName,
            driverName,
            vehicleMakeModel: vehicleInfo,
            licensePlate,
            purchaseType,
            itemsDescription: purchaseType === 'non-fuel' ? itemsDescription : '',
          },
          { headers: authHeaders }
        )
      );

      if (poResponse.status !== 200 && poResponse.status !== 201) {
        throw new Error("Failed to create purchase order");
      }

      return poResponse.data;
    },
    onSuccess: () => {
      navigate({ to: "/po/list" });
    },
    onError: () => {
      alert("Error submitting purchase order. Please try again.");
    },
  });

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  // return (
  //   <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
  //     <div className="space-y-2">
  //       <h2 className="text-lg font-bold">Capture Receipt</h2>
  //       <div className="space-y-4">
  //         <Webcam
  //           ref={webcamRef}
  //           screenshotFormat="image/jpeg"
  //           videoConstraints={videoConstraints}
  //           className={`border border-dashed border-gray-300 rounded-md ${receipt ? "hidden" : "block"}`}
  //         />

  //         {receipt && (
  //           <img src={receipt} alt="Captured" className="border border-dashed border-gray-300 rounded-md" />
  //         )}

  //         {receipt ? (
  //           <Button onClick={handleRetry} variant="secondary">
  //             Retry
  //           </Button>
  //         ) : (
  //           <Button onClick={capture} variant="destructive">
  //             Capture
  //           </Button>
  //         )}
  //       </div>
  //     </div>

  //     <hr className="border-t border-dashed border-gray-300" />

  //     <div className="flex justify-between">
  //       <Link to="/po">
  //         <Button variant="outline">Back</Button>
  //       </Link>

  //       {/* 🚀 NEW SUBMIT BUTTON HERE */}
  //       <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
  //         {submitMutation.isPending ? (
  //           <>
  //             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  //             Submitting...
  //           </>
  //         ) : (
  //           "Submit"
  //         )}
  //       </Button>
  //     </div>
  //   </div>
  // );
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
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || !receipt}
          className="flex-1 bg-green-700 hover:bg-green-800 shadow-md"
        >
          {submitMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            "Finalize & Submit"
          )}
        </Button>
      </div>
    </div>
  );
}