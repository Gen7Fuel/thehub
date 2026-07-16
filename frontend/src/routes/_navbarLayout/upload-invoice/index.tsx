// import { useState, useRef, useEffect } from "react";
// import { createFileRoute, useNavigate } from "@tanstack/react-router";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { DatePicker } from "@/components/custom/datePicker";
// import {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectLabel,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { Camera, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
// import { domain } from "@/lib/constants";

// interface VendorData {
//   code: string;
//   name: string;
// }

// export const Route = createFileRoute("/_navbarLayout/upload-invoice/")({
//   component: RouteComponent,
// });

// function RouteComponent() {
//   const navigate = useNavigate();
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // ----------------------------------------------------
//   // Form Field States
//   // ----------------------------------------------------
//   const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
//   const [vendorCode, setVendorCode] = useState<string>("");
//   const [docNumber, setDocNumber] = useState<string>("");
//   const [mop, setMop] = useState<string>("");
//   const [checkNumber, setCheckNumber] = useState<string>("");
//   const [cost, setCost] = useState<number | "">("");

//   // Dynamic SQL-fed vendors state tracking
//   const [vendors, setVendors] = useState<VendorData[]>([]);
//   const [isLoadingVendors, setIsLoadingVendors] = useState<boolean>(true);

//   // ----------------------------------------------------
//   // Image Storage & Presentation States
//   // ----------------------------------------------------
//   const [invoiceImages, setInvoiceImages] = useState<string[]>([]);
//   const [currentCapture, setCurrentCapture] = useState<string>("");
//   const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

//   // 1. Add this new search state at the top of your component alongside other states:
//   const [vendorSearch, setVendorSearch] = useState<string>("");

//   // 2. Filter the vendors array based on the search query (matching against name or code)
//   const filteredVendors = vendors.filter(
//     (v) =>
//       v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
//       v.code.toLowerCase().includes(vendorSearch.toLowerCase()),
//   );

//   const paymentMethods = [
//     { value: "cash", label: "Cash" },
//     { value: "credit", label: "Credit" },
//     { value: "check", label: "Check" },
//     { value: "money_order", label: "Money Orders" },
//     { value: "eft", label: "EFT" },
//     { value: "credit_card", label: "Credit Card" },
//   ];

//   // Fetch the real-time Live SQL vendor records on assembly mount
//   useEffect(() => {
//     const fetchVendors = async () => {
//       try {
//         setIsLoadingVendors(true);
//         const token = localStorage.getItem("token");
//         const response = await fetch("/api/invoice-upload/vendors", {
//           headers: {
//             ...(token ? { Authorization: `Bearer ${token}` } : {}),
//           },
//         });
//         if (!response.ok) throw new Error(`HTTP error ${response.status}`);
//         const json = await response.json();
//         if (json.success && Array.isArray(json.vendors)) {
//           setVendors(json.vendors);
//         }
//       } catch (err) {
//         console.error(
//           "Failed downstream extraction of master vendor list profiles:",
//           err,
//         );
//       } finally {
//         setIsLoadingVendors(false);
//       }
//     };
//     fetchVendors();
//   }, []);

//   // Reset check number if method of payment shifts away from Check
//   useEffect(() => {
//     if (mop !== "check") {
//       setCheckNumber("");
//     }
//   }, [mop]);

//   // ----------------------------------------------------
//   // Camera & Image Logic
//   // ----------------------------------------------------
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onloadend = () => {
//         setCurrentCapture(reader.result as string);
//       };
//       reader.readAsDataURL(file);
//     }
//   };

//   const openNativeCamera = () => {
//     if (fileInputRef.current) {
//       fileInputRef.current.value = "";
//       fileInputRef.current.click();
//     }
//   };

//   const saveImage = () => {
//     if (currentCapture) {
//       setInvoiceImages([...invoiceImages, currentCapture]);
//       setCurrentCapture("");
//     }
//   };

//   const getImgSrc = (img: string) => {
//     if (img.startsWith("data:")) return img;
//     return `${domain || ""}/cdn/download/${encodeURIComponent(img)}`;
//   };

//   const handleRemoveImage = (idx: number) => {
//     const updated = invoiceImages.filter((_, i) => i !== idx);
//     setInvoiceImages(updated);

//     if (updated.length === 0) {
//       setGalleryIndex(null);
//     } else if (galleryIndex !== null && galleryIndex >= updated.length) {
//       setGalleryIndex(updated.length - 1);
//     }
//   };

//   // ----------------------------------------------------
//   // Submission Pipeline
//   // ----------------------------------------------------
//   const isFormValid =
//     invoiceDate &&
//     vendorCode &&
//     docNumber &&
//     mop &&
//     (mop !== "check" || checkNumber) &&
//     cost !== "" &&
//     cost > 0 &&
//     invoiceImages.length > 0;

//   const handleSubmit = async () => {
//     if (!isFormValid) return;

//     try {
//       setIsSubmitting(true);
//       console.log("Form Details:", {
//         invoiceDate,
//         vendorCode,
//         docNumber,
//         mop,
//         checkNumber,
//         cost,
//         invoiceImages,
//       });
//       alert("Invoice logged to store memory successfully!");
//     } catch (err) {
//       console.error("Failed to register backend invoice receiving:", err);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="w-full max-w-7xl px-4 py-4">
//       <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-8">
//         {/* Hidden Camera Upload Capture Interceptor */}
//         <input
//           type="file"
//           accept="image/*"
//           capture="environment"
//           ref={fileInputRef}
//           onChange={handleFileChange}
//           className="hidden"
//         />

//         {/* ---------------------------------------------------- */}
//         {/* TOP ROW: Responsive Form Input Bar                   */}
//         {/* ---------------------------------------------------- */}
//         <div>
//           <h2 className="text-base font-bold text-slate-800 mb-4">
//             Invoice Metadata
//           </h2>

//           {/* Dynamic 5-column grid layout across tablet/desktop environments */}
//           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
//             {/* Field 1: Invoice Date (Structured inside an isolated layout block to fix top labeling stack height issues) */}
//             <div className="flex flex-col space-y-1.5 w-full">
//               <span className="text-xs font-semibold text-slate-600">
//                 Invoice Date
//               </span>
//               <div className="w-full">
//                 <DatePicker
//                   date={invoiceDate}
//                   setDate={(val) =>
//                     typeof val === "function"
//                       ? setInvoiceDate(val(invoiceDate))
//                       : setInvoiceDate(val)
//                   }
//                 />
//               </div>
//             </div>

//             {/* Field 2: Vendor Lookup Dropdown with Live Search */}
//             <div className="space-y-1.5">
//               <label className="text-xs font-semibold text-slate-600">
//                 Vendor
//               </label>
//               <Select
//                 value={vendorCode}
//                 onValueChange={setVendorCode}
//                 disabled={isLoadingVendors}
//                 // Optional: Reset search filter when dropdown closes
//                 onOpenChange={(open) => {
//                   if (!open) setVendorSearch("");
//                 }}
//               >
//                 <SelectTrigger className="w-full bg-white">
//                   <SelectValue
//                     placeholder={
//                       isLoadingVendors ? "Loading vendors..." : "Select Vendor"
//                     }
//                   />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {/* Sticky Search Input Box at the top of the dropdown list */}
//                   <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
//                     <Input
//                       type="text"
//                       placeholder="Search vendor or code..."
//                       value={vendorSearch}
//                       onChange={(e) => setVendorSearch(e.target.value)}
//                       className="h-8 text-xs bg-slate-50 focus-visible:ring-indigo-500"
//                       // Crucial: Stop click propagation so selecting/typing in the input
//                       // doesn't accidentally trigger the Radix Select wrapper close events
//                       onKeyDown={(e) => e.stopPropagation()}
//                     />
//                   </div>

//                   <SelectGroup className="max-h-[250px] overflow-y-auto pt-1">
//                     <SelectLabel>Available Vendors</SelectLabel>
//                     {filteredVendors.length === 0 ? (
//                       <div className="text-xs text-slate-400 text-center py-4">
//                         No vendors found
//                       </div>
//                     ) : (
//                       filteredVendors.map((v) => (
//                         <SelectItem key={v.code} value={v.code}>
//                           {v.name} ({v.code})
//                         </SelectItem>
//                       ))
//                     )}
//                   </SelectGroup>
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Field 3: Document Number Field */}
//             <div className="space-y-1.5">
//               <label className="text-xs font-semibold text-slate-600">
//                 Document #
//               </label>
//               <Input
//                 type="text"
//                 placeholder="Enter doc number"
//                 value={docNumber}
//                 onChange={(e) => setDocNumber(e.target.value)}
//               />
//             </div>

//             {/* Field 4: Method of Payment Wrapper */}
//             <div className="space-y-1.5">
//               <label className="text-xs font-semibold text-slate-600">
//                 Method of Payment
//               </label>
//               <Select value={mop} onValueChange={setMop}>
//                 <SelectTrigger className="w-full bg-white">
//                   <SelectValue placeholder="Select MOP" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectGroup>
//                     <SelectLabel>Payment Types</SelectLabel>
//                     {paymentMethods.map((m) => (
//                       <SelectItem key={m.value} value={m.value}>
//                         {m.label}
//                       </SelectItem>
//                     ))}
//                   </SelectGroup>
//                 </SelectContent>
//               </Select>
//             </div>

//             {/* Field 5: Cost Field */}
//             <div className="space-y-1.5">
//               <label className="text-xs font-semibold text-slate-600">
//                 Total Cost
//               </label>
//               <Input
//                 type="number"
//                 placeholder="Amount ($)"
//                 value={cost === "" ? "" : cost}
//                 min="0"
//                 step="0.01"
//                 onChange={(e) =>
//                   setCost(e.target.value === "" ? "" : Number(e.target.value))
//                 }
//               />
//             </div>
//           </div>

//           {/* Conditional Sub-Field: Check Number Verification Input */}
//           {mop === "check" && (
//             <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg max-w-sm space-y-1.5 animate-in fade-in duration-200">
//               <label className="text-xs font-semibold text-slate-700">
//                 Check No. <span className="text-red-500">*</span>
//               </label>
//               <Input
//                 type="text"
//                 placeholder="Enter Check #"
//                 value={checkNumber}
//                 onChange={(e) => setCheckNumber(e.target.value)}
//                 required
//               />
//             </div>
//           )}
//         </div>

//         <hr className="border-slate-100" />

//         {/* ---------------------------------------------------- */}
//         {/* BOTTOM ROW: Image Capture & Drop Box Component       */}
//         {/* ---------------------------------------------------- */}
//         <div className="space-y-4">
//           <h2 className="text-base font-bold text-slate-800">
//             Invoice Documentation
//           </h2>

//           {currentCapture ? (
//             /* Live Camera Sandbox Preview Node */
//             <div className="relative w-full h-[45vh] max-h-[50vh] border border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
//               <img
//                 src={currentCapture}
//                 alt="Captured preview snapshot"
//                 className="max-w-full max-h-full object-contain"
//               />
//               <div className="absolute bottom-4 left-4 right-4 flex gap-3 max-w-md mx-auto">
//                 <Button
//                   onClick={saveImage}
//                   className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md"
//                 >
//                   Keep Photo
//                 </Button>
//                 <Button
//                   onClick={openNativeCamera}
//                   variant="secondary"
//                   className="flex-1 shadow-md"
//                 >
//                   Retake
//                 </Button>
//               </div>
//             </div>
//           ) : (
//             /* Action Trigger Box when no active snapshot is buffered */
//             <Button
//               onClick={openNativeCamera}
//               variant="outline"
//               className="w-full h-36 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50 transition-colors flex flex-col gap-2 rounded-xl"
//             >
//               <Camera className="h-7 w-7 text-slate-400" />
//               <span className="text-sm font-medium text-slate-600">
//                 Tap to Scan/Capture Invoice Page
//               </span>
//             </Button>
//           )}

//           {/* Captured Array Grid Reel */}
//           {invoiceImages.length > 0 && (
//             <div className="space-y-3 pt-2">
//               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
//                 Captured Pages ({invoiceImages.length})
//               </h3>
//               <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
//                 {invoiceImages.map((img, idx) => (
//                   <div
//                     key={idx}
//                     className="relative aspect-[3/4] group border border-slate-200 rounded-xl p-1 bg-white shadow-sm"
//                   >
//                     <img
//                       src={getImgSrc(img)}
//                       alt={`Page snapshot count entry ${idx + 1}`}
//                       className="w-full h-full object-cover rounded-lg cursor-pointer transition-transform active:scale-95"
//                       onClick={() => setGalleryIndex(idx)}
//                     />
//                     <Button
//                       variant="destructive"
//                       size="icon"
//                       className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md border border-white"
//                       onClick={() => handleRemoveImage(idx)}
//                     >
//                       <X className="h-3.5 w-3.5" />
//                     </Button>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Form Formality Actions Bar Footer */}
//         <div className="flex justify-end pt-4 border-t border-slate-100">
//           <Button
//             onClick={handleSubmit}
//             disabled={!isFormValid || isSubmitting}
//             className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 disabled:text-slate-400"
//           >
//             {isSubmitting ? (
//               <>
//                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                 Processing...
//               </>
//             ) : (
//               "Submit Invoice"
//             )}
//           </Button>
//         </div>
//       </div>

//       {/* ---------------------------------------------------- */}
//       {/* INTERACTIVE GALLERY LIGHTBOX MODULE                  */}
//       {/* ---------------------------------------------------- */}
//       <Dialog
//         open={galleryIndex !== null}
//         onOpenChange={() => setGalleryIndex(null)}
//       >
//         <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4 bg-slate-900 border-none text-white">
//           <DialogHeader>
//             <DialogTitle className="text-xs text-slate-400 font-normal">
//               Viewing Page {galleryIndex !== null ? galleryIndex + 1 : 0} of{" "}
//               {invoiceImages.length}
//             </DialogTitle>
//           </DialogHeader>

//           <div className="flex-1 flex flex-col items-center justify-center min-h-0 space-y-4">
//             <div className="relative w-full flex-1 min-h-0 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden">
//               {galleryIndex !== null && (
//                 <img
//                   src={getImgSrc(invoiceImages[galleryIndex])}
//                   alt="Expanded Modal Viewer Detail View"
//                   className="max-w-full max-h-[55vh] object-contain"
//                 />
//               )}
//             </div>

//             {/* Gallery Navigation Pagination Control Bars */}
//             {invoiceImages.length > 1 && (
//               <div className="flex items-center gap-6">
//                 <Button
//                   onClick={() =>
//                     setGalleryIndex((prev) =>
//                       prev !== null
//                         ? (prev - 1 + invoiceImages.length) %
//                           invoiceImages.length
//                         : null,
//                     )
//                   }
//                   variant="ghost"
//                   className="text-white hover:bg-white/10"
//                 >
//                   <ChevronLeft className="h-4 w-4 mr-1" /> Prev
//                 </Button>
//                 <span className="text-xs font-mono text-slate-300">
//                   {galleryIndex !== null ? galleryIndex + 1 : 0} /{" "}
//                   {invoiceImages.length}
//                 </span>
//                 <Button
//                   onClick={() =>
//                     setGalleryIndex((prev) =>
//                       prev !== null ? (prev + 1) % invoiceImages.length : null,
//                     )
//                   }
//                   variant="ghost"
//                   className="text-white hover:bg-white/10"
//                 >
//                   Next <ChevronRight className="h-4 w-4 ml-1" />
//                 </Button>
//               </div>
//             )}

//             {/* Item Context Options */}
//             <div className="flex gap-3 w-full sm:w-auto">
//               <Button
//                 variant="destructive"
//                 className="flex-1 sm:flex-none min-w-[125px]"
//                 onClick={() =>
//                   galleryIndex !== null && handleRemoveImage(galleryIndex)
//                 }
//               >
//                 Delete Photo
//               </Button>
//               <Button
//                 variant="secondary"
//                 className="flex-1 sm:flex-none min-w-[125px] bg-slate-800 text-white hover:bg-slate-700 border-none"
//                 onClick={() => setGalleryIndex(null)}
//               >
//                 Close View
//               </Button>
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>
//     </div>
//   );
// }

import { useState, useRef, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/custom/datePicker";
import { useSite } from "@/context/SiteContext";
import { LocationPicker } from "@/components/custom/locationPicker";
import { useAuth } from "@/context/AuthContext";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface VendorData {
  code: string;
  name: string;
}

export const Route = createFileRoute("/_navbarLayout/upload-invoice/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedSite } = useSite();
  const [site, setSite] = useState(selectedSite || user?.location || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // Form Field States
  // ----------------------------------------------------
  const [invoiceDate, setInvoiceDate] = useState<Date | undefined>(new Date());
  const [vendorCode, setVendorCode] = useState<string>("");
  const [vendorName, setVendorName] = useState<string>("");
  const [vendorSearch, setVendorSearch] = useState<string>("");
  const [docNumber, setDocNumber] = useState<string>("");
  const [mop, setMop] = useState<string>("");
  const [checkNumber, setCheckNumber] = useState<string>("");
  const [cost, setCost] = useState<number | "">("");

  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState<boolean>(true);

  // ----------------------------------------------------
  // Image Storage & Presentation States
  // ----------------------------------------------------
  const [invoiceImages, setInvoiceImages] = useState<string[]>([]); // Holds Base64 strings
  const [currentCapture, setCurrentCapture] = useState<string>("");
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const paymentMethods = [
    { value: "cash", label: "Cash" },
    { value: "credit", label: "Credit" },
    { value: "check", label: "Check" },
    { value: "money_order", label: "Money Orders" },
    { value: "eft", label: "EFT" },
    { value: "credit_card", label: "Credit Card" },
  ];

  // Filter vendors based on search input (Code or Name)
  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.code.toLowerCase().includes(vendorSearch.toLowerCase()),
  );

  // Fetch Live SQL Vendors on Mount
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setIsLoadingVendors(true);
        const token = localStorage.getItem("token");
        const response = await fetch("/api/invoice-upload/vendors", {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.success && Array.isArray(json.vendors)) {
          setVendors(json.vendors);
        }
      } catch (err) {
        console.error("Failed fetching master vendor list:", err);
      } finally {
        setIsLoadingVendors(false);
      }
    };
    fetchVendors();
  }, []);

  // Reset check number if mop changes; Update vendorName when vendorCode changes
  useEffect(() => {
    if (mop !== "check") setCheckNumber("");

    if (vendorCode) {
      const match = vendors.find((v) => v.code === vendorCode);
      if (match) {
        setVendorName(match.name);
      }
    } else {
      setVendorName("");
    }
  }, [mop, vendorCode, vendors]);

  // ----------------------------------------------------
  // 🚀 Camera & Image Helpers (Restored)
  // ----------------------------------------------------
  const openNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getImgSrc = (imgStr: string): string => {
    if (!imgStr) return "";
    if (imgStr.startsWith("data:") || imgStr.startsWith("http")) return imgStr;
    // Fallback context if string is just a generic relative token
    return `/cdn/download/${imgStr}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCurrentCapture(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const saveImage = () => {
    if (currentCapture) {
      setInvoiceImages([...invoiceImages, currentCapture]);
      setCurrentCapture("");
    }
  };

  const handleRemoveImage = (idx: number) => {
    const updated = invoiceImages.filter((_, i) => i !== idx);
    setInvoiceImages(updated);
    if (updated.length === 0) setGalleryIndex(null);
    else if (galleryIndex !== null && galleryIndex >= updated.length)
      setGalleryIndex(updated.length - 1);
  };

  // ----------------------------------------------------
  // 🚀 Submission Pipeline
  // ----------------------------------------------------
  // Add "site" to the validation criteria
  const isFormValid =
    site && // 🚀 Enforces that a location is actively selected
    invoiceDate &&
    vendorCode &&
    docNumber &&
    mop &&
    (mop !== "check" || checkNumber) &&
    cost !== "" &&
    cost > 0 &&
    invoiceImages.length > 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    try {
      setIsSubmitting(true);

      const payload = {
        siteName: site, // 🚀 Explicitly passing station name (e.g. "Station Alpha")
        invoiceDate: invoiceDate
          ? invoiceDate.toISOString()
          : new Date().toISOString(),
        vendorCode,
        vendorName,
        docNumber,
        methodOfPayment: mop,
        checkNumber: mop === "check" ? checkNumber : null,
        totalCost: Number(cost),
        invoiceImages,
      };

      const token = localStorage.getItem("token");
      const response = await fetch("/api/invoice-upload/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `Server Error ${response.status}`);
      }

      if (json.success) {
        alert(
          `${json.message}`,
        );
        navigate({ to: "/upload-invoice/list" });
      }
    } catch (err: any) {
      console.error("Final submission pipeline failure:", err);
      alert(
        `Submission Failed:\n${err.message || "An unexpected error occurred saving invoice."}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl px-4 py-4">
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-8">
        {/* Hidden Camera Input */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Form Grid */}
        <div>
          <h2 className="text-base font-bold text-slate-800 mb-4">
            Invoice Metadata
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
            {/* 🚀 Field 0: Location Picker Wrapper */}
            <div className="flex flex-col space-y-1.5 w-full">
              <span className="text-xs font-semibold text-slate-600">
                Selected Station
              </span>
              <LocationPicker
                setStationName={setSite}
                value="stationName"
                defaultValue={site}
              />
            </div>

            {/* Field 1: Invoice Date */}
            <div className="flex flex-col space-y-1.5 w-full">
              <span className="text-xs font-semibold text-slate-600">
                Invoice Date
              </span>
              <DatePicker
                date={invoiceDate}
                setDate={(val) =>
                  typeof val === "function"
                    ? setInvoiceDate(val(invoiceDate))
                    : setInvoiceDate(val)
                }
              />
            </div>

            {/* Field 2: Vendor Lookup with Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                Vendor
              </label>
              <Select
                value={vendorCode}
                onValueChange={setVendorCode}
                disabled={isLoadingVendors}
                onOpenChange={(open) => !open && setVendorSearch("")}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue
                    placeholder={
                      isLoadingVendors ? "Loading..." : "Select Vendor"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <Input
                      type="text"
                      placeholder="Search name or code..."
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="h-8 text-xs"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectGroup className="max-h-[250px] overflow-y-auto">
                    <SelectLabel>Available Vendors</SelectLabel>
                    {filteredVendors.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-4">
                        No vendors found
                      </div>
                    ) : (
                      filteredVendors.map((v) => (
                        <SelectItem key={v.code} value={v.code}>
                          {v.name} ({v.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Field 3: Doc # */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                Document #
              </label>
              <Input
                type="text"
                placeholder="Enter doc number"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
              />
            </div>

            {/* Field 4: MOP */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                Method of Payment
              </label>
              <Select value={mop} onValueChange={setMop}>
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="Select MOP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Field 5: Cost */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                Total Cost
              </label>
              <Input
                type="number"
                placeholder="Amount ($)"
                value={cost === "" ? "" : cost}
                min="0"
                step="0.01"
                onChange={(e) =>
                  setCost(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
          </div>

          {/* Conditional Check Number */}
          {mop === "check" && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg max-w-sm space-y-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-slate-700">
                Check No. <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Enter Check #"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                required
              />
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* BOTTOM ROW: Image Capture & Drop Box Component */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-800">
            Invoice Documentation
          </h2>

          {currentCapture ? (
            <div className="relative w-full h-[45vh] max-h-[50vh] border border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
              <img
                src={currentCapture}
                alt="Captured preview snapshot"
                className="max-w-full max-h-full object-contain"
              />
              <div className="absolute bottom-4 left-4 right-4 flex gap-3 max-w-md mx-auto">
                <Button
                  onClick={saveImage}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md"
                >
                  Keep Photo
                </Button>
                <Button
                  onClick={openNativeCamera}
                  variant="secondary"
                  className="flex-1 shadow-md"
                >
                  Retake
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={openNativeCamera}
              variant="outline"
              className="w-full h-36 border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-slate-50 transition-colors flex flex-col gap-2 rounded-xl"
            >
              <Camera className="h-7 w-7 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                Tap to Scan/Capture Invoice Page
              </span>
            </Button>
          )}

          {/* Captured Array Grid Reel */}
          {invoiceImages.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Captured Pages ({invoiceImages.length})
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {invoiceImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-[3/4] group border border-slate-200 rounded-xl p-1 bg-white shadow-sm"
                  >
                    <img
                      src={getImgSrc(img)}
                      alt={`Page snapshot count entry ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg cursor-pointer transition-transform active:scale-95"
                      onClick={() => setGalleryIndex(idx)}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md border border-white"
                      onClick={() => handleRemoveImage(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          {!isFormValid && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg mr-4">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Please fill metadata and capture at least one image.</span>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-100 disabled:text-slate-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Submit Invoice"
            )}
          </Button>
        </div>
      </div>

      {/* Interactive Gallery Lightbox Modal */}
      <Dialog
        open={galleryIndex !== null}
        onOpenChange={() => setGalleryIndex(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4 bg-slate-900 border-none text-white">
          <DialogHeader>
            <DialogTitle className="text-xs text-slate-400 font-normal">
              Viewing Page {galleryIndex !== null ? galleryIndex + 1 : 0} of{" "}
              {invoiceImages.length}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col items-center justify-center min-h-0 space-y-4">
            <div className="relative w-full flex-1 min-h-0 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden">
              {galleryIndex !== null && (
                <img
                  src={getImgSrc(invoiceImages[galleryIndex])}
                  alt="Expanded Modal Viewer Detail View"
                  className="max-w-full max-h-[55vh] object-contain"
                />
              )}
            </div>

            {invoiceImages.length > 1 && (
              <div className="flex items-center gap-6">
                <Button
                  onClick={() =>
                    setGalleryIndex((prev) =>
                      prev !== null
                        ? (prev - 1 + invoiceImages.length) %
                          invoiceImages.length
                        : null,
                    )
                  }
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <span className="text-xs font-mono text-slate-300">
                  {galleryIndex !== null ? galleryIndex + 1 : 0} /{" "}
                  {invoiceImages.length}
                </span>
                <Button
                  onClick={() =>
                    setGalleryIndex((prev) =>
                      prev !== null ? (prev + 1) % invoiceImages.length : null,
                    )
                  }
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="destructive"
                className="flex-1 sm:flex-none min-w-[125px]"
                onClick={() =>
                  galleryIndex !== null && handleRemoveImage(galleryIndex)
                }
              >
                Delete Photo
              </Button>
              <Button
                variant="secondary"
                className="flex-1 sm:flex-none min-w-[125px] bg-slate-800 text-white hover:bg-slate-700 border-none"
                onClick={() => setGalleryIndex(null)}
              >
                Close View
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
