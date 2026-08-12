import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSite } from "@/context/SiteContext";
import { useAuth } from "@/context/AuthContext";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import axios from "axios";
import {
  Coins,
  Loader2,
  AlertCircle,
  Save,
  ShieldAlert,
  Edit3,
  CalendarDays,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { LocationPicker } from "@/components/custom/locationPicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// export const Route = createFileRoute("/_navbarLayout/fuel-pricing-mobile")({
//   component: FuelPricingMobilePanel,
// });

// const SORTED_DISPLAY_GRADES = [
//   { id: "REG", label: "Regular", lookup: "Regular" },
//   { id: "MID", label: "Mid Grade", lookup: "Mid Grade" },
//   { id: "PNL", label: "Premium", lookup: "Premium" },
//   { id: "DSL", label: "Diesel", lookup: "Diesel" },
//   { id: "DYED", label: "Dyed Diesel", lookup: "Dyed Diesel" },
// ];

// export const getFormGradeTheme = (grade: string) => {
//   switch (grade) {
//     case "Regular":
//       return "bg-green-500 text-white";
//     case "Premium":
//       return "bg-red-500 text-white";
//     case "Mid Grade":
//       return "bg-gradient-to-r from-green-500 to-red-500 text-white";
//     case "Diesel":
//       return "bg-amber-400 text-slate-900";
//     case "Dyed Diesel":
//       return "bg-red-800 text-white";
//     default:
//       return "bg-slate-600 text-white";
//   }
// };

// const formatStationTimestamp = (
//   dateString: string | undefined,
//   timeZoneString: string | undefined,
// ) => {
//   if (!dateString) return "";
//   try {
//     const dateObj = new Date(dateString);
//     return dateObj
//       .toLocaleString("en-US", {
//         month: "short",
//         day: "2-digit",
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: false,
//         timeZone: timeZoneString || undefined,
//       })
//       .replace(",", "");
//   } catch (e) {
//     return "";
//   }
// };

// const formatRawStationString = (dateTimeStr: string | undefined) => {
//   if (!dateTimeStr || dateTimeStr === "N/A") return "";
//   try {
//     const [datePart, timePart] = dateTimeStr.split("T");
//     if (!timePart) return dateTimeStr;

//     const [hour, minute] = timePart.split(":");
//     const [, month, day] = datePart.split("-");
//     const months = [
//       "Jan",
//       "Feb",
//       "Mar",
//       "Apr",
//       "May",
//       "Jun",
//       "Jul",
//       "Aug",
//       "Sep",
//       "Oct",
//       "Nov",
//       "Dec",
//     ];
//     const monthLabel = months[parseInt(month, 10) - 1];

//     return `${monthLabel} ${day} ${hour}:${minute}`;
//   } catch (e) {
//     return dateTimeStr || "";
//   }
// };

// function FuelPricingMobilePanel() {
//   const { user } = useAuth();
//   const access = user?.access || {};
//   const queryClient = useQueryClient();
//   const { selectedSite, setSelectedSite } = useSite();

//   // Local site state connected with LocationPicker
//   const [_, setSite] = useState<string>(
//     selectedSite || user?.location || "",
//   );

//   // Sync LocationPicker selection directly to global SiteContext
//   const handleSiteChange = (newSite: string) => {
//     setSite(newSite);
//     if (setSelectedSite) {
//       setSelectedSite(newSite);
//     }
//   };

//   const [prices, setPrices] = useState<Record<string, string>>({});
//   const [editScheduledPrices, setEditScheduledPrices] = useState<
//     Record<string, string>
//   >({});

//   // Dialog states (Preserved exactly for the upcoming dialog inclusions)
//   const [isConfirmOpen, setIsConfirmOpen] = useState(false);
//   const [isSchedulePickerOpen, setIsSchedulePickerOpen] = useState(false);
//   const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
//   const [isRemoveScheduleOpen, setIsRemoveScheduleOpen] = useState(false);
//   //   const [isLogsOpen, _] = useState(false);

//   const [isScheduled, setIsScheduled] = useState(false);
//   const [scheduledDateTime, setScheduledDateTime] = useState("");

//   const navigate = useNavigate();
//   const canUpdateFuelPricing = access?.fuelPricing?.setFuelPrice;

//   const authHeader = {
//     headers: {
//       Authorization: `Bearer ${localStorage.getItem("token")}`,
//       "X-Required-Permission": "fuelPricing.setFuelPrice",
//     },
//   };

//   const handleAxiosErrorCheck = (err: any) => {
//     if (axios.isAxiosError(err) && err.response?.status === 403) {
//       navigate({ to: "/no-access" });
//       return true;
//     }
//     return false;
//   };

//   const {
//     data: dbLocation,
//     isLoading: loadingMongo,
//     isError: mongoError,
//   } = useQuery({
//     queryKey: ["location-by-name", selectedSite],
//     queryFn: async () => {
//       if (!selectedSite) return null;
//       try {
//         const res = await axios.get(
//           `/api/locations/name/${encodeURIComponent(selectedSite)}`,
//           authHeader,
//         );
//         return res.data;
//       } catch (err) {
//         if (handleAxiosErrorCheck(err)) return null;
//         throw err;
//       }
//     },
//     enabled: !!selectedSite,
//   });

//   const locationMongoId = dbLocation?._id;
//   const stationTimeZone = dbLocation?.timezone;

//   const {
//     data: activePostgresPrices,
//     isLoading: loadingPostgres,
//     refetch: reloadPostgres,
//   } = useQuery({
//     queryKey: ["postgres-current-prices", locationMongoId],
//     queryFn: async () => {
//       if (!locationMongoId) return null;
//       try {
//         const res = await axios.get(
//           `/api/fuel-pricing/current/${locationMongoId}`,
//           authHeader,
//         );
//         return res.data;
//       } catch (err) {
//         if (handleAxiosErrorCheck(err)) return null;
//         throw err;
//       }
//     },
//     enabled: !!locationMongoId && !!canUpdateFuelPricing,
//   });

//   const hasExistingSchedule = activePostgresPrices
//     ? Object.values(activePostgresPrices).some(
//         (g: any) => g?.scheduled !== null,
//       )
//     : false;

//   const scheduledGrade: any = activePostgresPrices
//     ? Object.values(activePostgresPrices).find(
//         (g: any) => g?.scheduled?.scheduledAt,
//       )
//     : undefined;

//   const activeScheduleTargetDate = scheduledGrade?.scheduled?.scheduledAt || "";

//   //   const { data: historyLogPayload, isLoading: loadingLogs } = useQuery({
//   //     queryKey: ["fuel-pricing-history-logs", locationMongoId],
//   //     queryFn: async () => {
//   //       if (!locationMongoId) return null;
//   //       const res = await axios.get(
//   //         `/api/fuel-pricing/logs/${locationMongoId}`,
//   //         authHeader,
//   //       );
//   //       return res.data?.logs || [];
//   //     },
//   //     enabled: !!locationMongoId && isLogsOpen,
//   //   });

//   useEffect(() => {
//     if (activePostgresPrices) {
//       const initialFormValues: Record<string, string> = {};
//       const initialEditValues: Record<string, string> = {};
//       let rawBackendScheduledDate: string | null = null;

//       SORTED_DISPLAY_GRADES.forEach((g) => {
//         const rawRecord = activePostgresPrices[g.id];
//         const livePriceVal =
//           rawRecord && typeof rawRecord === "object"
//             ? rawRecord.price
//             : rawRecord;

//         initialFormValues[g.id] = livePriceVal
//           ? String(livePriceVal).replace(".", "")
//           : "";

//         if (
//           rawRecord?.scheduled?.price !== undefined &&
//           rawRecord?.scheduled?.price !== null
//         ) {
//           initialEditValues[g.id] = String(rawRecord.scheduled.price).replace(
//             ".",
//             "",
//           );
//           if (rawRecord.scheduled.scheduledAt) {
//             rawBackendScheduledDate = rawRecord.scheduled.scheduledAt;
//           }
//         } else {
//           initialEditValues[g.id] = livePriceVal
//             ? String(livePriceVal).replace(".", "")
//             : "";
//         }
//       });

//       setPrices(initialFormValues);
//       setEditScheduledPrices(initialEditValues);

//       if (rawBackendScheduledDate) {
//         setScheduledDateTime(String(rawBackendScheduledDate).slice(0, 16));
//       } else if (activeScheduleTargetDate) {
//         setScheduledDateTime(String(activeScheduleTargetDate).slice(0, 16));
//       }
//     } else {
//       setPrices({});
//       setEditScheduledPrices({});
//     }
//   }, [activePostgresPrices, activeScheduleTargetDate]);

//   const submitPricesMutation = useMutation({
//     mutationFn: async ({
//       payload,
//       method,
//       route,
//     }: {
//       payload: any;
//       method: "post" | "put" | "delete";
//       route: string;
//     }) => {
//       if (method === "delete") {
//         return (await axios.delete(route, authHeader)).data;
//       }
//       return (await axios[method](route, payload, authHeader)).data;
//     },
//     onSuccess: (_: any, variables: any) => {
//       if (variables.method === "delete") {
//         toast.success("Pending Pricing Schedule Deleted Successfully");
//         setIsRemoveScheduleOpen(false);
//       } else if (variables.method === "put") {
//         toast.success("Pricing Schedule Updated Successfully");
//         setIsEditScheduleOpen(false);
//       } else {
//         toast.success(
//           isScheduled
//             ? "Fuel Price Update Scheduled Successfully"
//             : "Retail Fuel Prices Dispatched",
//         );
//         setIsConfirmOpen(false);
//       }
//       setIsScheduled(false);

//       queryClient.invalidateQueries({
//         queryKey: ["fuel-pricing-history-logs", locationMongoId],
//       });
//       reloadPostgres();
//     },
//     onError: (err: any) => {
//       if (handleAxiosErrorCheck(err)) return;
//       toast.error("Transmission Pipeline Operation Aborted");
//     },
//   });

//   const handlePriceValueChange = (gradeId: string, inputString: string) => {
//     setPrices((prev) => ({ ...prev, [gradeId]: inputString }));
//   };

//   const handleEditPriceValueChange = (gradeId: string, inputString: string) => {
//     setEditScheduledPrices((prev) => ({ ...prev, [gradeId]: inputString }));
//   };

//   const validatePriceEntries = (targetPrices = prices) => {
//     if (!locationMongoId) {
//       toast.error("MongoDB context identification failed.");
//       return false;
//     }
//     const dynamicEntries = Object.values(targetPrices).filter(
//       (val) => val && val.length === 4,
//     );
//     if (dynamicEntries.length === 0) {
//       toast.error("Please provide at least one complete 4-digit grade rate.");
//       return false;
//     }
//     return true;
//   };

//   const handleOpenPublishNowConfirmation = () => {
//     if (!validatePriceEntries()) return;
//     setIsScheduled(false);
//     setIsConfirmOpen(true);
//   };

//   const handleForwardScheduleToConfirmation = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!scheduledDateTime) {
//       return toast.error("Please select a target date and time configuration.");
//     }
//     setIsScheduled(true);
//     setIsSchedulePickerOpen(false);
//     setIsConfirmOpen(true);
//   };

//   const handleExecuteConfirmedSubmission = () => {
//     const parsedPricePayload: Record<string, number> = {};
//     Object.entries(prices).forEach(([gradeId, rawString]) => {
//       if (rawString && rawString.length === 4) {
//         parsedPricePayload[gradeId] = parseFloat(
//           `${rawString.slice(0, 1)}.${rawString.slice(1)}`,
//         );
//       }
//     });

//     submitPricesMutation.mutate({
//       method: "post",
//       route: "/api/fuel-pricing/upsert-retail",
//       payload: {
//         locationId: locationMongoId,
//         stationName: selectedSite,
//         prices: parsedPricePayload,
//         isScheduled,
//         scheduledDateTime: isScheduled ? scheduledDateTime : null,
//       },
//     });
//   };

//   const handleExecuteUpdateSchedule = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!validatePriceEntries(editScheduledPrices)) return;
//     if (!scheduledDateTime) {
//       return toast.error("Time zone configuration window blank.");
//     }

//     const parsedPricePayload: Record<string, number> = {};
//     Object.entries(editScheduledPrices).forEach(([gradeId, rawString]) => {
//       if (rawString && rawString.length === 4) {
//         parsedPricePayload[gradeId] = parseFloat(
//           `${rawString.slice(0, 1)}.${rawString.slice(1)}`,
//         );
//       }
//     });

//     submitPricesMutation.mutate({
//       method: "put",
//       route: "/api/fuel-pricing/edit-schedule-prices",
//       payload: {
//         locationId: locationMongoId,
//         prices: parsedPricePayload,
//         scheduledDateTime,
//       },
//     });
//   };

//   const handleExecuteDeleteSchedule = () => {
//     submitPricesMutation.mutate({
//       method: "delete",
//       route: `/api/fuel-pricing/cancel-schedule/${locationMongoId}`,
//       payload: null,
//     });
//   };

//   const globalLoadingState =
//     loadingMongo || (loadingPostgres && canUpdateFuelPricing);
import {
  useFuelPricing,
  SORTED_DISPLAY_GRADES,
  getFormGradeTheme,
  formatStationTimestamp,
  formatRawStationString,
} from "@/hooks/useFuelPricing";

export const Route = createFileRoute("/_navbarLayout/fuel-pricing-mobile")({
  component: FuelPricingMobilePanel,
});

function FuelPricingMobilePanel() {
  const { user } = useAuth();
  const { selectedSite, setSelectedSite } = useSite();

  const [_, setSite] = useState<string>(selectedSite || user?.location || "");

  const handleSiteChange = (newSite: string) => {
    setSite(newSite);
    if (setSelectedSite) {
      setSelectedSite(newSite);
    }
  };

  const pricingState = useFuelPricing({ user, selectedSite });

  const {
    prices,
    editScheduledPrices,
    isConfirmOpen,
    setIsConfirmOpen,
    isSchedulePickerOpen,
    setIsSchedulePickerOpen,
    isEditScheduleOpen,
    setIsEditScheduleOpen,
    isRemoveScheduleOpen,
    setIsRemoveScheduleOpen,
    isScheduled,
    setIsScheduled,
    scheduledDateTime,
    setScheduledDateTime,
    canUpdateFuelPricing,
    dbLocation,
    stationTimeZone,
    activePostgresPrices,
    hasExistingSchedule,
    globalLoadingState,
    mongoError,
    handlePriceValueChange,
    handleEditPriceValueChange,
    handleOpenPublishNowConfirmation,
    handleForwardScheduleToConfirmation,
    handleExecuteConfirmedSubmission,
    handleExecuteUpdateSchedule,
    handleExecuteDeleteSchedule,
    submitPricesMutation,
  } = pricingState;

  return (
    <div className="h-full w-full bg-slate-50/50 p-3 flex flex-col overflow-hidden select-none">
      {/* MOBILE HEADER - LOCATION PICKER DROPDOWN INTEGRATION */}
      <div className="pb-3 border-b border-slate-200/60 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black tracking-wide text-slate-700 uppercase flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Fuel Pricing Module</span>
          </h2>
        </div>

        {/* SITE SELECTOR DROPDOWN */}
        <div className="w-full">
          <LocationPicker
            setStationName={(val) => {
              const nextSite =
                typeof val === "function" ? val(selectedSite) : val;
              handleSiteChange(nextSite);
            }}
            value="stationName"
            defaultValue={selectedSite} // (or site)
          />
        </div>
      </div>

      {globalLoadingState && (
        <div className="p-6 text-center text-xs font-semibold text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
          Consolidating fuel pricing sheets...
        </div>
      )}

      {mongoError && (
        <div className="mt-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          Could not sync details for "{selectedSite}".
        </div>
      )}

      {/* REJECTION SCREEN */}
      {!globalLoadingState && !canUpdateFuelPricing && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 mt-2 rounded-2xl border border-dashed border-slate-200 bg-white/50">
          <div className="p-3 bg-rose-50 rounded-full border border-rose-100 mb-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Access Restrictions Enforced
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-xs mt-1 leading-relaxed">
            You do not have access to set new fuel prices. Kindly contact the
            administrator for more information.
          </p>
        </div>
      )}

      {/* MAIN MOBILE FORM VIEW */}
      {!globalLoadingState && canUpdateFuelPricing && dbLocation && (
        <div className="flex-1 min-h-0 mt-2">
          <div className="h-full overflow-y-auto pr-0.5 space-y-2.5 max-h-[calc(100vh-140px)] scrollbar-thin pb-4">
            {SORTED_DISPLAY_GRADES.map((grade) => {
              const isSellsGrade = dbLocation.availableGrades?.includes(
                grade.lookup,
              );
              if (!isSellsGrade) return null;

              const liveDataRecord = activePostgresPrices?.[grade.id];
              const livePostgresVal = liveDataRecord?.price;
              const rawTimestamp = liveDataRecord?.updatedAt;
              const scheduledRecord = liveDataRecord?.scheduled;

              const localFormattedTime = formatStationTimestamp(
                rawTimestamp,
                stationTimeZone,
              );

              const localFormattedScheduledTime = formatRawStationString(
                scheduledRecord?.scheduledAt,
              );

              const cleanInputString = prices[grade.id] || "";
              const formattedLiveCompareString = livePostgresVal
                ? String(livePostgresVal).replace(".", "")
                : "";
              const isUnchangedValue =
                cleanInputString !== "" &&
                cleanInputString === formattedLiveCompareString;

              return (
                <Card
                  key={grade.id}
                  className="border border-slate-200/80 shadow-sm bg-white overflow-hidden rounded-xl"
                >
                  <CardContent className="py-2 px-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 w-full text-slate-700">
                      <span
                        className={`text-[10px] font-black py-0.5 rounded tracking-wide uppercase shrink-0 w-24 inline-flex items-center justify-center ${getFormGradeTheme(
                          grade.lookup,
                        )}`}
                      >
                        {grade.label}
                      </span>

                      <div className="flex-1 flex items-center justify-end text-right">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            Cur:
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {livePostgresVal
                              ? `$${Number(livePostgresVal).toFixed(3)}`
                              : "—"}
                          </span>
                          {localFormattedTime && (
                            <span className="text-[11px] font-medium text-slate-400 ml-1 tabular-nums whitespace-nowrap inline-block">
                              ({localFormattedTime})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* TARGET OTP INPUT ROW */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          Target Input
                        </span>
                        {isUnchangedValue && (
                          <span className="text-[10px] font-bold text-amber-500 normal-case">
                            (unchanged)
                          </span>
                        )}
                      </div>

                      <InputOTP
                        maxLength={4}
                        value={cleanInputString}
                        onChange={(val) =>
                          handlePriceValueChange(grade.id, val)
                        }
                      >
                        <InputOTPGroup className="bg-white">
                          <InputOTPSlot
                            index={0}
                            className="w-8 h-8 text-xs font-black border-slate-200 focus:border-blue-500 rounded-l-md"
                          />
                        </InputOTPGroup>
                        <InputOTPSeparator className="text-slate-400 font-bold text-xs mx-0.5" />
                        <InputOTPGroup className="bg-white">
                          <InputOTPSlot
                            index={1}
                            className="w-8 h-8 text-xs font-bold border-slate-200"
                          />
                          <InputOTPSlot
                            index={2}
                            className="w-8 h-8 text-xs font-bold border-slate-200"
                          />
                          <InputOTPSlot
                            index={3}
                            className="w-8 h-8 text-xs font-bold border-slate-200 rounded-r-md"
                          />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>

                    {/* BOTTOM ANCHOR SCHEDULE VIEW */}
                    {scheduledRecord && (
                      <div className="mt-1 pt-1.5 border-t border-dashed border-slate-100 text-xs text-amber-600 font-bold flex items-center justify-between w-full">
                        <span className="uppercase tracking-tight text-[10px] text-slate-400 font-extrabold">
                          Scheduled Price:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-amber-600 bg-amber-50/70 px-1.5 py-0.5 rounded border border-amber-200/50">
                            ${Number(scheduledRecord.price).toFixed(3)}
                          </span>
                          {localFormattedScheduledTime && (
                            <span className="font-medium text-slate-400 font-mono text-xs tracking-tight">
                              ({localFormattedScheduledTime})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* ACTION BUTTONS */}
            {dbLocation.availableGrades?.length > 0 && (
              <div className="flex flex-col gap-2 w-full pt-2">
                <Button
                  type="button"
                  onClick={handleOpenPublishNowConfirmation}
                  className="w-full h-10 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all shadow-md gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Publish Now
                </Button>

                {hasExistingSchedule ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditScheduleOpen(true)}
                    className="w-full h-10 border border-amber-300 hover:border-amber-500 hover:bg-amber-50 text-amber-700 text-xs font-bold rounded-xl transition-all shadow-sm gap-1.5 bg-white"
                  >
                    <Edit3 className="h-4 w-4 text-amber-600" />
                    Edit Existing Schedule
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSchedulePickerOpen(true)}
                    className="w-full h-10 border border-slate-300 hover:border-sky-500 hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-xs font-bold rounded-xl transition-all shadow-sm gap-1.5 bg-white"
                  >
                    <CalendarDays className="h-4 w-4 text-slate-500" />
                    Schedule Update
                  </Button>
                )}

                {hasExistingSchedule && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setIsRemoveScheduleOpen(true)}
                    className="w-full h-9 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove Existing Schedule
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        {/* STEP A: SCHEDULING CONFIGURATION DIALOG */}
        <Dialog
          open={isSchedulePickerOpen}
          onOpenChange={(open) => {
            setIsSchedulePickerOpen(open);
            if (!open) {
              setIsScheduled(false);
              setScheduledDateTime("");
            }
          }}
        >
          <DialogContent className="max-w-md bg-white rounded-2xl p-4 border border-slate-200 shadow-xl gap-3">
            <form
              onSubmit={handleForwardScheduleToConfirmation}
              className="space-y-3"
            >
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xs font-black tracking-wide text-slate-800 uppercase flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-sky-600" />
                  Set Date & Time for Price Change
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 font-medium">
                  Choose exactly when you want these new fuel prices to go live
                  at the station.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-1">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Select Date and Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold focus:border-sky-500 focus:outline-none bg-slate-50/50 shadow-inner"
                />
              </div>

              <div className="p-2.5 rounded-xl border border-sky-100 bg-sky-50/60 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <div className="text-[10px] font-bold text-sky-800 leading-normal space-y-0.5">
                  <div>
                    NOTE: The time you select will match the local time zone of
                    the station.
                  </div>
                  <div className="text-sky-600 font-black">
                    Station Time Zone:{" "}
                    {stationTimeZone || "Not Configured (Using UTC)"}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsSchedulePickerOpen(false);
                    setIsScheduled(false);
                    setScheduledDateTime("");
                  }}
                  className="h-8 border-slate-200 text-slate-600 font-bold text-[11px] px-3.5 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-8 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] px-3.5 rounded-lg shadow"
                >
                  Save Schedule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* STEP B: FINAL CONFIRMATION DIALOG */}
        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-4 border border-slate-200 shadow-xl gap-3">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xs font-black tracking-wide text-slate-800 uppercase">
                {isScheduled
                  ? "Confirm Scheduled Prices for"
                  : "Publish Live Prices for"}{" "}
                <span className="text-sky-600 normal-case uppercase">
                  {selectedSite}
                </span>
              </DialogTitle>
              <DialogDescription className="text-[11px] text-slate-400 font-medium">
                Please review the changes below before confirming.
              </DialogDescription>
            </DialogHeader>

            {isScheduled && scheduledDateTime && (
              <div className="p-2 px-3 rounded-xl border border-amber-200 bg-amber-50/50 text-[10px] font-black text-amber-800 flex items-center justify-between shadow-inner">
                <span className="uppercase tracking-wider">Goes Live On:</span>
                <span className="text-xs font-mono">
                  {scheduledDateTime.replace("T", " ")} ({stationTimeZone})
                </span>
              </div>
            )}

            <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50 p-1.5 space-y-1.5">
              {dbLocation &&
                SORTED_DISPLAY_GRADES.map((grade) => {
                  const isSellsGrade = dbLocation.availableGrades?.includes(
                    grade.lookup,
                  );
                  if (!isSellsGrade) return null;

                  const liveDataRecord = activePostgresPrices?.[grade.id];
                  const livePostgresVal = liveDataRecord?.price;

                  const cleanInputString = prices[grade.id] || "";
                  const formattedLiveCompareString = livePostgresVal
                    ? String(livePostgresVal).replace(".", "")
                    : "";
                  const isUnchangedValue =
                    cleanInputString !== "" &&
                    cleanInputString === formattedLiveCompareString;

                  let displayPrice = "—";
                  if (cleanInputString.length === 4) {
                    displayPrice = `$${cleanInputString.slice(0, 1)}.${cleanInputString.slice(1)}`;
                  }

                  return (
                    <div
                      key={grade.id}
                      className="flex items-center justify-between py-1.5 px-2 text-[11px] bg-white rounded-xl border border-slate-200/60 shadow-sm"
                    >
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase shrink-0 ${getFormGradeTheme(grade.lookup)}`}
                      >
                        {grade.label}
                      </span>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mr-1">
                            Current:
                          </span>
                          <span className="text-xs font-bold text-slate-500">
                            {livePostgresVal
                              ? `$${Number(livePostgresVal).toFixed(3)}`
                              : "—"}
                          </span>
                        </div>
                        <div className="border-l border-slate-200 pl-2.5 flex items-center gap-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                            New:
                          </span>
                          <span
                            className={`text-xs font-black tracking-tight ${isUnchangedValue ? "text-amber-600" : "text-slate-800"}`}
                          >
                            {displayPrice}
                          </span>
                          {isUnchangedValue && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase bg-amber-50 text-amber-600 border border-amber-200/60">
                              unchanged
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/60 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span className="text-[10px] font-bold text-rose-700 leading-normal">
                {isScheduled
                  ? "WARNING: Once confirmed, this price change will automatically update on the exact date and time shown above."
                  : "WARNING: Once confirmed, these changes will go live at the station immediately."}
              </span>
            </div>

            <DialogFooter className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                disabled={submitPricesMutation.isPending}
                onClick={() => setIsConfirmOpen(false)}
                className="h-8 border-slate-200 text-slate-600 font-bold text-[11px] px-3.5 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitPricesMutation.isPending}
                onClick={handleExecuteConfirmedSubmission}
                className="h-8 bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] px-3.5 rounded-lg gap-1.5 shadow"
              >
                {submitPricesMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                  </>
                ) : isScheduled ? (
                  "Schedule Update"
                ) : (
                  "Confirm & Go Live"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* STEP C: EDIT EXISTING SCHEDULE CONFIGURATION DIALOG */}
        <Dialog open={isEditScheduleOpen} onOpenChange={setIsEditScheduleOpen}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-4 border border-slate-200 shadow-xl gap-3">
            <form onSubmit={handleExecuteUpdateSchedule} className="space-y-3">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xs font-black tracking-wide text-slate-800 uppercase flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  Modify Scheduled Price Ledger
                </DialogTitle>
                <DialogDescription className="text-[11px] text-slate-400 font-medium">
                  Adjust values and target execution date settings for the
                  queued pipeline.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Execution Target Time ({stationTimeZone || "UTC"})
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2 text-xs font-semibold focus:outline-none focus:border-amber-500 bg-slate-50/50"
                />
              </div>

              <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-1.5 space-y-1.5 max-h-[220px] overflow-y-auto">
                {dbLocation &&
                  SORTED_DISPLAY_GRADES.map((grade) => {
                    const isSellsGrade = dbLocation.availableGrades?.includes(
                      grade.lookup,
                    );
                    if (!isSellsGrade) return null;

                    const cleanEditInput = editScheduledPrices[grade.id] || "";

                    return (
                      <div
                        key={grade.id}
                        className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200/80 shadow-sm"
                      >
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wide uppercase ${getFormGradeTheme(grade.lookup)}`}
                        >
                          {grade.label}
                        </span>

                        <InputOTP
                          maxLength={4}
                          value={cleanEditInput}
                          onChange={(val) =>
                            handleEditPriceValueChange(grade.id, val)
                          }
                        >
                          <InputOTPGroup className="bg-white scale-75 origin-right">
                            <InputOTPSlot
                              index={0}
                              className="w-8 h-8 text-xs font-black border-slate-200"
                            />
                          </InputOTPGroup>
                          <InputOTPSeparator className="text-slate-400 font-bold text-xs scale-75 mx-0" />
                          <InputOTPGroup className="bg-white scale-75 origin-right">
                            <InputOTPSlot
                              index={1}
                              className="w-8 h-8 text-xs font-bold border-slate-200"
                            />
                            <InputOTPSlot
                              index={2}
                              className="w-8 h-8 text-xs font-bold border-slate-200"
                            />
                            <InputOTPSlot
                              index={3}
                              className="w-8 h-8 text-xs font-bold border-slate-200 rounded-r-lg"
                            />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    );
                  })}
              </div>

              <DialogFooter className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditScheduleOpen(false)}
                  className="h-8 text-[11px] font-bold px-3.5 border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitPricesMutation.isPending}
                  className="h-8 text-[11px] font-bold px-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow gap-1"
                >
                  {submitPricesMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Update Schedule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* STEP D: REMOVE SCHEDULE CONFIRMATION DISCLAIMER DIALOG */}
        <Dialog
          open={isRemoveScheduleOpen}
          onOpenChange={setIsRemoveScheduleOpen}
        >
          <DialogContent className="max-w-md bg-white rounded-2xl p-4 border border-slate-200 shadow-xl gap-3">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xs font-black tracking-wide text-slate-800 uppercase flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                Delete Pending Pricing Schedule?
              </DialogTitle>
            </DialogHeader>

            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
              This action will remove the price update entirely. The planned
              fuel rate variations will be cleared from the queue, and you
              cannot go back on this action once performed.
            </p>

            <DialogFooter className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRemoveScheduleOpen(false)}
                className="h-8 text-[11px] font-bold px-3.5 border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={submitPricesMutation.isPending}
                onClick={handleExecuteDeleteSchedule}
                className="h-8 text-[11px] font-bold px-3.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow gap-1"
              >
                {submitPricesMutation.isPending && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                Confirm Deletion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
