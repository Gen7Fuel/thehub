import { useState, useCallback, useEffect, useRef } from "react";
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Fuel,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  RotateCcw,
} from "lucide-react";
import Navbar from "@/components/custom/navbar";
import MaintenanceBanner from "@/components/custom/MaintenanceBanner";
import NotificationPopup from "@/components/custom/NotificationPopup";
import { OfflineBanner } from "@/components/custom/OfflineBanner";
import FuelPriceTicker from "@/components/custom/FuelPriceTicker";
import { getSocket } from "@/lib/websocket";
import axios from "axios";

import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { uploadBase64Image } from "@/lib/utils"; // Reusing your global utility file stream asset uploader

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_navbarLayout")({
  loader: () => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw redirect({ to: "/login" });
    }
    return null;
  },
  component: RouteComponent,
});

// Dynamic class lookup for fuel grade styles matching your internal layout parameters
const getGradePillBadgeStyle = (gradeLabel: string) => {
  switch (gradeLabel) {
    case "Regular":
    case "REG":
      return "bg-green-500 text-white";
    case "Premium":
    case "PNL":
      return "bg-red-500 text-white";
    case "Mid Grade":
    case "MID":
      return "bg-gradient-to-r from-green-500 to-red-500 text-white";
    case "Diesel":
    case "DSL":
      return "bg-amber-400 text-slate-900";
    case "Dyed Diesel":
    case "DYED":
      return "bg-red-800 text-white";
    default:
      return "bg-slate-600 text-white";
  }
};

// Clean labels mapping dictionary helper for layout standardization
const DISPLAY_LABELS: Record<string, string> = {
  REG: "Regular",
  MID: "Mid Grade",
  PNL: "Premium",
  DSL: "Diesel",
  DYED: "Dyed Diesel",
};

function RouteComponent() {
  const [isLocked, setIsLocked] = useState(false);
  const [maintDetails, setMaintDetails] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  // --- COMPONENT LEVEL MANAGEMENT MATRIX ---
  const [isPriceOverlayActive, setIsPriceOverlayActive] = useState(false);
  const [pricePayload, setPricePayload] = useState<{
    stationName: string;
    locationId: string;
    changedGrades: any[];
    unchangedGrades: any[];
    hasStructuralChanges: boolean;
    hasInfonet?: boolean; // Added support flag parameter here
    batchTimestamp?: string;
  } | null>(null);

  // Native hardware camera capture state machine tracking
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeUploadStep, setActiveUploadStep] = useState<
    "BULLOCH" | "INFONET" | null
  >(null);
  const [bullochBase64, setBullochBase64] = useState<string | null>(null);
  const [infonetBase64, setInfonetBase64] = useState<string | null>(null);
  const [showCameraPreviewMode, setShowCameraPreviewMode] = useState(false);

  // --- RE-HYDRATION AND INITIALIZATION SYSTEM ---
  const verifyPendingPriceStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(
        "/api/fuel-pricing/check-pending-verification",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.data?.requiresVerification && res.data?.payload) {
        setPricePayload(res.data.payload);
        setIsPriceOverlayActive(true);
      }
    } catch (err) {
      console.error(
        "Failed verifying outstanding verification status logs:",
        err,
      );
    }
  }, []);

  useEffect(() => {
    verifyPendingPriceStatus();
  }, [verifyPendingPriceStatus]);

  // Helper trigger to accurately handle which report snapshot is being targeted
  const triggerCameraHardwareCapture = (step: "BULLOCH" | "INFONET") => {
    setActiveUploadStep(step);
    fileInputRef.current?.click();
  };

  const handleNativeCameraCapture = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (activeUploadStep === "BULLOCH") {
          setBullochBase64(reader.result as string);
        } else if (activeUploadStep === "INFONET") {
          setInfonetBase64(reader.result as string);
        }
        setShowCameraPreviewMode(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // 2. Adjust verification mutations block
  const submitTerminalVerificationMutation = useMutation({
    mutationFn: async () => {
      if (!pricePayload) return;

      // Clean informational sweep logic pathway (Bypasses camera uploads entirely)
      if (!pricePayload.hasStructuralChanges) {
        setIsPriceOverlayActive(false);
        return;
      }

      // Determine strict conditions based on terminal flag configuration layout
      const requiresInfoNetUpload = pricePayload.hasInfonet !== false;

      if (requiresInfoNetUpload) {
        if (!bullochBase64 || !infonetBase64) {
          alert(
            "Please make sure you have taken pictures of BOTH the Bulloch and InfoNet reports before submitting.",
          );
          return;
        }
      } else {
        if (!bullochBase64) {
          alert(
            "Please make sure you have taken a picture of the Bulloch report before submitting.",
          );
          return;
        }
      }

      // Parallel processing setup updates execution variables cleanly
      const uploadPromises = [
        uploadBase64Image(
          bullochBase64,
          `bulloch_verification_${Date.now()}.jpg`,
        ),
      ];

      if (requiresInfoNetUpload && infonetBase64) {
        uploadPromises.push(
          uploadBase64Image(
            infonetBase64,
            `infonet_verification_${Date.now()}.jpg`,
          ),
        );
      }

      const [bullochRes, infonetRes] = await Promise.all(uploadPromises);

      const token = localStorage.getItem("token");
      await axios.put(
        "/api/fuel-pricing/verify-price-receipt",
        {
          locationId: pricePayload.locationId,
          filename: bullochRes.filename,
          // Pass null or clean empty string if site configuration bypasses infonet checks entirely
          infonetFilename: requiresInfoNetUpload ? infonetRes?.filename : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    },
    onSuccess: () => {
      setIsPriceOverlayActive(false);
      setBullochBase64(null);
      setInfonetBase64(null);
      setActiveUploadStep(null);
      setShowCameraPreviewMode(false);
      setPricePayload(null);
    },
    onError: (err: any) => {
      console.error("Audit lock release failure:", err);
      alert(
        "Something went wrong saving the report photos. Please check your network and try again.",
      );
    },
  });

  const handleStatusChange = useCallback((locked: boolean, details?: any) => {
    setIsLocked((prev) => {
      if (prev === locked) return prev;
      return locked;
    });
    if (details) setMaintDetails(details);
  }, []);

  const notificationSound = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    notificationSound.current = new Audio("/assets/sounds/notification1.mp3");
    notificationSound.current.volume = 0.5;
  }, []);

  const fetchUnreadSummary = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/notification/unread-summary", {
        headers: { Authorization: `Bearer ${token || ""}` },
      });

      const count = res.data.unreadCount;
      if (count > 0) {
        setUnreadCount(count);
        setShowPopup(true);
        if (notificationSound.current) {
          notificationSound.current.play().catch((err) => {
            console.warn("Audio play blocked by browser:", err);
          });
        }
      } else {
        setShowPopup(false);
      }
    } catch (err) {
      console.error("Error fetching unread summary", err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadSummary();
  }, [fetchUnreadSummary]);

  // --- CONNECTED REAL-TIME SOCKET OVERHAUL ---
  // Socket Listener remains uniform, capturing updates on top of state initializations
  useEffect(() => {
    const socket = getSocket();

    const handleNewNotification = () => {
      // console.log("🔔 New Notification Socket Hit");
      // Whenever ANY new notification hits, refresh the smart count
      fetchUnreadSummary();
      // Also update the navbar count
      window.dispatchEvent(new Event("notificationRead"));
    };

    const handleRetailPriceEvent = (data: any) => {
      console.log("⛽ Live Retail Price Event Synced: ", data);

      // Explicit conditional logic: Only open if changes occurred.
      // If it's a completely unchanged informational trigger, it won't force a persistence state
      setPricePayload(data);
      setIsPriceOverlayActive(true);
    };
    // 🚀 NEW: Clears and closes the dialog when another account verifies the pricing
    const handleRetailPriceVerifiedEvent = (data: { locationId: string }) => {
      console.log(
        "🔓 Pricing verification processed by another terminal session:",
        data,
      );

      // Safety verification: Ensure this matches the station the layout is managing
      setIsPriceOverlayActive(false);
      setBullochBase64(null);
      setInfonetBase64(null);
      setActiveUploadStep(null);
      setShowCameraPreviewMode(false);
      setPricePayload(null);
    };

    socket.on("new-notification", handleNewNotification);
    socket.on("retail-price-published", handleRetailPriceEvent);
    socket.on("retail-price-verified", handleRetailPriceVerifiedEvent); // 🚀 Bind new event handler

    return () => {
      socket.off("new-notification", handleNewNotification);
      socket.off("retail-price-published", handleRetailPriceEvent);
      socket.off("retail-price-verified", handleRetailPriceVerifiedEvent); // 🚀 Unbind event handler
    };
  }, [fetchUnreadSummary]);

  const handleDismiss = useCallback(async () => {
    setShowPopup(false);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/notification/dismiss-summary",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (err) {
      console.error("Error updating summary marker:", err);
    }
  }, []);

  const handleView = () => {
    handleDismiss();
    navigate({ to: "/notification" });
  };

  return (
    <div className="flex flex-col min-h-screen relative">
      <Navbar />
      <OfflineBanner />

      {/* 2. Real-time Permissions-Scoped Fuel Pricing Marquee */}
      <FuelPriceTicker />

      {showPopup && (
        <NotificationPopup
          message={`You have ${unreadCount} new notification${unreadCount > 1 ? "s" : ""} on the Hub.`}
          onClose={handleDismiss}
          onView={handleView}
        />
      )}

      <div className="flex flex-col flex-1">
        <MaintenanceBanner onStatusChange={handleStatusChange} />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      {/* Camera Capture Input element configured for tablet lens overrides */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={fileInputRef}
        onChange={handleNativeCameraCapture}
      />

      <Dialog
        open={isPriceOverlayActive}
        onOpenChange={(open) => {
          // If the user tries to close the modal by clicking outside or hitting ESC,
          // open will be false. Intercept it here and do nothing.
          if (!open) return;
        }}
      >
        <DialogContent
          className="max-w-2xl bg-white border border-slate-200 shadow-2xl p-6 rounded-3xl gap-4 flex flex-col justify-between"
          // onPointerDownOutside={(e: any) => e.preventDefault()}
          // onEscapeKeyDown={(e: any) => e.preventDefault()}
        >
          {/* CAMERA INTERCEPT PREVIEW OVERLAY VIEW */}
          {showCameraPreviewMode ? (
            <div className="space-y-4 animate-in fade-in duration-200 flex flex-col justify-between h-full">
              <DialogHeader>
                <DialogTitle className="text-md font-black tracking-tight text-slate-900 uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <span>
                    Check Your Photo:{" "}
                    {activeUploadStep === "BULLOCH"
                      ? "Bulloch Report"
                      : "InfoNet Report"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-slate-400">
                  Make sure the numbers in the picture match your computer
                  screen before clicking confirm.
                </DialogDescription>
              </DialogHeader>

              <div className="w-full h-[40vh] bg-slate-950 rounded-2xl overflow-hidden relative border border-slate-800">
                <img
                  src={
                    activeUploadStep === "BULLOCH"
                      ? bullochBase64 || ""
                      : infonetBase64 || ""
                  }
                  alt="Captured Terminal Receipt Preview"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitTerminalVerificationMutation.isPending}
                  className="flex-1 rounded-xl border-slate-200 gap-1.5 font-bold"
                >
                  <RotateCcw className="w-4 h-4" /> Retake Photo
                </Button>
                <Button
                  onClick={() => setShowCameraPreviewMode(false)}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold tracking-tight shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> This Looks Good
                </Button>
              </div>
            </div>
          ) : (
            // MASTER COMPONENT PRICING SUMMARY VIEW
            <>
              <div>
                <DialogHeader className="space-y-1.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-50 rounded-xl border border-sky-100">
                      <Fuel className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-black tracking-tight text-slate-900 uppercase">
                        New Fuel Prices:{" "}
                        <span className="text-sky-600 normal-case">
                          {pricePayload?.stationName}
                        </span>
                      </DialogTitle>
                      <DialogDescription className="text-xs font-semibold text-slate-400">
                        New gas price data has been sent to your station logs.
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Main scroll container tracking grade configurations */}
                <div className="space-y-4 max-h-[42vh] overflow-y-auto pr-1 select-none mt-4 scrollbar-thin">
                  {/* SECTION 1: CHANGED GRADE MATRICES */}
                  {pricePayload && pricePayload.changedGrades?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-black tracking-wider text-red-600 uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Updated Prices:
                      </h4>

                      <div className="grid gap-2">
                        {pricePayload.changedGrades.map((item: any) => (
                          <div
                            key={item.gradeId}
                            className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-2xl shadow-sm transition-all"
                          >
                            <span
                              className={`text-xs font-black w-28 h-7 flex items-center justify-center text-center rounded-md tracking-wider uppercase shrink-0 ${getGradePillBadgeStyle(item.gradeId)}`}
                            >
                              {DISPLAY_LABELS[item.gradeId] || item.label}
                            </span>

                            <div className="flex items-center gap-4 text-sm font-bold tracking-tight">
                              <div className="text-slate-400">
                                <span className="text-[10px] uppercase font-bold tracking-wide mr-1">
                                  Old:
                                </span>
                                <span className="line-through font-mono">
                                  {item.oldPrice
                                    ? `$${Number(item.oldPrice).toFixed(3)}`
                                    : "—"}
                                </span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300" />
                              <div className="text-slate-900 bg-red-50/60 px-3 py-1 rounded-xl border border-red-100/60 flex items-center">
                                <span className="text-[10px] uppercase font-black tracking-wide text-red-500 mr-1.5">
                                  New:
                                </span>
                                <span className="text-base font-black font-mono tracking-tight text-red-600">
                                  ${Number(item.newPrice).toFixed(3)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: UNCHANGED GRADE MATRICES */}
                  {pricePayload && pricePayload.unchangedGrades?.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-black tracking-wider text-amber-600 uppercase flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Unchanged Prices:
                      </h4>

                      <div className="grid gap-2">
                        {pricePayload.unchangedGrades.map((item: any) => (
                          <div
                            key={item.gradeId}
                            className="flex items-center justify-between p-2.5 bg-slate-50/60 border border-slate-200/60 rounded-2xl"
                          >
                            <span
                              className={`text-[11px] font-extrabold w-28 h-6 flex items-center justify-center text-center rounded-md tracking-wide uppercase opacity-75 shrink-0 ${getGradePillBadgeStyle(item.gradeId)}`}
                            >
                              {DISPLAY_LABELS[item.gradeId] || item.label}
                            </span>

                            <div className="flex items-center gap-2">
                              <div className="text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm font-mono text-xs font-black tracking-tight">
                                ${Number(item.newPrice).toFixed(3)}
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200/40">
                                Same Price
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DYNAMIC ACTION FOOTER LOGIC PATHWAY */}
              <div className="pt-4 border-t border-slate-100 mt-2">
                {pricePayload?.hasStructuralChanges ? (
                  // LOGIC BLOCK A: CAMERA ACTION PANEL (MANDATORY SNAPSHOTS REQUIRED)
                  <div className="space-y-3 bg-red-50/60 p-4 rounded-2xl border border-red-100/60">
                    {/* ⚠️ INITIAL INSTRUCTION PANEL */}
                    {((pricePayload?.hasInfonet !== false &&
                      (!bullochBase64 || !infonetBase64)) ||
                      (pricePayload?.hasInfonet === false &&
                        !bullochBase64)) && (
                      <div className="flex items-start gap-2.5 text-left pb-1">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs font-bold leading-normal text-red-800">
                          {pricePayload?.hasInfonet !== false ? (
                            <span>
                              Please update the fuel prices on your physical
                              Bulloch terminal screen along with the Infonet
                              Terminal. Once finished, you must take and upload
                              photos of both reports below to unlock the app.
                            </span>
                          ) : (
                            <span>
                              Please update the fuel prices on your physical
                              Bulloch terminal screen. Once finished, you must
                              take and upload a photo of the Bulloch report
                              below to unlock the app.
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* PHOTO SNAPSHOT TRIGGERS */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <Button
                        onClick={() => triggerCameraHardwareCapture("BULLOCH")}
                        className={`flex-1 rounded-xl px-4 gap-2 font-black text-xs tracking-tight shadow-sm border whitespace-nowrap transition-all ${
                          bullochBase64
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Camera className="w-4 h-4 shrink-0" />
                        {bullochBase64
                          ? "✓ Bulloch Report Added"
                          : "Take Photo: Bulloch Report"}
                      </Button>

                      {/* InfoNet Button wrapper - dynamically managed visibility */}
                      {pricePayload?.hasInfonet !== false && (
                        <Button
                          onClick={() =>
                            triggerCameraHardwareCapture("INFONET")
                          }
                          className={`flex-1 rounded-xl px-4 gap-2 font-black text-xs tracking-tight shadow-sm border whitespace-nowrap transition-all ${
                            infonetBase64
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <Camera className="w-4 h-4 shrink-0" />
                          {infonetBase64
                            ? "✓ InfoNet Report Added"
                            : "Take Photo: InfoNet Report"}
                        </Button>
                      )}
                    </div>

                    {/* 🚀 NEW: SAFETY ESCAPE HATCH (Only displays when images haven't been uploaded locally yet) */}
                    {((pricePayload?.hasInfonet !== false &&
                      (!bullochBase64 || !infonetBase64)) ||
                      (pricePayload?.hasInfonet === false &&
                        !bullochBase64)) && (
                      <div className="pt-1 flex justify-end">
                        <Button
                          variant="ghost"
                          onClick={verifyPendingPriceStatus}
                          className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl px-3 h-8 gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Already Uploaded on Another Device?
                        </Button>
                      </div>
                    )}

                    {/* 🛑 POST-UPLOAD WARNING MATRIX: Shows when required uploads are gathered */}
                    {((pricePayload?.hasInfonet !== false &&
                      bullochBase64 &&
                      infonetBase64) ||
                      (pricePayload?.hasInfonet === false &&
                        bullochBase64)) && (
                      <>
                        <div className="mt-2 flex items-start gap-2.5 text-left bg-amber-50 border border-amber-200 p-3 rounded-xl animate-in fade-in slide-in-from-bottom-1 duration-200">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] font-bold leading-normal text-amber-900">
                            {pricePayload?.hasInfonet !== false ? (
                              <span>
                                Please make sure that the numbers on your
                                Bulloch register match the InfoNet register
                                screen perfectly. After you click the save
                                button below, check outside on the front pumps
                                and make sure the gas price changed correctly
                                out there too.
                              </span>
                            ) : (
                              <span>
                                Please make sure that the numbers on your
                                Bulloch register match your screen perfectly.
                                After you click the save button below, check
                                outside on the front pumps and make sure the gas
                                price changed correctly out there too.
                              </span>
                            )}
                          </p>
                        </div>

                        <Button
                          onClick={() =>
                            submitTerminalVerificationMutation.mutate()
                          }
                          disabled={
                            submitTerminalVerificationMutation.isPending
                          }
                          className="w-full mt-1 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs tracking-wider uppercase rounded-xl h-10 gap-1.5 shadow-md"
                        >
                          {submitTerminalVerificationMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />{" "}
                              Saving Reports...
                            </>
                          ) : (
                            "Save & Complete Verification"
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  // LOGIC BLOCK B: INFORMATIONAL SWEET CONFIRMATION
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                    <div className="flex items-start gap-2.5 text-left max-w-md">
                      <CheckCircle2 className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold leading-normal text-slate-500">
                        {pricePayload?.hasInfonet !== false ? (
                          <span>
                            No gas prices were changed during this update.
                            Please check the values above and confirm with the
                            values in bulloch and infonet reports. Click confirm
                            to close this message.
                          </span>
                        ) : (
                          <span>
                            No gas prices were changed during this update.
                            Please check the values above and confirm with the
                            values in the bulloch report. Click confirm to close
                            this message.
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        submitTerminalVerificationMutation.mutate()
                      }
                      className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black tracking-tight rounded-xl px-6 h-10 shadow-sm whitespace-nowrap"
                    >
                      I Confirm Prices match
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- FULL SCREEN LOCKDOWN OVERLAY --- */}
      {isLocked && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 border-t-8 border-red-600 p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600 w-10 h-10 animate-bounce" />
            </div>

            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
              System Lockdown
            </h2>

            <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              The Hub is currently undergoing essential maintenance to improve
              your experience. To protect your data, all interactions are paused
              until the update is complete.
            </p>

            {maintDetails?.scheduleClose ? (
              <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-5 flex items-center justify-center gap-4 mb-8 border border-slate-200 dark:border-slate-700">
                <Clock className="text-slate-400 w-6 h-6" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    Estimated Availability
                  </p>
                  <p className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
                    {new Date(maintDetails.scheduleClose).toLocaleTimeString(
                      [],
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 mb-8 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center justify-center gap-3 text-amber-700 dark:text-amber-500 mb-2">
                  <Clock className="w-5 h-5 animate-pulse" />
                  <span className="font-bold">Almost there!</span>
                </div>
                <p className="text-sm text-amber-800/80 dark:text-amber-400/80">
                  The update is taking slightly longer than expected. We are
                  finalizing the system and will be back online shortly.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full gap-2 border-slate-300 dark:border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                Check Status Again
              </Button>

              <p className="text-xs text-slate-400 italic">
                This page will automatically unlock once maintenance concludes.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// import { useState, useCallback, useEffect, useRef } from 'react'
// import { AlertTriangle, Clock, RefreshCw } from "lucide-react"
// import Navbar from '@/components/custom/navbar'
// import MaintenanceBanner from '@/components/custom/MaintenanceBanner'
// import NotificationPopup from '@/components/custom/NotificationPopup'
// import { getSocket } from "@/lib/websocket";
// import axios from 'axios'

// import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
// import { Button } from '@/components/ui/button'

// export const Route = createFileRoute('/_navbarLayout')({
//   loader: () => {
//     const token = localStorage.getItem('token')
//     if (!token) {
//       throw redirect({ to: '/login' })
//     }
//     return null
//   },
//   component: RouteComponent,
// })

// function RouteComponent() {
//   const [isLocked, setIsLocked] = useState(false);
//   const [maintDetails, setMaintDetails] = useState<any>(null);
//   const [showPopup, setShowPopup] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const navigate = useNavigate();
//   // to avoid needing isLocked in the dependency array.
//   const handleStatusChange = useCallback((locked: boolean, details?: any) => {
//     setIsLocked((prev) => {
//       if (prev === locked) return prev; // Avoid unnecessary state updates
//       return locked;
//     });

//     if (details) {
//       setMaintDetails(details);
//     }
//   }, []);

//   // Create a reference to the audio file
//   const notificationSound = useRef<HTMLAudioElement | null>(null);

//   useEffect(() => {
//     // Initialize the audio object once
//     notificationSound.current = new Audio('/assets/sounds/notification1.mp3');
//     // Optional: lower the volume so it's not startling
//     notificationSound.current.volume = 0.5;
//   }, []);

//   // --- SOCKET LISTENER ---
//   const fetchUnreadSummary = useCallback(async () => {
//     try {
//       const token = localStorage.getItem('token');
//       const res = await axios.get('/api/notification/unread-summary', {
//         headers: { Authorization: `Bearer ${token || ''}` }
//       });

//       const count = res.data.unreadCount;
//       if (count > 0) {
//         setUnreadCount(count);
//         setShowPopup(true);
//         // --- PLAY SOUND HERE ---
//         if (notificationSound.current) {
//           notificationSound.current.play().catch(err => {
//             // Browsers might block audio if no user interaction has happened yet
//             console.warn("Audio play blocked by browser:", err);
//           });
//         }
//       } else {
//         setShowPopup(false);
//       }
//     } catch (err) {
//       console.error("Error fetching unread summary", err);
//     }
//   }, []);

//   // Check on initial mount
//   useEffect(() => {
//     fetchUnreadSummary();
//   }, [fetchUnreadSummary]);

//   // Socket Listener
//   useEffect(() => {
//     const socket = getSocket();

//     const handleNewNotification = () => {
//       console.log("🔔 New Notification Socket Hit");
//       // Whenever ANY new notification hits, refresh the smart count
//       fetchUnreadSummary();
//       // Also update the navbar count
//       window.dispatchEvent(new Event('notificationRead'));
//     };

//     socket.on("new-notification", handleNewNotification);
//     return () => { socket.off("new-notification", handleNewNotification); };
//   }, [fetchUnreadSummary]);

//   const handleDismiss = useCallback(async () => {
//     setShowPopup(false);
//     try {
//       const token = localStorage.getItem('token');
//       await axios.post('/api/notification/dismiss-summary', {}, {
//         headers: { Authorization: `Bearer ${token}` }
//       });
//     } catch (err) {
//       console.error("Error updating summary marker:", err);
//     }
//   }, []);

//   // Update the View handler
//   const handleView = () => {
//     handleDismiss(); // Silence the popup
//     navigate({ to: '/notification' }); // Redirect
//   };

//   return (
//     <div className="flex flex-col min-h-screen relative">
//       {/* Navbar stays visible but is covered by the overlay if isLocked is true */}
//       <Navbar />

//       {/* --- NOTIFICATION POPUP OVERLAY --- */}
//       {showPopup && (
//         <NotificationPopup
//           message={`You have ${unreadCount} new notification${unreadCount > 1 ? 's' : ''} on the Hub.`}
//           onClose={handleDismiss} // Corrected: Uses the DB update logic
//           onView={handleView}       // Corrected: Uses the DB update + Navigate logic
//         />
//       )}

//       <div className="flex flex-col flex-1">
//         {/* We pass the state setter to the banner */}
//         <MaintenanceBanner onStatusChange={handleStatusChange} />

//         <main className="flex-1">
//           <Outlet />
//         </main>

//       </div>
//       {/* --- FULL SCREEN LOCKDOWN OVERLAY --- */}
//       {isLocked && (
//         <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden">
//           <div className="bg-white dark:bg-slate-900 border-t-8 border-red-600 p-10 rounded-3xl shadow-2xl max-w-lg w-full text-center animate-in fade-in zoom-in duration-300">

//             {/* Icon Section */}
//             <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
//               <AlertTriangle className="text-red-600 w-10 h-10 animate-bounce" />
//             </div>

//             <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
//               System Lockdown
//             </h2>

//             <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
//               The Hub is currently undergoing essential maintenance to improve your experience.
//               To protect your data, all interactions are paused until the update is complete.
//             </p>

//             {/* Estimated Time Card
//             {maintDetails?.scheduleClose && (
//               <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-5 flex items-center justify-center gap-4 mb-8 border border-slate-200 dark:border-slate-700">
//                 <Clock className="text-slate-400 w-6 h-6" />
//                 <div className="text-left">
//                   <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
//                     Estimated Availability
//                   </p>
//                   <p className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
//                     {new Date(maintDetails.scheduleClose).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                   </p>
//                 </div>
//               </div>
//             )} */}
//             {/* --- Updated Estimated Time Card Logic --- */}
//             {maintDetails?.scheduleClose ? (
//               <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-5 flex items-center justify-center gap-4 mb-8 border border-slate-200 dark:border-slate-700">
//                 <Clock className="text-slate-400 w-6 h-6" />
//                 <div className="text-left">
//                   <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
//                     Estimated Availability
//                   </p>
//                   <p className="font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
//                     {new Date(maintDetails.scheduleClose).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//                   </p>
//                 </div>
//               </div>
//             ) : (
//               /* This displays when the backend is unreachable AND we are past the beacon time */
//               <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-6 mb-8 border border-amber-200 dark:border-amber-800/50">
//                 <div className="flex items-center justify-center gap-3 text-amber-700 dark:text-amber-500 mb-2">
//                   <Clock className="w-5 h-5 animate-pulse" />
//                   <span className="font-bold">Almost there!</span>
//                 </div>
//                 <p className="text-sm text-amber-800/80 dark:text-amber-400/80">
//                   The update is taking slightly longer than expected. We are finalizing the system and will be back online shortly.
//                 </p>
//               </div>
//             )}

//             <div className="space-y-4">
//               <Button
//                 onClick={() => window.location.reload()}
//                 variant="outline"
//                 className="w-full gap-2 border-slate-300 dark:border-slate-700"
//               >
//                 <RefreshCw className="w-4 h-4" />
//                 Check Status Again
//               </Button>

//               <p className="text-xs text-slate-400 italic">
//                 This page will automatically unlock once maintenance concludes.
//               </p>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }
