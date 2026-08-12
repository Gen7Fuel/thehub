import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import axios from "axios";
import { toast } from "sonner"; // or your preferred toast library

export const SORTED_DISPLAY_GRADES = [
  { id: "REG", label: "Regular", lookup: "Regular" },
  { id: "MID", label: "Mid Grade", lookup: "Mid Grade" },
  { id: "PNL", label: "Premium", lookup: "Premium" },
  { id: "DSL", label: "Diesel", lookup: "Diesel" },
  { id: "DYED", label: "Dyed Diesel", lookup: "Dyed Diesel" },
];

export const getFormGradeTheme = (grade: string) => {
  switch (grade) {
    case "Regular":
      return "bg-green-500 text-white";
    case "Premium":
      return "bg-red-500 text-white";
    case "Mid Grade":
      return "bg-gradient-to-r from-green-500 to-red-500 text-white";
    case "Diesel":
      return "bg-amber-400 text-slate-900";
    case "Dyed Diesel":
      return "bg-red-800 text-white";
    default:
      return "bg-slate-600 text-white";
  }
};

export const formatStationTimestamp = (
  dateString: string | undefined,
  timeZoneString: string | undefined,
) => {
  if (!dateString) return "";
  try {
    const dateObj = new Date(dateString);
    return dateObj
      .toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timeZoneString || undefined,
      })
      .replace(",", "");
  } catch (e) {
    return "";
  }
};

export const formatRawStationString = (dateTimeStr: string | undefined) => {
  if (!dateTimeStr || dateTimeStr === "N/A") return "";
  try {
    const [datePart, timePart] = dateTimeStr.split("T");
    if (!timePart) return dateTimeStr;

    const [hour, minute] = timePart.split(":");
    const [, month, day] = datePart.split("-");
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const monthLabel = months[parseInt(month, 10) - 1];

    return `${monthLabel} ${day} ${hour}:${minute}`;
  } catch (e) {
    return dateTimeStr || "";
  }
};

export interface UseFuelPricingOptions {
  user: any;
  selectedSite: string;
}

export function useFuelPricing({ user, selectedSite }: UseFuelPricingOptions) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const access = user?.access || {};
  const canUpdateFuelPricing = access?.fuelPricing?.setFuelPrice;

  // Local state
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [editScheduledPrices, setEditScheduledPrices] = useState<Record<string, string>>({});

  // Dialog Control States
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSchedulePickerOpen, setIsSchedulePickerOpen] = useState(false);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [isRemoveScheduleOpen, setIsRemoveScheduleOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");

  const authHeader = {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      "X-Required-Permission": "fuelPricing.setFuelPrice",
    },
  };

  const handleAxiosErrorCheck = (err: any) => {
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      navigate({ to: "/no-access" });
      return true;
    }
    return false;
  };

  // Query: Mongo Location Details
  const {
    data: dbLocation,
    isLoading: loadingMongo,
    isError: mongoError,
  } = useQuery({
    queryKey: ["location-by-name", selectedSite],
    queryFn: async () => {
      if (!selectedSite) return null;
      try {
        const res = await axios.get(
          `/api/locations/name/${encodeURIComponent(selectedSite)}`,
          authHeader,
        );
        return res.data;
      } catch (err) {
        if (handleAxiosErrorCheck(err)) return null;
        throw err;
      }
    },
    enabled: !!selectedSite,
  });

  const locationMongoId = dbLocation?._id;
  const stationTimeZone = dbLocation?.timezone;

  // Query: Active Postgres Prices
  const {
    data: activePostgresPrices,
    isLoading: loadingPostgres,
    refetch: reloadPostgres,
  } = useQuery({
    queryKey: ["postgres-current-prices", locationMongoId],
    queryFn: async () => {
      if (!locationMongoId) return null;
      try {
        const res = await axios.get(
          `/api/fuel-pricing/current/${locationMongoId}`,
          authHeader,
        );
        return res.data;
      } catch (err) {
        if (handleAxiosErrorCheck(err)) return null;
        throw err;
      }
    },
    enabled: !!locationMongoId && !!canUpdateFuelPricing,
  });

  // Derived Indicators
  const hasExistingSchedule = activePostgresPrices
    ? Object.values(activePostgresPrices).some(
        (g: any) => g?.scheduled !== null,
      )
    : false;

  const scheduledGrade: any = activePostgresPrices
    ? Object.values(activePostgresPrices).find(
        (g: any) => g?.scheduled?.scheduledAt,
      )
    : undefined;

  const activeScheduleTargetDate = scheduledGrade?.scheduled?.scheduledAt || "";

  // Query: Audit/History Logs (Desktop focused, available globally)
  const { data: historyLogPayload, isLoading: loadingLogs } = useQuery({
    queryKey: ["fuel-pricing-history-logs", locationMongoId],
    queryFn: async () => {
      if (!locationMongoId) return null;
      const res = await axios.get(
        `/api/fuel-pricing/logs/${locationMongoId}`,
        authHeader,
      );
      return res.data?.logs || [];
    },
    enabled: !!locationMongoId && isLogsOpen,
  });

  // Sync InputOTP fields and Date settings
  useEffect(() => {
    if (activePostgresPrices) {
      const initialFormValues: Record<string, string> = {};
      const initialEditValues: Record<string, string> = {};
      let rawBackendScheduledDate: string | null = null;

      SORTED_DISPLAY_GRADES.forEach((g) => {
        const rawRecord = activePostgresPrices[g.id];
        const livePriceVal =
          rawRecord && typeof rawRecord === "object"
            ? rawRecord.price
            : rawRecord;

        initialFormValues[g.id] = livePriceVal
          ? String(livePriceVal).replace(".", "")
          : "";

        if (
          rawRecord?.scheduled?.price !== undefined &&
          rawRecord?.scheduled?.price !== null
        ) {
          initialEditValues[g.id] = String(rawRecord.scheduled.price).replace(
            ".",
            "",
          );
          if (rawRecord.scheduled.scheduledAt) {
            rawBackendScheduledDate = rawRecord.scheduled.scheduledAt;
          }
        } else {
          initialEditValues[g.id] = livePriceVal
            ? String(livePriceVal).replace(".", "")
            : "";
        }
      });

      setPrices(initialFormValues);
      setEditScheduledPrices(initialEditValues);

      if (rawBackendScheduledDate) {
        setScheduledDateTime(String(rawBackendScheduledDate).slice(0, 16));
      } else if (activeScheduleTargetDate) {
        setScheduledDateTime(String(activeScheduleTargetDate).slice(0, 16));
      }
    } else {
      setPrices({});
      setEditScheduledPrices({});
    }
  }, [activePostgresPrices, activeScheduleTargetDate]);

  // Unified Mutation Architecture
  const submitPricesMutation = useMutation({
    mutationFn: async ({
      payload,
      method,
      route,
    }: {
      payload: any;
      method: "post" | "put" | "delete";
      route: string;
    }) => {
      if (method === "delete") {
        return (await axios.delete(route, authHeader)).data;
      }
      return (await axios[method](route, payload, authHeader)).data;
    },
    onSuccess: (_: any, variables: any) => {
      if (variables.method === "delete") {
        toast.success("Pending Pricing Schedule Deleted Successfully");
        setIsRemoveScheduleOpen(false);
      } else if (variables.method === "put") {
        toast.success("Pricing Schedule Updated Successfully");
        setIsEditScheduleOpen(false);
      } else {
        toast.success(
          isScheduled
            ? "Fuel Price Update Scheduled Successfully"
            : "Retail Fuel Prices Dispatched",
        );
        setIsConfirmOpen(false);
      }
      setIsScheduled(false);

      queryClient.invalidateQueries({
        queryKey: ["fuel-pricing-history-logs", locationMongoId],
      });
      reloadPostgres();
    },
    onError: (err: any) => {
      if (handleAxiosErrorCheck(err)) return;
      toast.error("Transmission Pipeline Operation Aborted");
    },
  });

  // Handlers & Helpers
  const handlePriceValueChange = (gradeId: string, inputString: string) => {
    setPrices((prev) => ({ ...prev, [gradeId]: inputString }));
  };

  const handleEditPriceValueChange = (gradeId: string, inputString: string) => {
    setEditScheduledPrices((prev) => ({ ...prev, [gradeId]: inputString }));
  };

  const validatePriceEntries = (targetPrices = prices) => {
    if (!locationMongoId) {
      toast.error("MongoDB context identification failed.");
      return false;
    }
    const dynamicEntries = Object.values(targetPrices).filter(
      (val) => val && val.length === 4,
    );
    if (dynamicEntries.length === 0) {
      toast.error("Please provide at least one complete 4-digit grade rate.");
      return false;
    }
    return true;
  };

  const handleOpenPublishNowConfirmation = () => {
    if (!validatePriceEntries()) return;
    setIsScheduled(false);
    setIsConfirmOpen(true);
  };

  const handleForwardScheduleToConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDateTime) {
      return toast.error("Please select a target date and time configuration.");
    }
    setIsScheduled(true);
    setIsSchedulePickerOpen(false);
    setIsConfirmOpen(true);
  };

  const handleExecuteConfirmedSubmission = () => {
    const parsedPricePayload: Record<string, number> = {};
    Object.entries(prices).forEach(([gradeId, rawString]) => {
      if (rawString && rawString.length === 4) {
        parsedPricePayload[gradeId] = parseFloat(
          `${rawString.slice(0, 1)}.${rawString.slice(1)}`,
        );
      }
    });

    submitPricesMutation.mutate({
      method: "post",
      route: "/api/fuel-pricing/upsert-retail",
      payload: {
        locationId: locationMongoId,
        stationName: selectedSite,
        prices: parsedPricePayload,
        isScheduled,
        scheduledDateTime: isScheduled ? scheduledDateTime : null,
      },
    });
  };

  const handleExecuteUpdateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePriceEntries(editScheduledPrices)) return;
    if (!scheduledDateTime) {
      return toast.error("Time zone configuration window blank.");
    }

    const parsedPricePayload: Record<string, number> = {};
    Object.entries(editScheduledPrices).forEach(([gradeId, rawString]) => {
      if (rawString && rawString.length === 4) {
        parsedPricePayload[gradeId] = parseFloat(
          `${rawString.slice(0, 1)}.${rawString.slice(1)}`,
        );
      }
    });

    submitPricesMutation.mutate({
      method: "put",
      route: "/api/fuel-pricing/edit-schedule-prices",
      payload: {
        locationId: locationMongoId,
        prices: parsedPricePayload,
        scheduledDateTime,
      },
    });
  };

  const handleExecuteDeleteSchedule = () => {
    submitPricesMutation.mutate({
      method: "delete",
      route: `/api/fuel-pricing/cancel-schedule/${locationMongoId}`,
      payload: null,
    });
  };

  const globalLoadingState =
    loadingMongo || (loadingPostgres && canUpdateFuelPricing);

  return {
    // States
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
    isLogsOpen,
    setIsLogsOpen,
    isScheduled,
    setIsScheduled,
    scheduledDateTime,
    setScheduledDateTime,
    
    // Data & Flags
    canUpdateFuelPricing,
    dbLocation,
    locationMongoId,
    stationTimeZone,
    activePostgresPrices,
    hasExistingSchedule,
    activeScheduleTargetDate,
    historyLogPayload,
    loadingLogs,
    globalLoadingState,
    mongoError,

    // Operations
    handlePriceValueChange,
    handleEditPriceValueChange,
    handleOpenPublishNowConfirmation,
    handleForwardScheduleToConfirmation,
    handleExecuteConfirmedSubmission,
    handleExecuteUpdateSchedule,
    handleExecuteDeleteSchedule,
    submitPricesMutation,
    reloadPostgres,
  };
}