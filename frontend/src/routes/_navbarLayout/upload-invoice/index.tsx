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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InvoiceVendorSelect,
  EDI_VENDORS_CONFIG,
  type VendorData,
} from "@/components/custom/invoiceVendorSelect";
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

  const handleVendorChange = (selectedCode: string) => {
    const ediConfig = EDI_VENDORS_CONFIG[selectedCode];

    if (ediConfig) {
      // Check if the current site is in the exclusion list
      const isExcluded = ediConfig.excludedSites.includes(site);

      // If the site is NOT excluded, EDI is active -> Block upload and show notice
      if (!isExcluded) {
        const isEdiForAllStores = ediConfig.excludedSites.length === 0;

        alert(
          `Notice: You do not need to upload invoices for ${ediConfig.name}.\n\n` +
            `Invoices for this vendor are automatically received and processed directly in the back office system for ${
              isEdiForAllStores ? "all stores" : site
            }.`,
        );

        // Clear vendor field selection
        setVendorCode("");
        setVendorName("");
        return;
      }
    }

    // If the store IS excluded (or vendor isn't in config), allow normal selection
    setVendorCode(selectedCode);
  };

  // -----------------------------------------------------
  // 🚀 Submission Pipeline
  // -----------------------------------------------------
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
        alert(`${json.message}`);
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
              <InvoiceVendorSelect
                vendors={vendors}
                value={vendorCode}
                onValueChange={handleVendorChange}
                disabled={isLoadingVendors}
              />
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
