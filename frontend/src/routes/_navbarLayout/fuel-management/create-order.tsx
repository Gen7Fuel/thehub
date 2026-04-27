import {
  useState,
  // useEffect, useMemo
} from 'react';
import { cn } from "@/lib/utils";
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from "@tanstack/react-query"
import axios from 'axios';
import {
  Building2, Truck, Fuel, RefreshCw, AlertCircle, ShieldCheck, Download,
  // Hash, Save,  CheckCircle2, Calendar, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getGradeTheme } from "./manage/locations/$id"
import { gradeConfig } from "./workspace"
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { POPreviewDocument, formatPDFDate } from "@/components/custom/fuelPoPDF"

export const Route = createFileRoute('/_navbarLayout/fuel-management/create-order')({
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
  badgeNo: string;
  carrierId: string;
  poNumber: string;
  items: FuelOrderItem[];
  // Add these two to fix the TS error
  projections: Record<string, GradeProjection>;
  splits: StationSplit[];
}

interface SupplierBadge {
  badgeName: string;
  badgeNumber: string;
  accountingId: string;
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

  const [preSelectedFields, setPreSelectedFields] = useState<string[]>([]);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);

  const [isSplit, setIsSplit] = useState(false);
  const [formData, setFormData] = useState<FuelOrderFormData>({
    stationId: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    startTime: '08:00',
    endTime: '12:00',
    rackId: '',
    supplierId: '',
    badgeNo: '',
    carrierId: '',
    poNumber: '',
    items: [],
    projections: {}, // Initialize as empty object
    splits: [
      { stationId: '', poNumber: '', items: [], projections: {} },
      { stationId: '', poNumber: '', items: [], projections: {} }
    ]
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  const [_, setProjections] = useState<Record<string, GradeProjection>>({});
  // --- Fetch Locations using TanStack Query ---
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: ['locations-list'],
    queryFn: async () => {
      const res = await axios.get('/api/fuel-station-tanks/all-locations', authHeader);
      return res.data;
    },
    staleTime: 0
  });

  // --- Cascading Logic: Station Selection ---
  // Inside your RouteComponent...

  const handleStationChange = async (stationId: string, index: number) => {
    const station = locations.find((s: any) => s._id === stationId);
    if (!station) return;

    // 1. Immediate State Update (Optimistic)
    setFormData(prev => {
      const newSplits = [...prev.splits];
      newSplits[index] = {
        ...newSplits[index],
        stationId,
        items: (station.availableStationGrades || []).map((grade: string) => ({ grade, ltrs: 0 })),
      };
      return { ...prev, splits: newSplits };
    });

    // 2. Global Logistics (Only for the first station/master)
    if (index === 0) {
      try {
        const racksRes = await axios.get('/api/fuel-racks', authHeader);
        setRacks(racksRes.data);
        const defaultRackId = station.defaultFuelRack?._id || station.defaultFuelRack || '';
        const stationDefaultCarrierId = station.defaultFuelCarrier?._id || station.defaultFuelCarrier || '';

        setFormData(prev => ({
          ...prev,
          stationId: stationId, // Sync root stationId
          rackId: defaultRackId,
          carrierId: stationDefaultCarrierId,
        }));

        if (defaultRackId) {
          handleRackChange(defaultRackId, stationId, stationDefaultCarrierId);
        }
        setPreSelectedFields(['rackId', 'carrierId']);
      } catch (err) {
        console.error("Master Station Logistics Error:", err);
      }
    }
    // 2. Sync PO and Projections
    await syncStationData(stationId, index, formData.orderDate, formData.deliveryDate);
  };

  const handleRackChange = async (
    rackId: string,
    currentStationId?: string,
    passedCarrierId?: string
  ) => {
    try {
      const rackRes = await axios.get(`/api/fuel-racks/${rackId}`, authHeader);
      const rack = rackRes.data;
      const rackGrades = rack.availableGrades || [];
      const rackCarriers = rack.associatedCarriers || [];

      const supplierRes = await axios.get(`/api/fuel-suppliers?associatedRack=${rackId}`, authHeader);
      const rackSuppliers = supplierRes.data;

      setSuppliers(rackSuppliers);
      setCarriers(rackCarriers);

      // 1. Logistics Defaults (Supplier & Badge)
      const defaultSup = rackSuppliers.find((s: any) => s._id === rack.defaultSupplier) || rackSuppliers[0];
      const defaultBadge = defaultSup?.supplierBadges?.find((b: any) => b.isDefault) || defaultSup?.supplierBadges?.[0];

      // 2. Carrier Logic: Determine which carrier to auto-select
      const targetStationId = currentStationId || formData.stationId;
      const station = locations.find((s: any) => s._id === targetStationId);

      // Check if the passed ID or station default is valid for this specific rack
      const carrierToVerify = passedCarrierId || station?.defaultFuelCarrier?._id || station?.defaultFuelCarrier || '';
      const isAllowed = rackCarriers.some((c: any) => c._id === carrierToVerify);

      // Fallback to the first carrier in the rack list if the default isn't allowed
      const finalCarrierId = isAllowed ? carrierToVerify : (rackCarriers[0]?._id || '');

      setFormData(prev => {
        // 3. Update all active splits with the new Rack's filtered grades
        const updatedSplits = prev.splits.map((split) => {
          if (!split.stationId) return split;

          const splitStation = locations.find((l: any) => l._id === split.stationId);
          const stationGrades = splitStation?.availableStationGrades || [];

          const newFilteredItems = rackGrades
            .filter((g: string) => stationGrades.includes(g))
            .map((g: string) => {
              const existing = split.items.find(i => i.grade === g);
              return { grade: g, ltrs: existing?.ltrs || 0 };
            });

          return { ...split, items: newFilteredItems };
        });

        const update = {
          ...prev,
          rackId,
          supplierId: defaultSup?._id || '',
          badgeNo: defaultBadge?.badgeNumber || '',
          carrierId: finalCarrierId, // This performs the auto-selection
          splits: updatedSplits
        };

        // Sync root level for single mode
        if (!isSplit) {
          update.items = updatedSplits[0].items;
          update.carrierId = finalCarrierId;
        }

        return update;
      });

    } catch (err) {
      console.error("Error in Rack domino chain:", err);
    }
  };

  // New handler for when the user manually changes the supplier
  const handleSupplierChange = (supplierId: string) => {
    const selectedSup = suppliers.find(s => s._id === supplierId);

    // Find default badge, or just pick the first one if no default exists
    const defaultBadge = selectedSup?.supplierBadges?.find(b => b.isDefault)
      || selectedSup?.supplierBadges?.[0];

    setFormData(prev => ({
      ...prev,
      supplierId,
      badgeNo: defaultBadge?.badgeNumber || ''
    }));
  };

  // ADD THIS HELPER ABOVE YOUR COMPONENT
  const getPONumberHelper = async (station: any, oDate: string, dDate: string, authHeader: any) => {
    if (!station || !oDate || !dDate) return { po: '', finalOrderDate: oDate };

    const getFormattedPart = (dateStr: string) => {
      const dateObj = new Date(dateStr + 'T00:00:00');
      const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const dd = dateObj.getDate().toString().padStart(2, '0');
      const yy = dateObj.getFullYear().toString().slice(-2);
      return `${mm}${dd}${yy}`;
    };

    const stationNum = String(station.fuelStationNumber).padStart(2, '0');

    try {
      const res = await axios.get(
        `/api/fuel-orders/check-existing?stationId=${station._id}&orderDate=${oDate}`,
        authHeader
      );
      const { count, existingOrders } = res.data;

      if (count > 0) {
        const differentDeliveryDate = existingOrders.find((order: any) => {
          if (!order.originalDeliveryDate) return false;
          const existingD = new Date(order.originalDeliveryDate).toISOString().split('T')[0];
          return existingD !== dDate;
        });

        const sameDeliveryDate = existingOrders.find((order: any) => {
          if (!order.originalDeliveryDate) return false;
          const existingD = new Date(order.originalDeliveryDate).toISOString().split('T')[0];
          return existingD === dDate;
        });

        // CRITICAL: Handle Date Shift
        if (differentDeliveryDate) {
          const tomorrow = new Date(oDate + 'T00:00:00');
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];

          alert(`CRITICAL: Station ${station.stationName} has an order for this date with a different delivery date. Moving Order Date to tomorrow (${tomorrowStr}).`);

          // Recursive call with new date
          return getPONumberHelper(station, tomorrowStr, dDate, authHeader);
        }

        // Handle Multiple Loads same day
        if (sameDeliveryDate) {
          const nextLoad = count + 1;
          const confirm = window.confirm(`Station ${station.stationName}: Already a load for ${dDate}. Create Load #${nextLoad}?`);
          if (!confirm) return { po: '', finalOrderDate: oDate };

          return {
            po: `NSP${getFormattedPart(oDate)}-${stationNum}${nextLoad}`,
            finalOrderDate: oDate
          };
        }
      }

      // Default Case
      return {
        po: `NSP${getFormattedPart(oDate)}-${stationNum}${count + 1}`,
        finalOrderDate: oDate
      };

    } catch (err) {
      console.error("PO Helper Error", err);
      return { po: 'ERROR', finalOrderDate: oDate };
    }
  };

  // --- 1. Reset Logic ---
  const handleReset = () => {
    setFormData({
      stationId: '',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      startTime: '08:00',
      endTime: '12:00',
      rackId: '',
      supplierId: '',
      badgeNo: '',
      carrierId: '',
      poNumber: '',
      items: [],
      projections: {}, // Initialize as empty object
      splits: [
        { stationId: '', poNumber: '', items: [], projections: {} },
        { stationId: '', poNumber: '', items: [], projections: {} }
      ]
    });
    setRacks([]);
    setCarriers([]);
    setSuppliers([]);
    setProjections({});
    setIsSplit(false); // Reset to single mode
  };

  const handleSubmit = async () => {
    // 1. Validation
    if (isSplit) {
      if (formData.splits.some(s => !s.stationId || !s.poNumber)) {
        alert("Please ensure both split stations and PO numbers are set.");
        return;
      }
    } else if (!formData.stationId || !formData.poNumber) {
      alert("Please select a Station and PO Number.");
      return;
    }

    try {
      setIsSubmitting(true);

      // 2. Prepare an array of objects to send to backend
      // Each object represents one PO/Station
      const orderSections = isSplit
        ? formData.splits.map(s => ({
          stationId: s.stationId,
          items: s.items,
          poNumber: s.poNumber
        }))
        : [{
          stationId: formData.stationId,
          items: formData.items,
          poNumber: formData.poNumber
        }];

      // 3. Generate PDFs for each section
      const processedOrders = await Promise.all(orderSections.map(async (section) => {
        const stationObj = locations.find((l: any) => l._id === section.stationId);

        const doc = (
          <POPreviewDocument
            data={{ ...formData, poNumber: section.poNumber, items: section.items }}
            selectedStation={stationObj}
            carrierName={selectedCarrier?.carrierName}
            rackName={selectedRack?.rackName}
            rackLocation={selectedRack?.rackLocation}
            carrierBookworksId={currentCarrierId}
            supplierBookworksId={currentSupplierAccountingId}
          />
        );

        const blob = await pdf(doc).toBlob();

        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            resolve({
              ...section,
              pdfBase64: (reader.result as string).split(',')[1],
              customerName: stationObj?.fuelCustomerName || 'Station'
            });
          };
        });
      }));

      // 4. Send combined payload
      const payload = {
        ...formData,
        isSplit,
        orders: processedOrders // Array containing 1 or 2 orders
      };

      const response = await axios.post('/api/fuel-orders', payload, authHeader);
      const res = response.data;

      if (response.status === 201) {
        alert(`Success! ${isSplit ? 'Split orders' : 'Order'} created and draft pushed to ${res.pushedTo}`);
        handleReset();
        if (setIsPreviewOpen) setIsPreviewOpen(false);
      }

    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const refreshAllPONumbers = async (newOrderDate: string, newDeliveryDate: string) => {
    let currentOrderDate = newOrderDate;

    // 1. Logic for Single Mode / Primary Station
    if (formData.stationId) {
      const station = locations.find((s: any) => s._id === formData.stationId);
      const result = await getPONumberHelper(station, currentOrderDate, newDeliveryDate, authHeader);

      // Update global date if helper shifted it
      if (result.finalOrderDate !== currentOrderDate) {
        currentOrderDate = result.finalOrderDate;
      }

      setFormData(prev => ({
        ...prev,
        poNumber: result.po,
        orderDate: currentOrderDate
      }));
    }

    // 2. Logic for Split Mode
    // If in Split mode, the Primary Station (index 0) dictates the Order Date for the truck
    const updatedSplits = [...formData.splits];

    for (let i = 0; i < updatedSplits.length; i++) {
      const split = updatedSplits[i];
      if (!split.stationId) continue;

      const station = locations.find((s: any) => s._id === split.stationId);
      const result = await getPONumberHelper(station, currentOrderDate, newDeliveryDate, authHeader);

      // If any station in the split forces a date change, we must update the whole truck
      if (result.finalOrderDate !== currentOrderDate) {
        currentOrderDate = result.finalOrderDate;
        // If date changed, we technically need to re-verify previous stations in the loop, 
        // but usually the first station (Master) governs this.
      }

      updatedSplits[i] = { ...split, poNumber: result.po };
    }

    setFormData(prev => ({
      ...prev,
      splits: updatedSplits,
      orderDate: currentOrderDate
    }));
  };

  const syncStationData = async (stationId: string, index: number, orderDate: string, deliveryDate: string) => {
    const station = locations.find((s: any) => s._id === stationId);
    if (!station) return;

    // 1. Get the current Rack data to know which grades are supported
    // We look at the master rackId in formData
    const currentRack = racks.find(r => r._id === formData.rackId);
    const rackGrades = currentRack?.availableGrades || [];
    const stationGrades = station.availableStationGrades || [];

    const tasks: Promise<any>[] = [];
    tasks.push(getPONumberHelper(station, orderDate, deliveryDate, authHeader));

    if (deliveryDate) {
      tasks.push(axios.get(`/api/fuel-station-tanks/station/${stationId}?date=${deliveryDate}`, authHeader));
    }

    try {
      const [poData, projRes] = await Promise.all(tasks);

      const groupedProjections = projRes?.data.tanks.reduce((acc: any, tank: any) => {
        if (!acc[tank.grade]) acc[tank.grade] = { opening: 0, sales: 0, capacity: 0, closing: 0 };
        acc[tank.grade].opening += tank.openingL;
        acc[tank.grade].sales += tank.estSalesL;
        acc[tank.grade].capacity += tank.maxVolumeCapacity;
        acc[tank.grade].closing += tank.closingL;
        return acc;
      }, {}) || {};

      setFormData(prev => {
        // INTERSECTION LOGIC: 
        // Only include grades that exist in BOTH the Station Tanks and the selected Rack
        const filteredItems = stationGrades
          .filter((grade: string) => rackGrades.includes(grade))
          .map((grade: string) => {
            // Preserve existing liters if the grade was already there
            const existing = prev.splits[index]?.items.find(i => i.grade === grade);
            return { grade, ltrs: existing?.ltrs || 0 };
          });

        const newSplits = [...prev.splits];
        newSplits[index] = {
          ...newSplits[index],
          stationId,
          poNumber: poData.po,
          projections: groupedProjections,
          items: filteredItems // Applied intersection here
        };

        const update = {
          ...prev,
          splits: newSplits,
          orderDate: poData.finalOrderDate
        };

        if (!isSplit && index === 0) {
          update.stationId = stationId;
          update.poNumber = poData.po;
          update.projections = groupedProjections;
          update.items = filteredItems;
        }

        return update;
      });
    } catch (err) {
      console.error("Sync Error:", err);
    }
  };


  // Find selected details for the PDF
  const selectedStation = locations.find((s: any) => s._id === formData.stationId);
  const selectedCarrier = carriers.find(c => c._id === formData.carrierId);
  const selectedRack = racks.find(r => r._id === formData.rackId);
  const selectedSupplier = suppliers.find(s => s._id === formData.supplierId);
  // Find the accountingId for the current badge selected
  const activeBadge = selectedSupplier?.supplierBadges?.find(
    (b: any) => b.badgeNumber === formData.badgeNo
  );
  const currentSupplierAccountingId = activeBadge?.accountingId || '';
  const currentCarrierId = selectedCarrier?.carrierId || '';

  // Function to trigger the flow
  const handleGenerateClick = () => {
    setIsVerifyOpen(true);
  };

  const handleConfirmLogistics = () => {
    setIsVerifyOpen(false);
    setIsPreviewOpen(true);
    // Clear highlights once the user confirms they've seen them
    setPreSelectedFields([]);
  };

  const GRADE_ORDER = ["Regular", "Premium", "Diesel", "Dyed Diesel"];

  const sortGrades = (items: FuelOrderItem[]) => {
    return [...items].sort((a, b) => {
      const indexA = GRADE_ORDER.indexOf(a.grade);
      const indexB = GRADE_ORDER.indexOf(b.grade);
      // If a grade isn't in our list, move it to the end
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });
  };

  // CSS for the highlight (Add to your global CSS or use a Tailwind class)
  // @keyframes pulse-highlight { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
  const highlightClass = "animate-pulse ring-2 ring-blue-500 ring-offset-2 border-blue-500";


  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Create Fuel Order</h1>
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
              className={cn("h-7 px-3", isSplit && "bg-white shadow-sm text-blue-600")}
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
            disabled={!formData.stationId || isSubmitting}
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
                <DialogDescription>
                  Please confirm the supply chain details are correct for this order.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="font-semibold text-muted-foreground">Rack:</div>
                  <div className="font-bold">{selectedRack?.rackName || 'Not Selected'}</div>

                  <div className="font-semibold text-muted-foreground">Carrier:</div>
                  <div className="font-bold">{selectedCarrier?.carrierName || 'Not Selected'}</div>

                  <div className="font-semibold text-muted-foreground">Supplier:</div>
                  <div className="font-bold">{selectedSupplier?.supplierName || 'Not Selected'}</div>

                  <div className="font-semibold text-muted-foreground">Badge:</div>
                  <div className="font-mono font-bold text-blue-600">{formData.badgeNo || 'None'}</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsVerifyOpen(false)}>Cancel & Edit</Button>
                <Button className="bg-blue-600" onClick={handleConfirmLogistics}>Confirm & Preview PDF</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
              <DialogHeader className="flex flex-row items-center justify-between pr-8">
                <div>
                  <DialogTitle>
                    PO Preview — {isSplit ? formData.splits[activeSplitIdx]?.poNumber : formData.poNumber}
                  </DialogTitle>
                  {isSplit && (
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">
                      Reviewing Split Load: Page {activeSplitIdx + 1} of 2
                    </p>
                  )}
                </div>

                {/* SPLIT LOAD SLIDER/TOGGLE */}
                {isSplit && (
                  <div className="flex bg-slate-100 p-1 rounded-lg border shadow-inner">
                    <Button
                      variant={activeSplitIdx === 0 ? "default" : "ghost"}
                      size="sm"
                      className={cn("h-7 px-4 text-[10px] font-black uppercase transition-all", activeSplitIdx === 0 ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}
                      onClick={() => setActiveSplitIdx(0)}
                    >
                      Site 1
                    </Button>
                    <Button
                      variant={activeSplitIdx === 1 ? "default" : "ghost"}
                      size="sm"
                      className={cn("h-7 px-4 text-[10px] font-black uppercase transition-all", activeSplitIdx === 1 ? "bg-white text-blue-600 shadow-sm" : "text-slate-500")}
                      onClick={() => setActiveSplitIdx(1)}
                    >
                      Site 2
                    </Button>
                  </div>
                )}
              </DialogHeader>

              <div className="flex-1 border rounded-lg overflow-hidden bg-slate-50 shadow-inner">
                <PDFViewer width="100%" height="100%" showToolbar={false}>
                  <POPreviewDocument
                    // Pass the split-specific data if in split mode, otherwise root data
                    data={{
                      ...formData,
                      poNumber: isSplit ? formData.splits[activeSplitIdx].poNumber : formData.poNumber,
                      items: isSplit ? formData.splits[activeSplitIdx].items : formData.items,
                    }}
                    selectedStation={isSplit
                      ? locations.find((l: any) => l._id === formData.splits[activeSplitIdx].stationId)
                      : selectedStation
                    }
                    carrierName={selectedCarrier?.carrierName}
                    rackName={selectedRack?.rackName}
                    rackLocation={selectedRack?.rackLocation}
                    carrierBookworksId={currentCarrierId}
                    supplierBookworksId={currentSupplierAccountingId}
                  />
                </PDFViewer>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-2">
                <div className="flex items-center gap-2">
                  <PDFDownloadLink
                    document={
                      <POPreviewDocument
                        data={{
                          ...formData,
                          poNumber: isSplit ? formData.splits[activeSplitIdx].poNumber : formData.poNumber,
                          items: isSplit ? formData.splits[activeSplitIdx].items : formData.items,
                        }}
                        selectedStation={isSplit
                          ? locations.find((l: any) => l._id === formData.splits[activeSplitIdx].stationId)
                          : selectedStation
                        }
                        carrierName={selectedCarrier?.carrierName}
                        rackName={selectedRack?.rackName}
                        rackLocation={selectedRack?.rackLocation}
                        carrierBookworksId={currentCarrierId}
                        supplierBookworksId={currentSupplierAccountingId}
                      />
                    }
                    // fileName={`Fuel Order Form NSP ${selectedStation?.fuelCustomerName || 'Order'} ${formatPDFDate(formData.deliveryDate, false)}.pdf`}

                    fileName={`Fuel Order Form NSP ${(isSplit
                      ? locations.find((l: any) => l._id === formData.splits[activeSplitIdx].stationId)?.fuelCustomerName
                      : selectedStation?.fuelCustomerName) || 'Order'
                      } ${formatPDFDate(formData.deliveryDate, false)}.pdf`}                  >
                    {({ loading }) => (
                      <Button variant="outline" disabled={loading} className="border-blue-200 text-blue-600 hover:bg-blue-50">
                        <Download className="w-4 h-4 mr-2" />
                        {loading ? "Preparing..." : isSplit ? `Download PO ${activeSplitIdx + 1}` : "Download PDF"}
                      </Button>
                    )}
                  </PDFDownloadLink>

                  {/* {isSplit && (
                    <p className="text-[10px] text-slate-400 italic">
                      * Download both POs separately if required.
                    </p>
                  )} */}
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>Back</Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 font-bold"
                    onClick={async () => {
                      await handleSubmit();
                      setIsPreviewOpen(false);
                    }}
                  >
                    Create Order & Push Draft
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: Logistics & Form */}
        <div className={cn(
          "col-span-12 transition-all duration-300",
          // CRITICAL: Shrink the left side when split is active so the right side can fit
          isSplit ? "lg:col-span-5 xl:col-span-6" : "lg:col-span-8"
        )}>
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
                      <Label className="text-blue-700 font-bold">Select Station</Label>
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
                              {s.stationName} <span className="text-xs text-muted-foreground ml-2">({s.tankCount} Tanks)</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.stationId && (
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">PO Number</Label>
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                            <Input
                              value={formData.poNumber}
                              onChange={(e) => setFormData(prev => ({ ...prev, poNumber: e.target.value }))}
                              className="h-8 pl-8 font-mono text-xs font-bold border-blue-200 focus-visible:ring-blue-500 bg-white"
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                            onClick={() => refreshAllPONumbers(formData.orderDate, formData.deliveryDate)}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // --- SPLIT MODE ---
                  formData.splits.map((split, idx) => (
                    <div key={idx} className="space-y-3 p-3 border rounded-xl bg-slate-50/50">
                      <div className="space-y-2">
                        <Label className="text-blue-700 font-bold">
                          Station {idx + 1} {idx === 0 && "(Master)"}
                        </Label>
                        <Select
                          value={split.stationId}
                          onValueChange={(v) => handleStationChange(v, idx)}
                          disabled={isLoadingLocations}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder={`Select Station ${idx + 1}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(locations || []).map((s: any) => (
                              <SelectItem key={s._id} value={s._id}>{s.stationName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {split.stationId && (
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">PO Number</Label>
                          <div className="flex gap-1.5">
                            <div className="relative flex-1">
                              <ShieldCheck className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                              <Input
                                value={split.poNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData(prev => {
                                    const newSplits = [...prev.splits];
                                    newSplits[idx] = { ...newSplits[idx], poNumber: val };
                                    return { ...prev, splits: newSplits };
                                  });
                                }}
                                className="h-8 pl-8 font-mono text-xs font-bold border-blue-200 focus-visible:ring-blue-500 bg-white"
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-blue-200 text-blue-600 hover:bg-blue-50"
                              onClick={() => refreshAllPONumbers(formData.orderDate, formData.deliveryDate)}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                          </div>
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
                      setFormData(prev => ({ ...prev, orderDate: newDate }));

                      // Refresh PO for all active stations
                      const activeStations = isSplit ? formData.splits : [{ stationId: formData.stationId }];
                      activeStations.forEach((s, idx) => {
                        if (s.stationId) syncStationData(s.stationId, idx, newDate, formData.deliveryDate);
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
                      setFormData(prev => ({ ...prev, deliveryDate: newDelDate }));

                      // Refresh PO and Projections for all active stations
                      const activeStations = isSplit ? formData.splits : [{ stationId: formData.stationId }];
                      activeStations.forEach((s, idx) => {
                        if (s.stationId) syncStationData(s.stationId, idx, formData.orderDate, newDelDate);
                      });
                    }}
                  />
                </div>

                {/* Window Start/End remain as they don't affect PO numbers */}
                <div className="space-y-2">
                  <Label>Window Start</Label>
                  <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Window End</Label>
                  <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-500" />
                Supply Chain Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Changed to grid-cols-1 (mobile), md:grid-cols-2, and xl:grid-cols-4 for better spacing */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6">

                {/* 1. Fuel Rack - Added Location */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Fuel Rack</Label>
                  <Select
                    value={formData.rackId}
                    onValueChange={(v) => {
                      handleRackChange(v);
                      setPreSelectedFields(prev => prev.filter(f => f !== 'rackId')); // Remove highlight on manual change
                    }}
                  >
                    <SelectTrigger className={cn("w-full transition-all duration-500", preSelectedFields.includes('rackId') && highlightClass)}>
                      <SelectValue placeholder="Select Rack" />
                    </SelectTrigger>
                    <SelectContent>
                      {racks.map((r: any) => (
                        <SelectItem key={r._id} value={r._id}>
                          <div className="flex flex-col">
                            <span>{r.rackName} - {r.rackLocation || ''}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Supplier */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Supplier</Label>
                  <Select value={formData.supplierId} onValueChange={handleSupplierChange}>
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

                {/* 3. Badge Number - Added Truncation and Min-Width */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Badge Number</Label>
                  <Select
                    value={formData.badgeNo}
                    onValueChange={(v) => setFormData({ ...formData, badgeNo: v })}
                  >
                    <SelectTrigger className="font-mono w-full overflow-hidden">
                      <div className="truncate text-left">
                        <SelectValue placeholder="Select Badge" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="max-w-[300px]">
                      {suppliers.find(s => s._id === formData.supplierId)?.supplierBadges.map((b) => (
                        <SelectItem key={b.badgeNumber} value={b.badgeNumber}>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{b.badgeNumber}</span>
                            <span className="text-muted-foreground text-xs truncate">— {b.badgeName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 4. Carrier */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wider">Carrier</Label>
                  <Select
                    value={formData.carrierId}
                    onValueChange={(v) => {
                      setFormData({ ...formData, carrierId: v });
                      setPreSelectedFields(prev => prev.filter(f => f !== 'carrierId')); // Remove highlight on manual change
                    }}
                  >
                    <SelectTrigger className={cn("w-full transition-all duration-500", preSelectedFields.includes('carrierId') && highlightClass)}>                      <div className="truncate text-left">
                      <SelectValue placeholder={carriers.length > 0 ? "Select Carrier" : "No carriers available"} />
                    </div>
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.map((c: any) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.carrierName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {carriers.length === 0 && formData.rackId && (
                    <p className="text-[10px] text-red-500 font-medium animate-pulse">Missing rack-carrier link.</p>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Order Quantities */}
        <div className={cn(
          "col-span-12 transition-all duration-300",
          // CRITICAL: Ensure Left (5) + Right (7) = 12
          isSplit ? "lg:col-span-7 xl:col-span-6" : "lg:col-span-4"
        )}>
          <Card className="h-full border-blue-100 bg-blue-50/30 flex flex-col">
            <CardHeader className="pb-3 border-b bg-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5 text-blue-600" />
                {isSplit ? "Split Load Config" : "Order Items"}
              </CardTitle>
            </CardHeader>

            <CardContent className={cn(
              "pt-4 flex-1",
              isSplit ? "grid grid-cols-2 gap-3 items-start" : "space-y-4"
            )}>
              {(isSplit ? formData.splits : [{
                stationId: formData.stationId,
                items: formData.items,
                projections: formData.projections,
                poNumber: formData.poNumber
              }]).map((section, sIdx) => {
                if (!section.stationId) return null;

                const sectionStation = locations.find((l: any) => l._id === section.stationId);
                const sortedItems = sortGrades(section.items);
                const totalSectionLtrs = sortedItems.reduce((sum, i) => sum + (Number(i.ltrs) || 0), 0);

                return (
                  <div key={sIdx} className={cn(
                    "flex flex-col",
                    // Use a subtle background and border to separate the two columns visually
                    isSplit && "bg-white/40 p-2 rounded-xl border border-blue-100/50"
                  )}>
                    {/* Header for Split Load - restore site names at top of each mini-column */}
                    {isSplit && (
                      <div className="mb-4 pb-2 border-b border-blue-100/50">
                        <p className="text-[11px] font-black uppercase text-blue-700 truncate">
                          {sectionStation?.stationName || 'Site ' + (sIdx + 1)}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-blue-100 text-slate-500">
                            PO: {section.poNumber}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className={cn("space-y-4", isSplit && "space-y-3")}>
                      {sortedItems.map((item) => {
                        const iIdx = section.items.findIndex(original => original.grade === item.grade);
                        const gradeData = section.projections?.[item.grade] || { opening: 0, sales: 0, capacity: 0, closing: 0 };
                        const userLtrs = Number(item.ltrs) || 0;
                        const finalClosing = (gradeData.closing + userLtrs);

                        const theme = getGradeTheme(item.grade);
                        const config = gradeConfig[item.grade] || { short: item.grade.substring(0, 3).toUpperCase() };

                        return (
                          <div key={item.grade} className="p-3 bg-white rounded-xl border shadow-sm relative overflow-hidden">
                            <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", theme.color)} />

                            <div className="flex items-center justify-between mb-2">
                              <div className="flex flex-col leading-tight">
                                <span className={cn(
                                  "font-black uppercase italic tracking-tight",
                                  isSplit ? "text-[11px]" : "text-sm" // Scale text based on mode
                                )}>
                                  {item.grade}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                                  {config.short}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  className={cn(
                                    "text-right font-mono font-bold border-2 focus:border-blue-500",
                                    isSplit ? "h-8 w-20 text-xs" : "h-9 w-28 text-sm" // Scale input size
                                  )}
                                  placeholder="0"
                                  value={item.ltrs || ''}
                                  onChange={(e) => {
                                    const value = Number(e.target.value);

                                    if (isSplit) {
                                      // 1. Create a deep copy of the splits array
                                      const newSplits = JSON.parse(JSON.stringify(formData.splits));

                                      // 2. We use iIdx which you correctly calculated using findIndex
                                      // on the original section.items array
                                      if (iIdx > -1) {
                                        newSplits[sIdx].items[iIdx].ltrs = value;
                                        setFormData({ ...formData, splits: newSplits });
                                      }
                                    } else {
                                      // 1. Create a deep copy of the items array
                                      const newItems = JSON.parse(JSON.stringify(formData.items));

                                      // 2. Find the index in the original array to avoid any sorting mismatch
                                      const originalIdx = newItems.findIndex((orig: any) => orig.grade === item.grade);

                                      if (originalIdx > -1) {
                                        newItems[originalIdx].ltrs = value;
                                        setFormData({ ...formData, items: newItems });
                                      }
                                    }
                                  }}
                                />
                                {!isSplit && <span className="text-[10px] font-black text-slate-400">LTRS</span>}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Est. Opening</span>
                                <span className={cn("font-mono font-bold text-slate-700", isSplit ? "text-[10px]" : "text-xs")}>
                                  {gradeData.opening.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Est. Sales</span>
                                <span className={cn("font-mono font-bold text-red-500", isSplit ? "text-[10px]" : "text-xs")}>
                                  -{gradeData.sales.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold text-blue-500 uppercase leading-none mb-1">Final Closing</span>
                                <span className={cn(
                                  "font-mono font-black",
                                  isSplit ? "text-[10px]" : "text-xs",
                                  finalClosing > gradeData.capacity ? "text-orange-600" : "text-blue-600"
                                )}>
                                  {finalClosing.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {gradeData.capacity > 0 && finalClosing > gradeData.capacity && (
                              <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                <AlertCircle className="h-3 w-3" />
                                Overflow Risk: Exceeds {gradeData.capacity.toLocaleString()}L Capacity
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 pt-4 border-t border-dashed border-blue-200">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                          {isSplit ? "Site Total" : "Total Volume:"}
                        </span>
                        <span className={cn("font-black text-blue-600 font-mono", isSplit ? "text-base" : "text-lg")}>
                          {totalSectionLtrs.toLocaleString()} <span className="text-xs font-bold">L</span>
                        </span>
                      </div>
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

// import {
//   useState,
//   // useEffect, useMemo
// } from 'react';
// import { cn } from "@/lib/utils";
// import { createFileRoute } from '@tanstack/react-router';
// import { useQuery } from "@tanstack/react-query"
// import axios from 'axios';
// import {
//   Building2, Truck, Fuel, RefreshCw, AlertCircle, ShieldCheck,
//   // Hash, Save,  CheckCircle2, Calendar, Clock
// } from 'lucide-react';
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";
// import { Label } from "@/components/ui/label";
// import { getGradeTheme } from "./manage/locations/$id"
// import { gradeConfig } from "./workspace"
// import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
// import { POPreviewDocument, formatPDFDate } from "@/components/custom/fuelPoPDF"

// export const Route = createFileRoute('/_navbarLayout/fuel-management/create-order')({
//   component: CreateFuelOrder,
// });

// interface FuelOrderItem {
//   grade: string;
//   ltrs: number;
// }

// interface FuelOrderFormData {
//   stationId: string;
//   orderDate: string;
//   deliveryDate: string;
//   startTime: string;
//   endTime: string;
//   rackId: string;
//   supplierId: string;
//   badgeNo: string;
//   carrierId: string;
//   poNumber: string;
//   items: FuelOrderItem[]; // This tells TS exactly what's in the array
// }

// interface SupplierBadge {
//   badgeName: string;
//   badgeNumber: string;
//   isDefault: boolean;
// }

// interface FuelSupplier {
//   _id: string;
//   supplierName: string;
//   associatedRack: string;
//   supplierBadges: SupplierBadge[]; // Array of badges inside the supplier
// }

// interface GradeProjection {
//   opening: number;
//   sales: number;
//   capacity: number;
//   closing: number;
// }

// function CreateFuelOrder() {
//   // --- State Management ---
//   const [racks, setRacks] = useState<any[]>([]);
//   const [carriers, setCarriers] = useState<any[]>([]);

//   // Corrected: Suppliers should be an array of FuelSupplier objects
//   const [suppliers, setSuppliers] = useState<FuelSupplier[]>([]);
//   // --- 2. Submit Logic ---
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [isPreviewOpen, setIsPreviewOpen] = useState(false);

//   const [preSelectedFields, setPreSelectedFields] = useState<string[]>([]);
//   const [isVerifyOpen, setIsVerifyOpen] = useState(false);

//   const [formData, setFormData] = useState<FuelOrderFormData>({
//     stationId: '',
//     orderDate: new Date().toISOString().split('T')[0],
//     deliveryDate: '',
//     startTime: '08:00',
//     endTime: '12:00',
//     rackId: '',
//     supplierId: '',
//     badgeNo: '',
//     carrierId: '',
//     poNumber: '',
//     items: [] // Now TS knows this is an array of FuelOrderItem
//   });

//   const authHeader = {
//     headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
//   };

//   const [projections, setProjections] = useState<Record<string, GradeProjection>>({});
//   // --- Fetch Locations using TanStack Query ---
//   const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
//     queryKey: ['locations-list'],
//     queryFn: async () => {
//       const res = await axios.get('/api/fuel-station-tanks/all-locations', authHeader);
//       return res.data;
//     },
//     staleTime: 0
//   });

//   // --- Cascading Logic: Station Selection ---
//   // Inside your RouteComponent...

//   const handleStationChange = async (stationId: string) => {
//     const station = locations.find((s: any) => s._id === stationId);
//     console.log("Selected Station:", station); // LOG 1

//     if (!station) return;

//     try {
//       const racksRes = await axios.get('/api/fuel-racks', authHeader);
//       setRacks(racksRes.data);

//       // Get the IDs safely
//       const defaultRackId = station.defaultFuelRack?._id || station.defaultFuelRack || '';
//       const stationDefaultCarrierId = station.defaultFuelCarrier?._id || station.defaultFuelCarrier || '';

//       console.log("Extracted Defaults - Rack:", defaultRackId, "Carrier:", stationDefaultCarrierId); // LOG 2

//       setFormData(prev => ({
//         ...prev,
//         stationId,
//         rackId: defaultRackId,
//         carrierId: stationDefaultCarrierId,
//       }));

//       if (defaultRackId) {
//         // We pass the carrier ID directly to avoid stale state issues
//         handleRackChange(defaultRackId, stationId, stationDefaultCarrierId);
//       }
//       if (formData.deliveryDate) fetchProjections(stationId, formData.deliveryDate);
//       setPreSelectedFields(['rackId', 'carrierId']);

//     } catch (err) {
//       console.error("Station Change Error:", err);
//     }
//   };

//   const handleRackChange = async (
//     rackId: string,
//     currentStationId?: string,
//     passedCarrierId?: string
//   ) => {
//     try {
//       console.log("Fetching Rack Data for:", rackId); // LOG 3
//       const rackRes = await axios.get(`/api/fuel-racks/${rackId}`, authHeader);
//       const rack = rackRes.data;
//       console.log("Rack Details:", rack); // LOG 4

//       // Fetch Suppliers
//       const supplierRes = await axios.get(`/api/fuel-suppliers?associatedRack=${rackId}`, authHeader);
//       const rackSuppliers = supplierRes.data;
//       setSuppliers(rackSuppliers);

//       // Faster alternative if the Rack is already populated
//       const rackCarriers = rack.associatedCarriers || [];
//       setCarriers(rackCarriers);

//       // 1. Identify the current station from our query data
//       const targetStationId = currentStationId || formData.stationId;
//       const station = locations.find((s: any) => s._id === targetStationId);

//       // 2. Get the grades available in the station's tanks (from our new backend field)
//       const stationGrades = station?.availableStationGrades || [];

//       // Supplier/Badge Logic
//       const defaultSup = rackSuppliers.find((s: any) => s._id === rack.defaultSupplier) || rackSuppliers[0];
//       const defaultBadge = defaultSup?.supplierBadges?.find((b: any) => b.isDefault) || defaultSup?.supplierBadges?.[0];

//       // CARRIER LOGIC:
//       // We use the passedCarrierId (from the station) or fallback to the one in the list
//       const finalCarrierId = passedCarrierId || rackCarriers[0]?._id || '';

//       // Check if the station's default is actually allowed at this rack
//       const isAllowed = rackCarriers.some((c: any) => c._id === finalCarrierId);

//       console.log("Carrier Selection - Requested:", finalCarrierId, "Is Allowed:", isAllowed); // LOG 7

//       setFormData(prev => {
//         // 3. INTERSECTION LOGIC:
//         // Only include grades that the Rack provides AND the Station has tanks for
//         const filteredItems = rack.availableGrades
//           .filter((grade: string) => stationGrades.includes(grade))
//           .map((grade: string) => ({ grade, ltrs: 0 }));

//         return {
//           ...prev,
//           rackId,
//           supplierId: defaultSup?._id || '',
//           badgeNo: defaultBadge?.badgeNumber || '',
//           carrierId: isAllowed ? finalCarrierId : (rackCarriers[0]?._id || ''),
//           items: filteredItems // Applied the filter here
//         };
//       });

//       // Trigger PO Generation
//       generatePONumber(currentStationId || formData.stationId, formData.orderDate, formData.deliveryDate);
//     } catch (err) {
//       console.error("Error in Rack domino chain:", err);
//     }
//   };

//   // New handler for when the user manually changes the supplier
//   const handleSupplierChange = (supplierId: string) => {
//     const selectedSup = suppliers.find(s => s._id === supplierId);

//     // Find default badge, or just pick the first one if no default exists
//     const defaultBadge = selectedSup?.supplierBadges?.find(b => b.isDefault)
//       || selectedSup?.supplierBadges?.[0];

//     setFormData(prev => ({
//       ...prev,
//       supplierId,
//       badgeNo: defaultBadge?.badgeNumber || ''
//     }));
//   };

//   const generatePONumber = async (sId: string, oDate: string, dDate: string) => {
//     const station = locations.find((s: any) => s._id === sId);
//     // Keep your top-level check
//     if (!station || !oDate || !dDate) return;

//     const getFormattedPart = (dateStr: string) => {
//       const dateObj = new Date(dateStr + 'T00:00:00');
//       const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
//       const dd = dateObj.getDate().toString().padStart(2, '0');
//       const yy = dateObj.getFullYear().toString().slice(-2);
//       return `${mm}${dd}${yy}`;
//     };

//     const stationNum = String(station.fuelStationNumber).padStart(2, '0');

//     try {
//       const res = await axios.get(
//         `/api/fuel-orders/check-existing?stationId=${sId}&orderDate=${oDate}`,
//         authHeader
//       );

//       const { count, existingOrders } = res.data;

//       // --- Validation Logic ---
//       if (count > 0) {
//         // Use originalDeliveryDate from the backend objects
//         const differentDeliveryDate = existingOrders.find((order: any) => {
//           if (!order.originalDeliveryDate) return false;
//           const existingD = new Date(order.originalDeliveryDate).toISOString().split('T')[0];
//           return existingD !== dDate;
//         });

//         const sameDeliveryDate = existingOrders.find((order: any) => {
//           if (!order.originalDeliveryDate) return false;
//           const existingD = new Date(order.originalDeliveryDate).toISOString().split('T')[0];
//           return existingD === dDate;
//         });

//         if (differentDeliveryDate) {
//           // Logic: Calculate tomorrow's date
//           const tomorrow = new Date(oDate + 'T00:00:00');
//           tomorrow.setDate(tomorrow.getDate() + 1);
//           const tomorrowStr = tomorrow.toISOString().split('T')[0];

//           alert(`CRITICAL: An order exists for this date with a different delivery date. To maintain consistency, we are moving this Order Date to tomorrow (${tomorrowStr}).`);

//           // Recursive call with the new date
//           setFormData(prev => ({ ...prev, orderDate: tomorrowStr }));
//           generatePONumber(sId, tomorrowStr, dDate);
//           return;
//         }

//         if (sameDeliveryDate) {
//           const nextLoad = count + 1;
//           const confirm = window.confirm(`Notice: There is already a load scheduled for delivery on ${dDate}. Do you want to create another load (Load #${nextLoad}) for this same day?`);

//           if (!confirm) return;

//           // If confirmed, update PO with the next load number
//           const newPO = `NSP${getFormattedPart(oDate)}-${stationNum}${nextLoad}`;
//           setFormData(prev => ({ ...prev, poNumber: newPO }));
//           return;
//         }
//       }

//       // Default Case (No existing orders or fresh date)
//       const newPO = `NSP${getFormattedPart(oDate)}-${stationNum}${count + 1}`;
//       setFormData(prev => ({ ...prev, poNumber: newPO }));

//     } catch (err) {
//       console.error("PO Gen Error", err);
//     }
//   };

//   // --- 1. Reset Logic ---
//   const handleReset = () => {
//     setFormData({
//       stationId: '',
//       orderDate: new Date().toISOString().split('T')[0],
//       deliveryDate: '',
//       startTime: '08:00',
//       endTime: '12:00',
//       rackId: '',
//       supplierId: '',
//       badgeNo: '',
//       carrierId: '',
//       poNumber: '',
//       items: []
//     });
//     // Clear the cascading dropdown lists
//     setRacks([]);
//     setCarriers([]);
//     setSuppliers([]);
//   };

//   // const handleSubmit = async () => {
//   //   // Validation: Ensure mandatory fields are present
//   //   if (!formData.stationId || !formData.rackId || !formData.poNumber) {
//   //     alert("Please select a Station and Rack before submitting.");
//   //     return;
//   //   }

//   //   // Validation: Ensure at least one item has liters
//   //   const hasFuel = formData.items.some(item => (item.ltrs || 0) > 0);
//   //   if (!hasFuel) {
//   //     alert("Please enter a quantity for at least one fuel grade.");
//   //     return;
//   //   }

//   //   try {
//   //     setIsSubmitting(true);

//   //     // We send the formData as is; the backend handles mapping to Schema field names
//   //     const response = await axios.post('/api/fuel-orders', formData, authHeader);

//   //     if (response.status === 201) {
//   //       alert(`Success! Order ${response.data.poNumber} has been created.`);
//   //       handleReset(); // Clear the form
//   //     }
//   //   } catch (err: any) {
//   //     const errorMsg = err.response?.data?.message || "Failed to save the order.";
//   //     alert(errorMsg);
//   //     console.error("Submission Error:", err);
//   //   } finally {
//   //     setIsSubmitting(false);
//   //   }
//   // };
//   const handleSubmit = async () => {
//     // 1. Validation: Ensure mandatory fields are present
//     if (!formData.stationId || !formData.rackId || !formData.poNumber) {
//       alert("Please select a Station and Rack before submitting.");
//       return;
//     }

//     // 2. Validation: Ensure at least one item has liters
//     const hasFuel = formData.items.some(item => (item.ltrs || 0) > 0);
//     if (!hasFuel) {
//       alert("Please enter a quantity for at least one fuel grade.");
//       return;
//     }

//     try {
//       setIsSubmitting(true);

//       // 3. Generate the PDF Blob directly from the component
//       const doc = (
//         <POPreviewDocument
//           data={formData}
//           selectedStation={selectedStation}
//           carrierName={selectedCarrier?.carrierName}
//           rackName={selectedRack?.rackName}
//           rackLocation={selectedRack?.rackLocation}
//         />
//       );

//       const blob = await pdf(doc).toBlob();

//       // 4. Convert Blob to Base64 to send in JSON
//       const reader = new FileReader();
//       reader.readAsDataURL(blob);
//       reader.onloadend = async () => {
//         const base64data = (reader.result as string).split(',')[1];

//         // 5. Send formData + the PDF string to your backend
//         const payload = {
//           ...formData,
//           pdfBase64: base64data
//         };

//         const response = await axios.post('/api/fuel-orders', payload, authHeader);

//         if (response.status === 201) {
//           const { order, pushedTo } = response.data;

//           alert(`Success! Order ${order.poNumber} created.\n\nA draft has been pushed to: ${pushedTo}`);

//           handleReset();
//           if (setIsPreviewOpen) setIsPreviewOpen(false);
//         }
//       };

//     } catch (err: any) {
//       const errorMsg = err.response?.data?.message || "Failed to save the order.";
//       alert(errorMsg);
//       console.error("Submission Error:", err);
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const fetchProjections = async (sId: string, dDate: string) => {
//     if (!sId || !dDate) return;
//     try {
//       const res = await axios.get(`/api/fuel-station-tanks/station/${sId}?date=${dDate}`, authHeader);

//       // Group tank data by grade for the UI
//       const grouped = res.data.tanks.reduce((acc: any, tank: any) => {
//         if (!acc[tank.grade]) {
//           acc[tank.grade] = { opening: 0, sales: 0, capacity: 0, closing: 0 };
//         }
//         acc[tank.grade].opening += tank.openingL;
//         acc[tank.grade].sales += tank.estSalesL;
//         acc[tank.grade].capacity += tank.maxVolumeCapacity;
//         acc[tank.grade].closing += tank.closingL;
//         return acc;
//       }, {});

//       setProjections(grouped);
//     } catch (err) {
//       console.error("Error fetching projections:", err);
//     }
//   };


//   // Find selected details for the PDF
//   const selectedStation = locations.find((s: any) => s._id === formData.stationId);
//   const selectedCarrier = carriers.find(c => c._id === formData.carrierId);
//   const selectedRack = racks.find(r => r._id === formData.rackId);
//   const selectedSupplier = suppliers.find(s => s._id === formData.supplierId);

//   // Function to trigger the flow
//   const handleGenerateClick = () => {
//     setIsVerifyOpen(true);
//   };

//   const handleConfirmLogistics = () => {
//     setIsVerifyOpen(false);
//     setIsPreviewOpen(true);
//     // Clear highlights once the user confirms they've seen them
//     setPreSelectedFields([]);
//   };

//   // CSS for the highlight (Add to your global CSS or use a Tailwind class)
//   // @keyframes pulse-highlight { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
//   const highlightClass = "animate-pulse ring-2 ring-blue-500 ring-offset-2 border-blue-500";


//   return (
//     <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
//       <div className="flex justify-between items-center">
//         <h1 className="text-3xl font-bold tracking-tight">Create Fuel Order</h1>
//         <div className="flex gap-3">
//           <Button
//             variant="outline"
//             onClick={handleReset}
//             disabled={isSubmitting}
//           >
//             Reset Form
//           </Button>

//           <Button
//             className="bg-blue-600 hover:bg-blue-700"
//             onClick={handleGenerateClick}
//             disabled={!formData.stationId || isSubmitting}
//           >
//             Generate PO PDF
//           </Button>
//           {/* 2. Verification Dialog */}
//           <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
//             <DialogContent className="sm:max-w-[425px]">
//               <DialogHeader>
//                 <DialogTitle className="flex items-center gap-2">
//                   <ShieldCheck className="w-5 h-5 text-green-600" />
//                   Verify Logistics
//                 </DialogTitle>
//                 <DialogDescription>
//                   Please confirm the supply chain details are correct for this order.
//                 </DialogDescription>
//               </DialogHeader>
//               <div className="space-y-4 py-4">
//                 <div className="grid grid-cols-2 gap-4 text-sm">
//                   <div className="font-semibold text-muted-foreground">Rack:</div>
//                   <div className="font-bold">{selectedRack?.rackName || 'Not Selected'}</div>

//                   <div className="font-semibold text-muted-foreground">Carrier:</div>
//                   <div className="font-bold">{selectedCarrier?.carrierName || 'Not Selected'}</div>

//                   <div className="font-semibold text-muted-foreground">Supplier:</div>
//                   <div className="font-bold">{selectedSupplier?.supplierName || 'Not Selected'}</div>

//                   <div className="font-semibold text-muted-foreground">Badge:</div>
//                   <div className="font-mono font-bold text-blue-600">{formData.badgeNo || 'None'}</div>
//                 </div>
//               </div>
//               <DialogFooter>
//                 <Button variant="outline" onClick={() => setIsVerifyOpen(false)}>Cancel & Edit</Button>
//                 <Button className="bg-blue-600" onClick={handleConfirmLogistics}>Confirm & Preview PDF</Button>
//               </DialogFooter>
//             </DialogContent>
//           </Dialog>
//           <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
//             <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
//               <DialogHeader>
//                 <DialogTitle>PO Preview - {formData.poNumber}</DialogTitle>
//               </DialogHeader>

//               <div className="flex-1 border rounded-lg overflow-hidden">
//                 <PDFViewer width="100%" height="100%" showToolbar={false}>
//                   <POPreviewDocument
//                     data={formData}
//                     selectedStation={selectedStation}
//                     carrierName={selectedCarrier?.carrierName}
//                     rackName={selectedRack?.rackName}
//                     rackLocation={selectedRack?.rackLocation}
//                   />
//                 </PDFViewer>
//               </div>

//               <DialogFooter className="flex justify-between items-center sm:justify-between">
//                 <PDFDownloadLink
//                   document={
//                     <POPreviewDocument
//                       data={formData}
//                       selectedStation={selectedStation}
//                       carrierName={selectedCarrier?.carrierName}
//                       rackName={selectedRack?.rackName}
//                       rackLocation={selectedRack?.rackLocation}
//                     />
//                   }
//                   fileName={`Fuel Order Form NSP ${selectedStation?.fuelCustomerName || 'Order'} ${formatPDFDate(formData.deliveryDate, false)}.pdf`}
//                 >
//                   {({ loading }) => (
//                     <Button variant="outline" disabled={loading}>
//                       {loading ? "Preparing..." : "Download PDF"}
//                     </Button>
//                   )}
//                 </PDFDownloadLink>

//                 <Button
//                   className="bg-green-600 hover:bg-green-700"
//                   onClick={async () => {
//                     await handleSubmit();
//                     setIsPreviewOpen(false);
//                   }}
//                 >
//                   Create Order & Push Draft
//                 </Button>
//               </DialogFooter>
//             </DialogContent>
//           </Dialog>
//         </div>
//       </div>

//       <div className="grid grid-cols-12 gap-6">
//         {/* LEFT COLUMN: Logistics & Details */}
//         <div className="col-span-12 lg:col-span-8 space-y-6">
//           <Card>
//             <CardHeader className="pb-3 border-b">
//               <CardTitle className="text-lg flex items-center gap-2">
//                 <Building2 className="w-5 h-5 text-blue-500" />
//                 Station & Scheduling
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
//               <div className="space-y-2">
//                 <Label>Select Station</Label>
//                 <Select onValueChange={handleStationChange} disabled={isLoadingLocations}>
//                   <SelectTrigger>
//                     <SelectValue placeholder={isLoadingLocations ? "Loading..." : "Choose Station..."} />
//                   </SelectTrigger>
//                   <SelectContent>
//                     {/* The (locations || []) ensures that if the API fails or returns null,
//                        the map doesn't crash the app.
//                     */}
//                     {(locations || []).map((s: any) => (
//                       <SelectItem key={s._id} value={s._id}>
//                         {s.stationName} <span className="text-xs text-muted-foreground ml-2">({s.tankCount} Tanks)</span>
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="space-y-2">
//                 <Label>Order Date</Label>
//                 {/* Order Date Input */}
//                 <Input
//                   type="date"
//                   value={formData.orderDate}
//                   onChange={(e) => {
//                     const newDate = e.target.value;
//                     setFormData(prev => ({ ...prev, orderDate: newDate }));
//                     generatePONumber(formData.stationId, newDate, formData.deliveryDate);
//                   }}
//                 />


//               </div>

//               <div className="space-y-2">
//                 <Label>PO Number (Auto-Generated)</Label>
//                 <div className="flex gap-2">
//                   <Input value={formData.poNumber} onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })} />
//                   <Button size="icon" variant="ghost" onClick={() => generatePONumber(formData.stationId, formData.orderDate, formData.deliveryDate)}>
//                     <RefreshCw className="w-4 h-4" />
//                   </Button>
//                 </div>
//               </div>

//               <div className="space-y-2">
//                 <Label>Delivery Date</Label>
//                 {/* Delivery Date Input */}
//                 <Input
//                   type="date"
//                   value={formData.deliveryDate}
//                   onChange={(e) => {
//                     const newDelDate = e.target.value;
//                     setFormData(prev => ({ ...prev, deliveryDate: newDelDate }));
//                     fetchProjections(formData.stationId, newDelDate);
//                     generatePONumber(formData.stationId, formData.orderDate, newDelDate);
//                   }}
//                 />
//               </div>

//               <div className="space-y-2">
//                 <Label>Window Start</Label>
//                 <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
//               </div>

//               <div className="space-y-2">
//                 <Label>Window End</Label>
//                 <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
//               </div>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader className="pb-3 border-b">
//               <CardTitle className="text-lg flex items-center gap-2">
//                 <Truck className="w-5 h-5 text-orange-500" />
//                 Supply Chain Details
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="pt-6">
//               {/* Changed to grid-cols-1 (mobile), md:grid-cols-2, and xl:grid-cols-4 for better spacing */}
//               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-8 gap-y-6">

//                 {/* 1. Fuel Rack - Added Location */}
//                 <div className="space-y-2">
//                   <Label className="text-muted-foreground text-xs uppercase tracking-wider">Fuel Rack</Label>
//                   <Select
//                     value={formData.rackId}
//                     onValueChange={(v) => {
//                       handleRackChange(v);
//                       setPreSelectedFields(prev => prev.filter(f => f !== 'rackId')); // Remove highlight on manual change
//                     }}
//                   >
//                     <SelectTrigger className={cn("w-full transition-all duration-500", preSelectedFields.includes('rackId') && highlightClass)}>
//                       <SelectValue placeholder="Select Rack" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {racks.map((r: any) => (
//                         <SelectItem key={r._id} value={r._id}>
//                           <div className="flex flex-col">
//                             <span>{r.rackName} - {r.rackLocation || ''}</span>
//                           </div>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 {/* 2. Supplier */}
//                 <div className="space-y-2">
//                   <Label className="text-muted-foreground text-xs uppercase tracking-wider">Supplier</Label>
//                   <Select value={formData.supplierId} onValueChange={handleSupplierChange}>
//                     <SelectTrigger className="w-full">
//                       <SelectValue placeholder="Select Supplier" />
//                     </SelectTrigger>
//                     <SelectContent>
//                       {suppliers.map((s: any) => (
//                         <SelectItem key={s._id} value={s._id}>
//                           {s.supplierName}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 {/* 3. Badge Number - Added Truncation and Min-Width */}
//                 <div className="space-y-2">
//                   <Label className="text-muted-foreground text-xs uppercase tracking-wider">Badge Number</Label>
//                   <Select
//                     value={formData.badgeNo}
//                     onValueChange={(v) => setFormData({ ...formData, badgeNo: v })}
//                   >
//                     <SelectTrigger className="font-mono w-full overflow-hidden">
//                       <div className="truncate text-left">
//                         <SelectValue placeholder="Select Badge" />
//                       </div>
//                     </SelectTrigger>
//                     <SelectContent className="max-w-[300px]">
//                       {suppliers.find(s => s._id === formData.supplierId)?.supplierBadges.map((b) => (
//                         <SelectItem key={b.badgeNumber} value={b.badgeNumber}>
//                           <div className="flex items-center gap-2">
//                             <span className="font-bold">{b.badgeNumber}</span>
//                             <span className="text-muted-foreground text-xs truncate">— {b.badgeName}</span>
//                           </div>
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 {/* 4. Carrier */}
//                 <div className="space-y-2">
//                   <Label className="text-muted-foreground text-xs uppercase tracking-wider">Carrier</Label>
//                   <Select
//                     value={formData.carrierId}
//                     onValueChange={(v) => {
//                       setFormData({ ...formData, carrierId: v });
//                       setPreSelectedFields(prev => prev.filter(f => f !== 'carrierId')); // Remove highlight on manual change
//                     }}
//                   >
//                     <SelectTrigger className={cn("w-full transition-all duration-500", preSelectedFields.includes('carrierId') && highlightClass)}>                      <div className="truncate text-left">
//                       <SelectValue placeholder={carriers.length > 0 ? "Select Carrier" : "No carriers available"} />
//                     </div>
//                     </SelectTrigger>
//                     <SelectContent>
//                       {carriers.map((c: any) => (
//                         <SelectItem key={c._id} value={c._id}>
//                           {c.carrierName}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                   {carriers.length === 0 && formData.rackId && (
//                     <p className="text-[10px] text-red-500 font-medium animate-pulse">Missing rack-carrier link.</p>
//                   )}
//                 </div>

//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* RIGHT COLUMN: Order Quantities */}
//         <div className="col-span-12 lg:col-span-4">
//           <Card className="h-full border-blue-100 bg-blue-50/30">
//             <CardHeader className="pb-3 border-b bg-white">
//               <CardTitle className="text-lg flex items-center gap-2">
//                 <Fuel className="w-5 h-5 text-blue-600" />
//                 Order Items
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="pt-1 space-y-4">
//               {/* CASE 1: FORM IS EMPTY (Initial State) */}
//               {!formData.stationId ? (
//                 <div className="text-center py-10 text-muted-foreground px-4 animate-in fade-in duration-500">
//                   <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
//                     <Building2 className="w-6 h-6 opacity-20" />
//                   </div>
//                   <p className="text-sm font-black uppercase tracking-tight">Awaiting Selection</p>
//                   <p className="text-[10px] mt-1 font-medium">
//                     Select a <strong>Station</strong> and <strong>Rack</strong> to load available fuel grades.
//                   </p>
//                 </div>
//               ) : (
//                 <>
//                   {/* CASE 2: STATION SELECTED BUT NO OVERLAP WITH RACK (The "Conflict" State) */}
//                   {formData.items.length === 0 ? (
//                     <div className="text-center py-10 px-4 bg-amber-50/50 rounded-xl border border-amber-100 border-dashed animate-in zoom-in-95 duration-300">
//                       <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
//                       <p className="text-sm font-black uppercase tracking-tight text-amber-700">Mismatch Detected</p>
//                       <p className="text-[10px] mt-1 text-amber-600 leading-relaxed font-medium">
//                         The selected <strong>Rack</strong> does not provide any fuel grades that match this <strong>Station's</strong> tank configuration.
//                       </p>
//                     </div>
//                   ) : (
//                     formData.items.map((item, idx) => {
//                       const gradeData = projections[item.grade] || { opening: 0, sales: 0, capacity: 0, closing: 0 };
//                       const userLtrs = Number(item.ltrs) || 0;

//                       // Theme & Config details
//                       const theme = getGradeTheme(item.grade);
//                       const config = gradeConfig[item.grade] || { short: item.grade.substring(0, 3).toUpperCase() };

//                       // DYNAMIC MATH:
//                       const finalClosing = (gradeData.closing + userLtrs);

//                       return (
//                         <div key={item.grade} className="p-3 bg-white rounded-xl border shadow-sm relative overflow-hidden">
//                           {/* High-Contrast Color Accent */}
//                           <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", theme.color)} />

//                           {/* TOP ROW: Grade & Input */}
//                           <div className="flex items-center justify-between mb-2">
//                             <div className="flex flex-col leading-tight">
//                               <span className={cn("font-black uppercase italic text-sm tracking-tight", theme.label)}>
//                                 {item.grade}
//                               </span>
//                               <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">
//                                 {config.short}
//                               </span>
//                             </div>

//                             <div className="flex items-center gap-2">
//                               <Input
//                                 type="number"
//                                 className="h-9 w-28 text-right font-mono font-bold border-2 focus:border-blue-500"
//                                 placeholder="0"
//                                 value={item.ltrs || ''}
//                                 onChange={(e) => {
//                                   const value = Number(e.target.value);
//                                   const newItems = [...formData.items];
//                                   newItems[idx] = { ...newItems[idx], ltrs: value };
//                                   setFormData({ ...formData, items: newItems });
//                                 }}
//                               />
//                               <span className="text-[10px] font-black text-slate-400">LTRS</span>
//                             </div>
//                           </div>

//                           {/* BOTTOM ROW: Metrics Grid (Compact but readable) */}
//                           <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
//                             <div className="flex flex-col">
//                               <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Est. Opening</span>
//                               <span className="text-xs font-mono font-bold text-slate-700">
//                                 {gradeData.opening.toLocaleString()}
//                               </span>
//                             </div>

//                             <div className="flex flex-col">
//                               <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Est. Sales</span>
//                               <span className="text-xs font-mono font-bold text-red-500">
//                                 -{gradeData.sales.toLocaleString()}
//                               </span>
//                             </div>

//                             <div className="flex flex-col items-end">
//                               <span className="text-[9px] font-bold text-blue-500 uppercase leading-none mb-1">Final Closing</span>
//                               <span className={cn(
//                                 "text-xs font-mono font-black",
//                                 finalClosing > gradeData.capacity ? "text-orange-600" : "text-blue-600"
//                               )}>
//                                 {finalClosing.toLocaleString()}
//                               </span>
//                             </div>
//                           </div>

//                           {/* OVERFLOW WARNING (Only if needed) */}
//                           {gradeData.capacity > 0 && finalClosing > gradeData.capacity && (
//                             <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-1 rounded border border-orange-100">
//                               <AlertCircle className="h-3 w-3" />
//                               Overflow Risk: Exceeds {gradeData.capacity.toLocaleString()}L Capacity
//                             </div>
//                           )}
//                         </div>
//                       );
//                     })
//                   )}
//                 </>
//               )}
//               {formData.items.length > 0 && (
//                 <div className="pt-4 border-t border-dashed">
//                   <div className="flex justify-between items-center text-lg font-bold px-2">
//                     <span>Total Volume:</span>
//                     <span className="text-blue-600">
//                       {formData.items.reduce((sum, i) => sum + (i.ltrs || 0), 0).toLocaleString()} L
//                     </span>
//                   </div>
//                 </div>
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div >
//   );
// }