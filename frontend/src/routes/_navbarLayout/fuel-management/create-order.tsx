import {
  useState,
  // useEffect, useMemo
} from "react";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fuelOrdersService } from '@/api/fuel-management/fuel-orders.service'
import { fuelGradeOptionsQuery } from '@/api/fuel-management/fuel-grades.service'
import { fuelRacksService } from '@/api/fuel-management/fuel-racks.service'
import { fuelStationTanksService } from '@/api/fuel-management/fuel-station-tanks.service'
import { fuelSuppliersService } from '@/api/fuel-management/fuel-suppliers.service'
import {
  Building2,
  Truck,
  Fuel,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Download,
  // Hash, Save,  CheckCircle2, Calendar, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getOrderGradeItems, getOrderTankGrade } from '@/lib/fuelOrderGrades'
import { PDFViewer, PDFDownloadLink, pdf } from "@react-pdf/renderer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  POPreviewDocument,
  formatPDFDate,
} from "@/components/custom/fuelPoPDF";

export const Route = createFileRoute(
  "/_navbarLayout/fuel-management/create-order",
)({
  component: CreateFuelOrder,
});

interface FuelOrderItem {
  grade: string;
  ltrs: number;
}

// 1. Define the structure of a single projection entry
interface GradeProjection {
  opening: number;
  sales: number;
  capacity: number;
  closing: number;
}

// 2. Define the split structure
interface StationSplit {
  stationId: string;
  poNumber: string;
  secondaryPoNumber: string;
  items: FuelOrderItem[];
  projections: Record<string, GradeProjection>; // Added here
}

interface FuelOrderFormData {
  stationId: string;
  orderDate: string;
  deliveryDate: string;
  startTime: string;
  endTime: string;
  rackId: string;
  supplierId: string;
  isMultiBadge: boolean; // New: Toggle state
  secondaryBadgeNo: string; // New: Store the selected second badge
  badgeNo: string;
  carrierId: string;
  poNumber: string;
  secondaryPoNumber: string; // NEW: Secondary PO (Single Mode)
  items: FuelOrderItem[];
  secondaryItems: FuelOrderItem[]; // NEW: To store quantities for the 2nd badge
  // Add these two to fix the TS error
  projections: Record<string, GradeProjection>;
  splits: StationSplit[];
  secondarySplits: StationSplit[]; // NEW: To store quantities for 2nd badge in splits
}

interface SupplierBadge {
  badgeName: string;
  badgeNumber: string;
  accountingId: string;
  availableGrades: string[]; // New field to define which grades this badge can access
  isDefault: boolean;
}

interface FuelSupplier {
  _id: string;
  supplierName: string;
  associatedRack: string;
  supplierBadges: SupplierBadge[]; // Array of badges inside the supplier
}

function CreateFuelOrder() {
  // --- State Management ---
  const [racks, setRacks] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);

  // Corrected: Suppliers should be an array of FuelSupplier objects
  const [suppliers, setSuppliers] = useState<FuelSupplier[]>([]);
  // --- 2. Submit Logic ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeSplitIdx, setActiveSplitIdx] = useState(0);
  const [activeBadgeIdx, setActiveBadgeIdx] = useState(0); // 0 = Badge 1, 1 = Badge 2

  const [preSelectedFields, setPreSelectedFields] = useState<string[]>([]);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);

  const [isSplit, setIsSplit] = useState(false);
  const [formData, setFormData] = useState<FuelOrderFormData>({
    stationId: "",
    orderDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    startTime: "08:00",
    endTime: "12:00",
    rackId: "",
    supplierId: "",
    isMultiBadge: false,
    secondaryBadgeNo: "",
    badgeNo: "",
    carrierId: "",
    poNumber: "",
    secondaryPoNumber: "", // NEW: Secondary PO (Single Mode)
    items: [],
    projections: {}, // Initialize as empty object
    splits: [
      {
        stationId: "",
        poNumber: "",
        secondaryPoNumber: "",
        items: [],
        projections: {},
      },
      {
        stationId: "",
        poNumber: "",
        secondaryPoNumber: "",
        items: [],
        projections: {},
      },
    ],
    secondaryItems: [],
    secondarySplits: [
      {
        stationId: "",
        poNumber: "",
        secondaryPoNumber: "",
        items: [],
        projections: {},
      },
      {
        stationId: "",
        poNumber: "",
        secondaryPoNumber: "",
        items: [],
        projections: {},
      },
    ],
  });

  // --- Fetch Locations using TanStack Query ---
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: ["locations-list"],
    queryFn: async () => {
      return fuelStationTanksService.listLocations<any[]>('fuel-management.create-order', 'Fuel order station options viewed', 'fuelManagement.createOrder');
    },
    staleTime: 0,
  });
  const gradeQuery = useQuery(fuelGradeOptionsQuery);
  const catalog = gradeQuery.data ?? [];
  const gradeByKey = new Map(catalog.map(grade => [grade.key, grade]));
  const selectedRack = racks.find(rack => rack._id === formData.rackId);
  const selectedSupplier = suppliers.find(supplier => supplier._id === formData.supplierId);
  const selectedCarrier = carriers.find(carrier => carrier._id === formData.carrierId);
  const primaryBadge = selectedSupplier?.supplierBadges.find(badge => badge.badgeNumber === formData.badgeNo);
  const secondaryBadge = selectedSupplier?.supplierBadges.find(badge => badge.badgeNumber === formData.secondaryBadgeNo);
  const rackGrades: string[] = selectedRack?.availableGrades ?? [];

  const orderStations = (isSplit ? formData.splits : [formData]).map((section, index) => {
    const station = locations.find(location => location._id === section.stationId);
    const stationGrades: string[] = station?.availableStationGrades ?? [];
    const secondaryQuantities = isSplit ? formData.secondarySplits[index].items : formData.secondaryItems;

    return {
      station,
      stationId: section.stationId,
      poNumber: section.poNumber,
      secondaryPoNumber: section.secondaryPoNumber,
      projections: section.projections,
      items: getOrderGradeItems(catalog, stationGrades, rackGrades, primaryBadge?.availableGrades ?? [], section.items),
      secondaryItems: formData.isMultiBadge
        ? getOrderGradeItems(catalog, stationGrades, rackGrades, secondaryBadge?.availableGrades ?? [], secondaryQuantities)
        : [],
    };
  });

  const handleStationChange = async (stationId: string, index: number) => {
    const station = locations.find((s: any) => s._id === stationId);
    if (!station) return;
    setFormData(prev => ({
      ...prev,
      splits: prev.splits.map((split, splitIndex) => splitIndex === index ? { ...split, stationId } : split),
    }));

    // 2. Global Logistics (Only for the first station/master)
    if (index === 0) {
      try {
        const rackOptions = await fuelRacksService.list<any[]>('fuel-management.create-order', 'Fuel rack options viewed while creating an order');
        setRacks(rackOptions);
        const defaultRackId =
          station.defaultFuelRack?._id || station.defaultFuelRack || "";
        const stationDefaultCarrierId =
          station.defaultFuelCarrier?._id || station.defaultFuelCarrier || "";

        setFormData((prev) => ({
          ...prev,
          stationId: stationId,
          rackId: defaultRackId,
          carrierId: stationDefaultCarrierId,
        }));

        if (defaultRackId) {
          await handleRackChange(
            defaultRackId,
            stationId,
            stationDefaultCarrierId,
          );
        }
        setPreSelectedFields(["rackId", "carrierId"]);
      } catch (err) {
        console.error("Master Station Logistics Error:", err);
      }
    }

    // Sync the PO and tank projections.
    await syncStationData(
      stationId,
      index,
      formData.orderDate,
      formData.deliveryDate,
    );
  };

  const handleRackChange = async (
    rackId: string,
    currentStationId?: string,
    passedCarrierId?: string,
    notifyCarrierFallback = false,
  ) => {
    try {
      const rack = await fuelRacksService.get<any>(rackId, 'fuel-management.create-order');
      const rackCarriers = rack.associatedCarriers || [];

      const rackSuppliers = await fuelSuppliersService.list<FuelSupplier[]>(rackId, 'fuel-management.create-order', `Fuel suppliers viewed for rack ${rackId} while creating an order`);

      setRacks(current => current.map(entry => entry._id === rackId ? rack : entry));
      setSuppliers(rackSuppliers);
      setCarriers(rackCarriers);

      // 1. Logistics Defaults (Supplier & Badge)
      // The rack endpoints populate defaultSupplier, so it may be either an
      // ObjectId string or the populated supplier object. Normalize it before
      // matching against the supplier list; otherwise we incorrectly fall
      // back to the first supplier for racks with multiple suppliers.
      const defaultSupplierId =
        typeof rack.defaultSupplier === "object"
          ? rack.defaultSupplier?._id
          : rack.defaultSupplier;
      const defaultSup =
        rackSuppliers.find((s: any) => s._id === defaultSupplierId) ||
        rackSuppliers[0];
      const defaultBadge =
        defaultSup?.supplierBadges?.find((b: any) => b.isDefault) ||
        defaultSup?.supplierBadges?.[0];

      // 2. Carrier Logic...
      const targetStationId = currentStationId || formData.stationId;
      const station = locations.find((s: any) => s._id === targetStationId);
      const carrierToVerify =
        passedCarrierId ||
        station?.defaultFuelCarrier?._id ||
        station?.defaultFuelCarrier ||
        "";
      const isAllowed = rackCarriers.some(
        (c: any) => c._id === carrierToVerify,
      );
      const finalCarrierId = isAllowed
        ? carrierToVerify
        : rackCarriers[0]?._id || "";

      if (notifyCarrierFallback && carrierToVerify && !isAllowed) {
        alert(
          "The default carrier of the station is not associated with the selected rack. Changing the carrier to an available carrier for that rack.",
        );
      }

      setFormData(prev => ({
        ...prev,
        rackId,
        supplierId: defaultSup?._id || "",
        badgeNo: defaultBadge?.badgeNumber || "",
        carrierId: finalCarrierId,
        isMultiBadge: false,
        secondaryBadgeNo: "",
        secondaryItems: [],
        secondarySplits: prev.secondarySplits.map(split => ({ ...split, items: [] })),
      }));
    } catch (err) {
      console.error("Error loading rack logistics:", err);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    const selectedSup = suppliers.find((s) => s._id === supplierId);
    const defaultBadge =
      selectedSup?.supplierBadges?.find((b) => b.isDefault) ||
      selectedSup?.supplierBadges?.[0];

    setFormData(prev => ({
      ...prev,
      supplierId,
      badgeNo: defaultBadge?.badgeNumber || "",
      isMultiBadge: false,
      secondaryBadgeNo: "",
      secondaryPoNumber: "",
      secondaryItems: [],
      secondarySplits: prev.secondarySplits.map(split => ({ ...split, items: [] })),
    }));
  };

  // ADD THIS HELPER ABOVE YOUR COMPONENT
  const getPONumberHelper = async (
    station: any,
    oDate: string,
    dDate: string,
  ) => {
    if (!station || !oDate || !dDate) return { po: "", finalOrderDate: oDate };

    const getFormattedPart = (dateStr: string) => {
      const dateObj = new Date(dateStr + "T00:00:00");
      const mm = (dateObj.getMonth() + 1).toString().padStart(2, "0");
      const dd = dateObj.getDate().toString().padStart(2, "0");
      const yy = dateObj.getFullYear().toString().slice(-2);
      return `${mm}${dd}${yy}`;
    };

    const formattedOrderDate = getFormattedPart(oDate);
    const stationNum = String(station.fuelStationNumber).padStart(2, "0");
    const poPrefix = `NSP${formattedOrderDate}-${stationNum}`;

    try {
      const { existingOrders = [] } = await fuelOrdersService.checkExisting<any>(station._id, oDate);
      const relevantOrders = existingOrders.filter((order: any) =>
        String(order.poNumber || "").startsWith(poPrefix),
      );
      const nextLoad =
        relevantOrders.reduce((maxLoad: number, order: any) => {
          const loadNumber = Number(
            String(order.poNumber || "").slice(poPrefix.length),
          );
          return Number.isFinite(loadNumber)
            ? Math.max(maxLoad, loadNumber)
            : maxLoad;
        }, 0) + 1;

      if (relevantOrders.length > 0) {
        const differentDeliveryDate = relevantOrders.find((order: any) => {
          if (!order.originalDeliveryDate) return false;
          const existingD = new Date(order.originalDeliveryDate)
            .toISOString()
            .split("T")[0];
          return existingD !== dDate;
        });

        const sameDeliveryDate = relevantOrders.find((order: any) => {
          if (!order.originalDeliveryDate) return false;
          const existingD = new Date(order.originalDeliveryDate)
            .toISOString()
            .split("T")[0];
          return existingD === dDate;
        });

        // Handle Multiple Loads same day
        if (sameDeliveryDate) {
          const confirm = window.confirm(
            `Station ${station.stationName}: Already a load for ${dDate}. Create Load #${nextLoad}?`,
          );
          if (!confirm) return { po: "", finalOrderDate: oDate };

          return {
            po: `${poPrefix}${nextLoad}`,
            finalOrderDate: oDate,
          };
        }

        // CRITICAL: Handle Date Shift
        if (differentDeliveryDate) {
          const tomorrow = new Date(oDate + "T00:00:00");
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];

          alert(
            `CRITICAL: Station ${station.stationName} has an order for this date with a different delivery date. Moving Order Date to tomorrow (${tomorrowStr}).`,
          );

          // Recursive call with new date
          return getPONumberHelper(station, tomorrowStr, dDate);
        }
      }

      // Default Case
      return {
        po: `${poPrefix}${nextLoad}`,
        finalOrderDate: oDate,
      };
    } catch (err) {
      console.error("PO Helper Error", err);
      return { po: "ERROR", finalOrderDate: oDate };
    }
  };

  // --- 1. Reset Logic ---
  const handleReset = () => {
    setFormData({
      stationId: "",
      orderDate: new Date().toISOString().split("T")[0],
      deliveryDate: "",
      startTime: "08:00",
      endTime: "12:00",
      rackId: "",
      supplierId: "",
      isMultiBadge: false,
      secondaryBadgeNo: "",
      badgeNo: "",
      carrierId: "",
      poNumber: "",
      secondaryPoNumber: "", // NEW: Secondary PO (Single Mode)
      items: [],
      projections: {}, // Initialize as empty object
      splits: [
        {
          stationId: "",
          poNumber: "",
          secondaryPoNumber: "",
          items: [],
          projections: {},
        },
        {
          stationId: "",
          poNumber: "",
          secondaryPoNumber: "",
          items: [],
          projections: {},
        },
      ],
      secondaryItems: [],
      secondarySplits: [
        {
          stationId: "",
          poNumber: "",
          secondaryPoNumber: "",
          items: [],
          projections: {},
        },
        {
          stationId: "",
          poNumber: "",
          secondaryPoNumber: "",
          items: [],
          projections: {},
        },
      ],
    });
    setRacks([]);
    setCarriers([]);
    setSuppliers([]);
    setIsSplit(false); // Reset to single mode
  };

  const handleSubmit = async () => {
    if (isSubmitting || !gradeQuery.isSuccess) return;

    // 1. Validation Logic
    if (isSplit) {
      const hasMissingSplit = formData.splits.some(
        (s) => !s.stationId || !s.poNumber,
      );
      const hasMissingSecondarySplit =
        formData.isMultiBadge &&
        formData.splits.some((s) => !s.secondaryPoNumber);

      if (hasMissingSplit || hasMissingSecondarySplit) {
        alert(
          "Please ensure all stations and PO numbers (including secondary badges) are set.",
        );
        return;
      }
    } else {
      if (
        !formData.stationId ||
        !formData.poNumber ||
        (formData.isMultiBadge && !formData.secondaryPoNumber)
      ) {
        alert("Please ensure the Station and all required PO numbers are set.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const orderSections = orderStations.flatMap(section => {
        const primary = {
          station: section.station, stationId: section.stationId, poNumber: section.poNumber,
          items: section.items, badgeNo: formData.badgeNo,
        };
        if (!formData.isMultiBadge) return [primary];

        return [primary, {
          ...primary, poNumber: section.secondaryPoNumber,
          items: section.secondaryItems, badgeNo: formData.secondaryBadgeNo,
        }];
      }).filter(section => hasVolume(section.items));

      if (orderSections.length === 0) {
        alert("No volumes detected. Cannot create empty POs.");
        return;
      }

      // 3. Generate PDFs for each identified section
      const processedOrders = await Promise.all(
        orderSections.map(async (section) => {
          const stationObj = section.station;

          // Find the specific accounting ID for the badge used in this section
          const badgeData = selectedSupplier?.supplierBadges?.find(
            (b) => b.badgeNumber === section.badgeNo,
          );
          const supplierAccountingId = badgeData?.accountingId || "";

          const doc = (
            <POPreviewDocument
              grades={catalog}
              data={{
                ...formData,
                poNumber: section.poNumber,
                items: section.items,
                badgeNo: section.badgeNo,
              }}
              selectedStation={stationObj}
              carrierName={selectedCarrier?.carrierName}
              rackName={selectedRack?.rackName}
              rackLocation={selectedRack?.rackLocation}
              carrierBookworksId={selectedCarrier?.carrierId}
              supplierBookworksId={supplierAccountingId}
            />
          );

          const blob = await pdf(doc).toBlob();

          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              resolve({
                stationId: section.stationId,
                items: section.items,
                poNumber: section.poNumber,
                badgeNo: section.badgeNo,
                pdfBase64: (reader.result as string).split(",")[1],
                customerName: stationObj?.fuelCustomerName || "Station",
              });
            };
          });
        }),
      );

      // 4. Send combined payload
      const payload = {
        ...formData,
        isSplit,
        orders: processedOrders, // Array containing 1, 2, or 4 orders
      };

      const res = await fuelOrdersService.create<any>(payload, processedOrders.length);
      alert(
        `Success! ${processedOrders.length} Order(s) created and Email Order draft pushed to ${res.pushedTo}'s Inbox.`,
      );
      handleReset();
      setIsPreviewOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save orders.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshAllPONumbers = async (
    newOrderDate: string,
    newDeliveryDate: string,
  ) => {
    let currentOrderDate = newOrderDate;

    // 1. Logic for Single Mode / Primary Station
    if (formData.stationId) {
      const station = locations.find((s: any) => s._id === formData.stationId);
      const result = await getPONumberHelper(
        station,
        currentOrderDate,
        newDeliveryDate,
      );

      // Update global date if helper shifted it
      if (result.finalOrderDate !== currentOrderDate) {
        currentOrderDate = result.finalOrderDate;
      }

      setFormData((prev) => ({
        ...prev,
        poNumber: result.po,
        orderDate: currentOrderDate,
      }));
    }

    // 2. Logic for Split Mode
    // If in Split mode, the Primary Station (index 0) dictates the Order Date for the truck
    const updatedSplits = [...formData.splits];

    for (let i = 0; i < updatedSplits.length; i++) {
      const split = updatedSplits[i];
      if (!split.stationId) continue;

      const station = locations.find((s: any) => s._id === split.stationId);
      const result = await getPONumberHelper(
        station,
        currentOrderDate,
        newDeliveryDate,
      );

      // If any station in the split forces a date change, we must update the whole truck
      if (result.finalOrderDate !== currentOrderDate) {
        currentOrderDate = result.finalOrderDate;
        // If date changed, we technically need to re-verify previous stations in the loop,
        // but usually the first station (Master) governs this.
      }

      updatedSplits[i] = { ...split, poNumber: result.po };
    }

    setFormData((prev) => ({
      ...prev,
      splits: updatedSplits,
      orderDate: currentOrderDate,
    }));
  };

  const generateSecondaryPO = (primaryPO: string): string => {
    if (!primaryPO || primaryPO === "ERROR") return "";

    // Extract the base string and the last character (the load number)
    const base = primaryPO.slice(0, -1);
    const loadNum = parseInt(primaryPO.slice(-1));

    // Increment the load number (e.g., Load 1 becomes Load 2)
    return `${base}${loadNum + 1}`;
  };

  const syncStationData = async (
    stationId: string,
    index: number,
    orderDate: string,
    deliveryDate: string,
  ) => {
    const station = locations.find((s: any) => s._id === stationId);
    if (!station) return;

    const tasks: Promise<any>[] = [];
    tasks.push(getPONumberHelper(station, orderDate, deliveryDate));

    if (deliveryDate) {
      tasks.push(
        fuelStationTanksService.getStationProjection<any>(stationId, deliveryDate, 'fuel-management.create-order', 'fuelManagement.createOrder'),
      );
    }

    try {
      const [poData, projRes] = await Promise.all(tasks);

      const groupedProjections =
        projRes?.tanks.reduce((acc: any, tank: any) => {
          if (!acc[tank.grade])
            acc[tank.grade] = { opening: 0, sales: 0, capacity: 0, closing: 0 };
          acc[tank.grade].opening += tank.openingL;
          acc[tank.grade].sales += tank.estSalesL;
          acc[tank.grade].capacity += tank.maxVolumeCapacity;
          acc[tank.grade].closing += tank.closingL;
          return acc;
        }, {}) || {};

      setFormData(prev => {
        if (prev.splits[index]?.stationId !== stationId) return prev;

        const poNumber = poData.po;
        const secondaryPoNumber = prev.isMultiBadge ? generateSecondaryPO(poNumber) : "";
        const splits = prev.splits.map((split, splitIndex) => splitIndex === index
          ? { ...split, poNumber, secondaryPoNumber, projections: groupedProjections }
          : split);

        if (!isSplit && index === 0) {
          return {
            ...prev, splits, stationId, poNumber, secondaryPoNumber,
            projections: groupedProjections, orderDate: poData.finalOrderDate,
          };
        }

        return { ...prev, splits, orderDate: poData.finalOrderDate };
      });
    } catch (err) {
      console.error("Sync Error:", err);
    }
  };

  // Function to trigger the flow
  const handleGenerateClick = () => {
    if (!orderStations.some(order => hasVolume(order.items) || hasVolume(order.secondaryItems))) {
      alert("Enter a quantity for an eligible fuel grade before generating a PO.");
      return;
    }
    setIsVerifyOpen(true);
  };

  const handleConfirmLogistics = () => {
    setIsVerifyOpen(false);
    setIsPreviewOpen(true);
    // Clear highlights once the user confirms they've seen them
    setPreSelectedFields([]);
  };

  // Change your toggle function to accept the current split state
  const toggleMultiBadge = (val: boolean, currentIsSplit: boolean) => {
    // 1. Validation Logic
    const selectedSup = suppliers.find((s) => s._id === formData.supplierId);
    const badgeCount = selectedSup?.supplierBadges?.length || 0;

    if (val && badgeCount < 2) {
      alert(
        "The current supplier only has one badge. Kindly add another badge in configuration to proceed.",
      );
      return; // Block execution and don't flip the toggle
    }

    // 2. State Update Logic
    setFormData((prev) => {
      // Auto-identify the second badge (different from the currently selected one)
      const nextBadge =
        val && badgeCount >= 2
          ? selectedSup?.supplierBadges.find(
              (b) => b.badgeNumber !== prev.badgeNo,
            )?.badgeNumber || ""
          : "";

      const newState = {
        ...prev,
        isMultiBadge: val,
        secondaryBadgeNo: nextBadge,
      };

      // 3. PO Generation Logic (only if enabling)
      if (val) {
        if (currentIsSplit) {
          newState.splits = prev.splits.map((s) => ({
            ...s,
            secondaryPoNumber: generateSecondaryPO(s.poNumber),
          }));
        } else {
          newState.secondaryPoNumber = generateSecondaryPO(prev.poNumber);
        }
      } else {
        // Clean up secondary POs if disabling
        if (currentIsSplit) {
          newState.splits = prev.splits.map((s) => ({
            ...s,
            secondaryPoNumber: "",
          }));
        } else {
          newState.secondaryPoNumber = "";
        }
      }

      return newState;
    });
  };

  const handleQtyChange = (
    sectionIdx: number,
    grade: string,
    value: number,
    isSecondary: boolean,
  ) => {
    const updateQuantity = (items: FuelOrderItem[]) => [
      ...items.filter(item => item.grade !== grade),
      { grade, ltrs: value },
    ];

    setFormData(prev => {
      if (!isSplit) {
        const key = isSecondary ? "secondaryItems" : "items";
        return { ...prev, [key]: updateQuantity(prev[key]) };
      }

      const key = isSecondary ? "secondarySplits" : "splits";
      return {
        ...prev,
        [key]: prev[key].map((section, index) => index === sectionIdx
          ? { ...section, items: updateQuantity(section.items) }
          : section),
      };
    });
  };

  const hasVolume = (items: FuelOrderItem[]) => items.some(item => item.ltrs > 0);

  // CSS for the highlight (Add to your global CSS or use a Tailwind class)
  // @keyframes pulse-highlight { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
  const highlightClass =
    "animate-pulse ring-2 ring-blue-500 ring-offset-2 border-blue-500";

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Create Fuel Order
          </h1>
          {/* NEW: Split Load Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg w-fit border">
            <Button
              variant={!isSplit ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-7 px-3", !isSplit && "bg-white shadow-sm")}
              onClick={() => setIsSplit(false)}
            >
              Single Load
            </Button>
            <Button
              variant={isSplit ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3",
                isSplit && "bg-white shadow-sm text-blue-600",
              )}
              onClick={() => setIsSplit(true)}
            >
              Split Load
            </Button>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            Reset Form
          </Button>

          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleGenerateClick}
            disabled={!formData.stationId || isSubmitting || !gradeQuery.isSuccess}
          >
            Generate PO PDF
          </Button>
          {/* 2. Verification Dialog */}
          <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  Verify Logistics
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-y-3 text-sm border-b pb-4">
                  <div className="font-semibold text-muted-foreground">
                    Rack:
                  </div>
                  <div className="font-bold">{selectedRack?.rackName}</div>
                  <div className="font-semibold text-muted-foreground">
                    Carrier:
                  </div>
                  <div className="font-bold">
                    {selectedCarrier?.carrierName}
                  </div>
                  <div className="font-semibold text-muted-foreground">
                    Supplier:
                  </div>
                  <div className="font-bold">
                    {selectedSupplier?.supplierName}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-slate-400">
                    Loading Badges
                  </Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
                      <span className="text-xs font-bold text-blue-700">
                        Primary Badge
                      </span>
                      <span className="font-mono font-bold">
                        {formData.badgeNo}
                      </span>
                    </div>
                    {formData.isMultiBadge && (
                      <div className="flex justify-between items-center p-2 bg-orange-50 rounded border border-orange-100">
                        <span className="text-xs font-bold text-orange-700">
                          Secondary Badge
                        </span>
                        <span className="font-mono font-bold">
                          {formData.secondaryBadgeNo}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsVerifyOpen(false)}
                >
                  Edit
                </Button>
                <Button
                  className="bg-blue-600"
                  onClick={handleConfirmLogistics}
                >
                  Confirm & Preview
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="w-[85vw] !max-w-[1200px] h-[92vh] flex flex-col p-6">
              {/* Helper variables to keep the JSX clean */}
              {(() => {
                const validSplits = orderStations
                  .map((order, index) => ({ order, index }))
                  .filter(({ order }) => hasVolume(order.items) || hasVolume(order.secondaryItems));
                const selectedSplit = validSplits.find(({ index }) => index === activeSplitIdx) ?? validSplits[0];
                if (!selectedSplit) return <DialogTitle>No eligible fuel volumes to preview</DialogTitle>;

                const { order: previewOrder, index: previewSplitIndex } = selectedSplit;
                const badge1HasVolume = hasVolume(previewOrder.items);
                const badge2HasVolume = hasVolume(previewOrder.secondaryItems);
                const isPrimary = badge1HasVolume && (!badge2HasVolume || activeBadgeIdx === 0);
                const currentStation = previewOrder.station;
                const currentStationName = currentStation?.fuelCustomerName || "Unknown Station";
                const currentBadge = isPrimary ? formData.badgeNo : formData.secondaryBadgeNo;
                const currentPo = isPrimary ? previewOrder.poNumber : previewOrder.secondaryPoNumber;
                const currentItems = isPrimary ? previewOrder.items : previewOrder.secondaryItems;

                // 3. Resolve Accounting IDs
                const activeBadgeData = selectedSupplier?.supplierBadges?.find(
                  (b: any) => b.badgeNumber === currentBadge,
                );

                const displaySupplierAccountingId =
                  activeBadgeData?.accountingId || "";
                const displayCarrierId = selectedCarrier?.carrierId || "";

                return (
                  <>
                    <DialogHeader className="flex flex-row items-center justify-between pr-8 border-b pb-4">
                      <div className="flex flex-col">
                        <DialogTitle className="text-xl font-bold">
                          PO: {currentPo}
                        </DialogTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase">
                            {currentStationName}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase",
                              isPrimary
                                ? "bg-slate-100 text-slate-600"
                                : "bg-orange-100 text-orange-700",
                            )}
                          >
                            Badge: {currentBadge}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-4 items-center">
                        {/* SITE TOGGLE: Only show sites that have volume in at least one badge */}
                        {isSplit && validSplits.length > 1 && (
                          <div className="flex flex-col gap-1 items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              Select Delivery Site
                            </span>
                            <div className="flex bg-slate-100 p-1 rounded-lg border">
                              {validSplits.map(({ order, index: idx }) => {
                                const name = order.station?.fuelCustomerName || `Site ${idx + 1}`;
                                return (
                                  <Button
                                    key={idx}
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                      "h-7 px-3 text-[10px] font-bold transition-all",
                                      previewSplitIndex === idx
                                        ? "bg-white text-blue-600 shadow-sm"
                                        : "text-slate-500",
                                    )}
                                    onClick={() => setActiveSplitIdx(idx)}
                                  >
                                    {name}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* BADGE TOGGLE: Only show badge buttons if they actually have volume for THIS station */}
                        {formData.isMultiBadge &&
                          badge1HasVolume &&
                          badge2HasVolume && (
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                Select Loading Badge
                              </span>
                              <div className="flex bg-slate-100 p-1 rounded-lg border">
                                <Button
                                  variant="ghost"
                                  className={cn(
                                    "h-7 px-4 text-[10px] font-bold",
                                    isPrimary
                                      ? "bg-white text-blue-600 shadow-sm"
                                      : "text-slate-500",
                                  )}
                                  onClick={() => setActiveBadgeIdx(0)}
                                >
                                  {formData.badgeNo}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-7 px-4 text-[10px] font-bold",
                                    !isPrimary
                                      ? "bg-white text-orange-600"
                                      : "text-slate-500",
                                  )}
                                  onClick={() => setActiveBadgeIdx(1)}
                                >
                                  {formData.secondaryBadgeNo}
                                </Button>
                              </div>
                            </div>
                          )}
                      </div>
                    </DialogHeader>

                    <div className="flex-1 border rounded-lg overflow-hidden bg-slate-50 px-4 py-2">
                      <PDFViewer width="100%" height="100%" showToolbar={false}>
                        <POPreviewDocument
                          grades={catalog}
                          data={{
                            ...formData,
                            poNumber: currentPo,
                            badgeNo: currentBadge,
                            items: currentItems, // Switched quantities
                          }}
                          selectedStation={currentStation}
                          carrierName={selectedCarrier?.carrierName}
                          rackName={selectedRack?.rackName}
                          rackLocation={selectedRack?.rackLocation}
                          carrierBookworksId={displayCarrierId}
                          supplierBookworksId={displaySupplierAccountingId} // Corrected dynamic ID
                        />
                      </PDFViewer>
                    </div>

                    <DialogFooter className="mt-4 flex justify-between items-center w-full">
                      <PDFDownloadLink
                        document={
                          <POPreviewDocument
                            grades={catalog}
                            data={{
                              ...formData,
                              poNumber: currentPo,
                              badgeNo: currentBadge,
                              items: currentItems,
                            }}
                            selectedStation={currentStation}
                            carrierName={selectedCarrier?.carrierName}
                            rackName={selectedRack?.rackName}
                            rackLocation={selectedRack?.rackLocation}
                            carrierBookworksId={displayCarrierId}
                            supplierBookworksId={displaySupplierAccountingId}
                          />
                        }
                        fileName={`Fuel Order Form ${currentPo} - ${currentStationName} - ${formatPDFDate(formData.deliveryDate, false)}.pdf`}
                      >
                        {({ loading }) => (
                          <Button
                            variant="outline"
                            disabled={loading}
                            className="border-blue-200 text-blue-600 hover:bg-blue-50"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {loading
                              ? "Generating..."
                              : `Download PO for ${currentStationName} - ${currentBadge}`}
                          </Button>
                        )}
                      </PDFDownloadLink>

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setIsPreviewOpen(false)}
                        >
                          Back
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700 font-bold"
                          onClick={handleSubmit}
                          disabled={isSubmitting || !gradeQuery.isSuccess}
                        >
                          Finalize All Orders
                        </Button>
                      </div>
                    </DialogFooter>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {gradeQuery.isPending && <p role="status" className="text-sm text-muted-foreground">Loading fuel grades…</p>}
      {gradeQuery.isError && (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-sm text-destructive">Could not load fuel grades.</p>
          <Button size="sm" variant="outline" onClick={() => void gradeQuery.refetch()}>Retry</Button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Logistics & Form */}
        <div
          className={cn(
            "col-span-12 transition-all duration-300",
            isSplit || formData.isMultiBadge
              ? "lg:col-span-5 xl:col-span-6"
              : "lg:col-span-8",
          )}
        >
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                Station & Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* DYNAMIC STATION SELECTORS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isSplit ? (
                  // --- SINGLE MODE ---
                  <div className="space-y-3 p-3 border rounded-xl bg-slate-50/50 border-blue-100">
                    <div className="space-y-2">
                      <Label className="text-blue-700 font-bold">
                        Select Station
                      </Label>
                      <Select
                        value={formData.stationId}
                        onValueChange={(v) => handleStationChange(v, 0)}
                        disabled={isLoadingLocations}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Choose Station..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(locations || []).map((s: any) => (
                            <SelectItem key={s._id} value={s._id}>
                              {s.stationName}{" "}
                              <span className="text-xs text-muted-foreground ml-2">
                                ({s.tankCount} Tanks)
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.stationId && (
                      <div className="space-y-3">
                        {/* Primary PO */}
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-slate-500 font-bold ml-1">
                            PO Number {formData.isMultiBadge && "(Load 1)"}
                          </Label>
                          <div className="flex gap-1.5">
                            <div className="relative flex-1">
                              <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                              <Input
                                value={formData.poNumber}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    poNumber: e.target.value,
                                  }))
                                }
                                className="h-8 pl-8 font-mono text-xs font-bold border-blue-200 focus-visible:ring-blue-500 bg-white"
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="outline"
                              type="button"
                              className="h-8 w-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                              onClick={() =>
                                refreshAllPONumbers(
                                  formData.orderDate,
                                  formData.deliveryDate,
                                )
                              }
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Secondary PO - Shown if Multi-Badge is active */}
                        {formData.isMultiBadge && (
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-orange-600 font-bold ml-1">
                              PO Number (Load 2)
                            </Label>
                            <div className="relative">
                              <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-500" />
                              <Input
                                value={formData.secondaryPoNumber}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    secondaryPoNumber: e.target.value,
                                  }))
                                }
                                className="h-8 pl-8 font-mono text-xs font-bold border-orange-200 focus-visible:ring-orange-500 bg-orange-50/30"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  // --- SPLIT MODE ---
                  formData.splits.map((split, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 p-3 border rounded-xl bg-slate-50/50 border-blue-100"
                    >
                      <div className="space-y-2">
                        <Label className="text-blue-700 font-bold">
                          Station {idx + 1} {idx === 0 && "(Main Station)"}
                        </Label>
                        <Select
                          value={split.stationId}
                          onValueChange={(v) => handleStationChange(v, idx)}
                          disabled={isLoadingLocations}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue
                              placeholder={`Select Station ${idx + 1}...`}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(locations || []).map((s: any) => (
                              <SelectItem key={s._id} value={s._id}>
                                {s.stationName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {split.stationId && (
                        <div className="space-y-3">
                          {/* Split Primary PO */}
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wide text-slate-500 font-bold ml-1">
                              PO Number {formData.isMultiBadge && "(Load 1)"}
                            </Label>
                            <div className="flex gap-1.5">
                              <div className="relative flex-1">
                                <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                                <Input
                                  value={split.poNumber}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData((prev) => {
                                      const newSplits = [...prev.splits];
                                      newSplits[idx] = {
                                        ...newSplits[idx],
                                        poNumber: val,
                                      };
                                      return { ...prev, splits: newSplits };
                                    });
                                  }}
                                  className="h-8 pl-8 font-mono text-xs font-bold border-blue-200 focus-visible:ring-blue-500 bg-white"
                                />
                              </div>
                              <Button
                                size="icon"
                                variant="outline"
                                type="button"
                                className="h-8 w-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                                onClick={() =>
                                  refreshAllPONumbers(
                                    formData.orderDate,
                                    formData.deliveryDate,
                                  )
                                }
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Split Secondary PO */}
                          {formData.isMultiBadge && (
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wide text-orange-600 font-bold ml-1">
                                PO Number (Load 2)
                              </Label>
                              <div className="relative">
                                <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-500" />
                                <Input
                                  value={split.secondaryPoNumber}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData((prev) => {
                                      const newSplits = [...prev.splits];
                                      newSplits[idx] = {
                                        ...newSplits[idx],
                                        secondaryPoNumber: val,
                                      };
                                      return { ...prev, splits: newSplits };
                                    });
                                  }}
                                  className="h-8 pl-8 font-mono text-xs font-bold border-orange-200 focus-visible:ring-orange-500 bg-orange-50/30"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* SHARED SCHEDULING (Dates & Windows) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-dashed">
                <div className="space-y-2">
                  <Label>Order Date</Label>
                  <Input
                    type="date"
                    value={formData.orderDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFormData((prev) => ({ ...prev, orderDate: newDate }));

                      // Refresh PO for all active stations
                      const activeStations = isSplit
                        ? formData.splits
                        : [{ stationId: formData.stationId }];
                      activeStations.forEach((s, idx) => {
                        if (s.stationId)
                          syncStationData(
                            s.stationId,
                            idx,
                            newDate,
                            formData.deliveryDate,
                          );
                      });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Delivery Date</Label>
                  <Input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => {
                      const newDelDate = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        deliveryDate: newDelDate,
                      }));

                      // Refresh PO and Projections for all active stations
                      const activeStations = isSplit
                        ? formData.splits
                        : [{ stationId: formData.stationId }];
                      activeStations.forEach((s, idx) => {
                        if (s.stationId)
                          syncStationData(
                            s.stationId,
                            idx,
                            formData.orderDate,
                            newDelDate,
                          );
                      });
                    }}
                  />
                </div>

                {/* Window Start/End remain as they don't affect PO numbers */}
                <div className="space-y-2">
                  <Label>Window Start</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Window End</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" />
                Supply Chain Details
              </CardTitle>

              {/* TOGGLE MOVED TO HEADER */}
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <Label
                  htmlFor="multi-badge"
                  className="text-[10px] font-black uppercase text-slate-500 tracking-tight"
                >
                  Multi-Badge Load
                </Label>
                <Switch
                  id="multi-badge"
                  checked={formData.isMultiBadge}
                  onCheckedChange={(val: any) => toggleMultiBadge(val, isSplit)}
                  disabled={!formData.supplierId}
                  className="data-[state=checked]:bg-blue-600"
                />
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6">
                {/* 1. Fuel Rack */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    Fuel Rack
                  </Label>
                  <Select
                    value={formData.rackId}
                    onValueChange={(v) => {
                      handleRackChange(v, undefined, undefined, true);
                      setPreSelectedFields((prev) =>
                        prev.filter((f) => f !== "rackId"),
                      );
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full transition-all duration-500",
                        preSelectedFields.includes("rackId") && highlightClass,
                      )}
                    >
                      <SelectValue placeholder="Select Rack" />
                    </SelectTrigger>
                    <SelectContent>
                      {racks.map((r: any) => (
                        <SelectItem key={r._id} value={r._id}>
                          {r.rackName} - {r.rackLocation || ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Supplier */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    Supplier
                  </Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={handleSupplierChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.supplierName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Badge Selector (Conditionally rendered here only for Single Badge) */}
                {!formData.isMultiBadge && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                      Badge Number
                    </Label>
                    <Select
                      value={formData.badgeNo}
                      onValueChange={(v) =>
                        setFormData({ ...formData, badgeNo: v })
                      }
                    >
                      <SelectTrigger className="font-mono w-full overflow-hidden">
                        <div className="truncate text-left">
                          <SelectValue placeholder="Select Badge" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers
                          .find((s) => s._id === formData.supplierId)
                          ?.supplierBadges.map((b) => (
                            <SelectItem
                              key={b.badgeNumber}
                              value={b.badgeNumber}
                            >
                              <span className="font-bold">{b.badgeNumber}</span>
                              <span className="text-muted-foreground text-xs ml-2">
                                — {b.badgeName}
                              </span>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 4. Carrier */}
                <div
                  className={cn(
                    "space-y-2",
                    formData.isMultiBadge && "xl:col-start-4",
                  )}
                >
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    Carrier
                  </Label>
                  <Select
                    value={formData.carrierId}
                    onValueChange={(v) => {
                      setFormData({ ...formData, carrierId: v });
                      setPreSelectedFields((prev) =>
                        prev.filter((f) => f !== "carrierId"),
                      );
                    }}
                  >
                    <SelectTrigger
                      className={cn(
                        "w-full transition-all duration-500",
                        preSelectedFields.includes("carrierId") &&
                          highlightClass,
                      )}
                    >
                      <SelectValue
                        placeholder={
                          carriers.length > 0
                            ? "Select Carrier"
                            : "No carriers available"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((c: any) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.carrierName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* MULTI-BADGE ROW (Appears on next line when enabled) */}
              {formData.isMultiBadge && (
                <div className="mt-6 pt-6 border-t border-dashed border-blue-200 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Primary Badge in the split row */}
                    <div className="space-y-2">
                      <Label className="text-slate-600 text-xs font-bold uppercase tracking-wide">
                        Primary Badge
                      </Label>
                      <Select
                        value={formData.badgeNo}
                        onValueChange={(v) =>
                          setFormData({ ...formData, badgeNo: v })
                        }
                      >
                        <SelectTrigger className="font-mono w-full">
                          <SelectValue placeholder="Select Primary Badge" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers
                            .find((s) => s._id === formData.supplierId)
                            ?.supplierBadges.map((b) => (
                              <SelectItem
                                key={b.badgeNumber}
                                value={b.badgeNumber}
                                disabled={
                                  b.badgeNumber === formData.secondaryBadgeNo
                                }
                              >
                                <span className="font-bold">
                                  {b.badgeNumber}
                                </span>
                                <span className="text-muted-foreground text-xs ml-2">
                                  — {b.badgeName}
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Secondary Badge in the split row */}
                    <div className="space-y-2">
                      <Label className="text-blue-600 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        Secondary Badge
                      </Label>
                      <Select
                        value={formData.secondaryBadgeNo}
                        onValueChange={(v) =>
                          setFormData({ ...formData, secondaryBadgeNo: v })
                        }
                      >
                        <SelectTrigger className="font-mono w-full border-blue-200 bg-blue-50/30">
                          <SelectValue placeholder="Select Secondary Badge" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers
                            .find((s) => s._id === formData.supplierId)
                            ?.supplierBadges.map((b) => (
                              <SelectItem
                                key={b.badgeNumber}
                                value={b.badgeNumber}
                                disabled={b.badgeNumber === formData.badgeNo}
                              >
                                <span className="font-bold">
                                  {b.badgeNumber}
                                </span>
                                <span className="text-muted-foreground text-xs ml-2">
                                  — {b.badgeName}
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Order Quantities */}
        <div
          className={cn(
            "col-span-12 transition-all duration-300",
            // CRITICAL: Ensure Left (5) + Right (7) = 12
            isSplit || formData.isMultiBadge
              ? "lg:col-span-7 xl:col-span-6"
              : "lg:col-span-4",
            // "lg:col-span-7 xl:col-span-6"
          )}
        >
          <Card className="h-full border-blue-100 bg-blue-50/30 flex flex-col">
            <CardHeader className="pb-3 border-b bg-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5 text-blue-600" />
                {isSplit ? "Split Load Config" : "Order Items"}
              </CardTitle>
            </CardHeader>

            <CardContent className={cn("pt-4 flex-1 space-y-6")}>
              {orderStations.map((section, sIdx) => {
                if (!section.station) return null;

                const badgeConfigs = [
                  { id: "primary", badge: formData.badgeNo, items: section.items, isSecondary: false },
                  ...(formData.isMultiBadge ? [{
                    id: "secondary", badge: formData.secondaryBadgeNo, items: section.secondaryItems, isSecondary: true,
                  }] : []),
                ];

                return (
                  <div
                    key={sIdx}
                    className="space-y-4 border-b pb-6 last:border-0"
                  >
                    {/* Station Header */}
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                      <span className="text-xs font-black text-blue-800 uppercase">
                        {section.station.stationName}
                      </span>
                      <span className="text-[10px] font-mono bg-white px-2 border rounded">
                        PO: {section.poNumber}
                      </span>
                    </div>

                    {/* LAYOUT LOGIC: If not multi-badge, use 1 column. If multi-badge, use 2 columns */}
                    <div
                      className={cn(
                        "grid gap-4",
                        // If only 1 badge is active, use 1 col (full width). If 2, use 2 cols.
                        formData.isMultiBadge
                          ? "grid-cols-1 xl:grid-cols-2"
                          : "grid-cols-1",
                      )}
                    >
                      {badgeConfigs.map((bc) => {
                        return (
                          bc.badge && (
                            <div
                              key={bc.id}
                              className={cn(
                                "space-y-3 p-3 rounded-xl border border-dashed transition-all",
                                bc.isSecondary
                                  ? "bg-blue-50/40 border-blue-200"
                                  : "bg-white border-slate-300",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                  Badge:{" "}
                                  <span className="text-slate-900 font-mono">
                                    {bc.badge}
                                  </span>
                                </span>
                                <Badge
                                  variant={
                                    bc.isSecondary ? "default" : "outline"
                                  }
                                  className="text-[8px] h-4 uppercase"
                                >
                                  {bc.isSecondary ? "Secondary" : "Primary"}
                                </Badge>
                              </div>

                              {bc.items.length > 0 ? (
                                <>
                                  {bc.items.map((item) => {
                                    const grade = gradeByKey.get(item.grade);
                                    const projectionKey = getOrderTankGrade(item.grade);
                                    const projection = section.projections?.[
                                      projectionKey
                                    ] || {
                                      opening: 0,
                                      sales: 0,
                                      capacity: 0,
                                      closing: 0,
                                    };

                                    // Find total volume for this grade across BOTH badges for inventory calculation
                                    const otherBadgeItems = bc.isSecondary ? section.items : section.secondaryItems;
                                    const otherQty = Number(
                                      otherBadgeItems?.find(
                                        (i) => i.grade === item.grade,
                                      )?.ltrs || 0,
                                    );
                                    const currentQty = Number(item.ltrs) || 0;

                                    // This smoothly adds E15 volume into the Regular physical tank closing estimation metrics automatically!
                                    const finalClosing =
                                      projection.closing +
                                      currentQty +
                                      otherQty;

                                    return (
                                      <div
                                        key={item.grade}
                                        className="p-2 bg-white rounded-lg border shadow-sm relative overflow-hidden"
                                      >
                                        <div
                                          className="absolute left-0 top-0 bottom-0 w-1"
                                          style={{ backgroundColor: grade?.color }}
                                        />

                                        <div className="flex items-center justify-between gap-4">
                                          <div className="flex flex-col">
                                            <span className="text-[12px] font-black uppercase italic">
                                              {grade?.name ?? item.grade}
                                            </span>
                                            {otherQty > 0 && (
                                              <span className="text-[8px] text-blue-500 font-bold">
                                                +{otherQty.toLocaleString()} L
                                                (Other Badge)
                                              </span>
                                            )}
                                          </div>

                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-7 w-24 text-right font-mono font-bold text-sm border-blue-200 focus-visible:ring-blue-500"
                                            value={item.ltrs || ""}
                                            onChange={(e) =>
                                              handleQtyChange(
                                                sIdx,
                                                item.grade,
                                                Number(e.target.value),
                                                bc.isSecondary,
                                              )
                                            }
                                          />
                                        </div>

                                        {/* Grid for Opening, Sales, and Closing */}
                                        <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-slate-100">
                                          <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">
                                              Est. Opening
                                            </span>
                                            <span
                                              className={cn(
                                                "font-mono font-bold text-slate-700",
                                                isSplit
                                                  ? "text-[10px]"
                                                  : "text-xs",
                                              )}
                                            >
                                              {projection.opening.toLocaleString()}
                                            </span>
                                          </div>

                                          <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">
                                              Est. Sales
                                            </span>
                                            <span
                                              className={cn(
                                                "font-mono font-bold text-red-500",
                                                isSplit
                                                  ? "text-[10px]"
                                                  : "text-xs",
                                              )}
                                            >
                                              -
                                              {projection.sales.toLocaleString()}
                                            </span>
                                          </div>

                                          <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold text-blue-500 uppercase leading-none mb-1">
                                              Est. Closing
                                            </span>
                                            <span
                                              className={cn(
                                                "font-mono font-black",
                                                isSplit
                                                  ? "text-[10px]"
                                                  : "text-xs",
                                                projection.capacity > 0 &&
                                                  finalClosing >
                                                    projection.capacity
                                                  ? "text-orange-600"
                                                  : "text-blue-600",
                                              )}
                                            >
                                              {finalClosing.toLocaleString()}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Overflow Risk Alert */}
                                        {projection.capacity > 0 &&
                                          finalClosing >
                                            projection.capacity && (
                                            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                              <AlertTriangle className="h-3 w-3" />
                                              Overflow Risk: Exceeds{" "}
                                              {projection.capacity.toLocaleString()}
                                              L Capacity
                                            </div>
                                          )}
                                      </div>
                                    );
                                  })}
                                  {/* ADDED: Total sum for this specific Badge/Station combination */}
                                  {(() => {
                                    const badgeTotal = bc.items.reduce(
                                      (sum, item) =>
                                        sum + (Number(item.ltrs) || 0),
                                      0,
                                    );

                                    return (
                                      <div
                                        className={cn(
                                          "mt-4 pt-3 border-t border-dashed flex justify-between items-center px-1",
                                          bc.isSecondary
                                            ? "border-blue-200"
                                            : "border-slate-200",
                                        )}
                                      >
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                          {bc.isSecondary
                                            ? "Secondary Total"
                                            : "Primary Total"}
                                        </span>
                                        <span
                                          className={cn(
                                            "font-black font-mono",
                                            isSplit ? "text-sm" : "text-base",
                                            bc.isSecondary
                                              ? "text-blue-600"
                                              : "text-slate-700",
                                          )}
                                        >
                                          {badgeTotal.toLocaleString()}{" "}
                                          <span className="text-[10px] font-bold">
                                            L
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })()}
                                </>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic py-4 text-center">
                                  No compatible grades for this badge
                                </div>
                              )}
                            </div>
                          )
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
