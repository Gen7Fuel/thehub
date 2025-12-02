// import { useEffect } from 'react'
// import { useNavigate } from '@tanstack/react-router'
// import { createFileRoute, Link } from '@tanstack/react-router'
// import { useRef } from 'react'
// import Webcam from "react-webcam"
// import { useFormStore } from '@/store'
// import { Button } from '@/components/ui/button'

// export const Route = createFileRoute('/_navbarLayout/po/receipt')({
//   component: RouteComponent,
// })

// function RouteComponent() {
//   const navigate = useNavigate()
//   const webcamRef = useRef<Webcam>(null)
//   const setReceipt = useFormStore((state) => state.setReceipt)
//   const receipt = useFormStore((state) => state.receipt)
//   // const fleetCardNumber = useFormStore((state) => state.fleetCardNumber)
//   // const poNumber = useFormStore((state) => state.poNumber)
//   const customerName = useFormStore((state) => state.customerName)
//   const driverName = useFormStore((state) => state.driverName)
//   const vehicleInfo = useFormStore((state) => state.vehicleInfo)
//   const quantity = useFormStore((state) => state.quantity)
//   const amount = useFormStore((state) => state.amount)
//   const fuelType = useFormStore((state) => state.fuelType)
//   const date = useFormStore((state) => state.date)
//   // const [imageSize, setImageSize] = useState<number | null>(null)

//   useEffect(() => {
//     if (!date || !customerName || !driverName || !vehicleInfo || !fuelType || quantity === 0 || amount === 0) {
//       navigate({ to: "/po" })
//     }
//   }, [date, customerName, driverName, vehicleInfo, fuelType, quantity, amount, navigate])

//   const capture = () => {
//     if (webcamRef.current) {
//       const imageSrc = webcamRef.current.getScreenshot()
//       if (imageSrc) {
//         setReceipt(imageSrc)
//         // const sizeInBytes = (imageSrc.length * (3 / 4)) - (imageSrc.endsWith('==') ? 2 : (imageSrc.endsWith('=') ? 1 : 0))
//         // setImageSize(sizeInBytes)
//       }
//     }
//   }

//   const handleRetry = () => {
//     setReceipt('') // Clear the receipt
//     // setImageSize(null) // Reset the image size
//   }

//   const videoConstraints = {
//     height: 640,
//     facingMode: "environment"
//   };

//   return (
//     <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
//       {/* Receipt Capture Section */}
//       <div className="space-y-2">
//         <h2 className="text-lg font-bold">Capture Receipt</h2>
//         <div className="space-y-4">
//           {/* Keep the Webcam component mounted */}
//           <Webcam
//             ref={webcamRef}
//             screenshotFormat="image/jpeg"
//             videoConstraints={videoConstraints}
//             className={`border border-dashed border-gray-300 rounded-md ${receipt ? 'hidden' : 'block'}`}
//           />
//           {receipt && (
//             <img src={receipt} alt="Captured" className="border border-dashed border-gray-300 rounded-md" />
//           )}
//           {receipt ? (
//             <Button onClick={handleRetry} variant="secondary">
//               Retry
//             </Button>
//           ) : (
//             <Button onClick={capture} variant="destructive">
//               Capture
//             </Button>
//           )}
//         </div>
//       </div>

//       <hr className="border-t border-dashed border-gray-300" />

//       {/* Navigation Section */}
//       <div className="flex justify-between">
//         <Link to="/po">
//           <Button variant="outline">Back</Button>
//         </Link>
//         <Link to="/po/signature">
//           <Button variant="outline">Next</Button>
//         </Link>
//       </div>
//     </div>
//   )
// }
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { uploadBase64Image } from "@/lib/utils";
import { domain } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef } from 'react'
import Webcam from "react-webcam"
import { useFormStore } from '@/store'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/_navbarLayout/po/receipt')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const { user } = useAuth();

  const setReceipt = useFormStore((state) => state.setReceipt);
  const receipt = useFormStore((state) => state.receipt);

  const fleetCardNumber = useFormStore((state) => state.fleetCardNumber);
  const poNumber = useFormStore((state) => state.poNumber);
  const customerName = useFormStore((state) => state.customerName);
  const driverName = useFormStore((state) => state.driverName);
  const vehicleInfo = useFormStore((state) => state.vehicleInfo);
  const quantity = useFormStore((state) => state.quantity);
  const amount = useFormStore((state) => state.amount);
  const fuelType = useFormStore((state) => state.fuelType);
  const date = useFormStore((state) => state.date);

  useEffect(() => {
    if (!date || !customerName || !driverName || !vehicleInfo || !fuelType || quantity === 0 || amount === 0) {
      navigate({ to: "/po" });
    }
  }, [date, customerName, driverName, vehicleInfo, fuelType, quantity, amount]);

  const capture = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) setReceipt(imageSrc);
    }
  };

  const handleRetry = () => setReceipt("");

  const videoConstraints = {
    height: 640,
    facingMode: "environment",
  };

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

      // ---- Fleet Card Logic (unchanged) ----
      if (fleetCardNumber) {
        let fleetData = null;
        try {
          const fleetResponse = await authAxios(() =>
            axios.get(`${domain}/api/fleet/getByCardNumber/${fleetCardNumber}`, { headers: authHeaders })
          );
          fleetData = fleetResponse.data;
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status !== 404) throw err;
        }

        if (fleetData && !fleetData.message) {
          await authAxios(() =>
            axios.put(
              `${domain}/api/fleet/updateByCardNumber/${fleetCardNumber}`,
              {
                customerName,
                driverName,
                vehicleMakeModel: vehicleInfo,
              },
              { headers: authHeaders }
            )
          );
        } else {
          await authAxios(() =>
            axios.post(
              `${domain}/api/fleet/create`,
              {
                fleetCardNumber,
                customerName,
                driverName,
                vehicleMakeModel: vehicleInfo,
              },
              { headers: authHeaders }
            )
          );
        }
      }

      const stationName = user?.location || "Rankin";

      // ---- Submit PO without signature ----
      const poResponse = await authAxios(() =>
        axios.post(
          `${domain}/api/purchase-orders`,
          {
            source: "PO",
            date,
            stationName,
            fleetCardNumber: fleetCardNumber || "",
            poNumber: poNumber || "",
            quantity,
            amount,
            productCode: fuelType,
            trx: "",
            signature: "", // <<<<<< NO SIGNATURE
            receipt: filename,
            customerName,
            driverName,
            vehicleInfo,
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
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Capture Receipt</h2>
        <div className="space-y-4">
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className={`border border-dashed border-gray-300 rounded-md ${receipt ? "hidden" : "block"}`}
          />

          {receipt && (
            <img src={receipt} alt="Captured" className="border border-dashed border-gray-300 rounded-md" />
          )}

          {receipt ? (
            <Button onClick={handleRetry} variant="secondary">
              Retry
            </Button>
          ) : (
            <Button onClick={capture} variant="destructive">
              Capture
            </Button>
          )}
        </div>
      </div>

      <hr className="border-t border-dashed border-gray-300" />

      <div className="flex justify-between">
        <Link to="/po">
          <Button variant="outline">Back</Button>
        </Link>

        {/* 🚀 NEW SUBMIT BUTTON HERE */}
        <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
          {submitMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </div>
    </div>
  );
}