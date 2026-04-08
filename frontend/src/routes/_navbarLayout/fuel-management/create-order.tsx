import {
  useState,
  // useEffect, useMemo 
} from 'react';
import { cn } from "@/lib/utils";
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from "@tanstack/react-query"
import axios from 'axios';
import {
  Building2, Truck, Fuel, RefreshCw, AlertCircle,
  // Hash, Save,  CheckCircle2, Calendar, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getGradeTheme } from "./manage/locations/$id"
import { gradeConfig } from "./workspace"
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { POPreviewDocument, formatPDFDate } from "@/components/custom/fuelPoPDF"

export const Route = createFileRoute('/_navbarLayout/fuel-management/create-order')({
  component: CreateFuelOrder,
});

interface FuelOrderItem {
  grade: string;
  ltrs: number;
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
  items: FuelOrderItem[]; // This tells TS exactly what's in the array
}

interface SupplierBadge {
  badgeName: string;
  badgeNumber: string;
  isDefault: boolean;
}

interface FuelSupplier {
  _id: string;
  supplierName: string;
  associatedRack: string;
  supplierBadges: SupplierBadge[]; // Array of badges inside the supplier
}

interface GradeProjection {
  opening: number;
  sales: number;
  capacity: number;
  closing: number;
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
    items: [] // Now TS knows this is an array of FuelOrderItem
  });

  const authHeader = {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  };

  const [projections, setProjections] = useState<Record<string, GradeProjection>>({});
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

  const handleStationChange = async (stationId: string) => {
    const station = locations.find((s: any) => s._id === stationId);
    console.log("Selected Station:", station); // LOG 1

    if (!station) return;

    try {
      const racksRes = await axios.get('/api/fuel-racks', authHeader);
      setRacks(racksRes.data);

      // Get the IDs safely
      const defaultRackId = station.defaultFuelRack?._id || station.defaultFuelRack || '';
      const stationDefaultCarrierId = station.defaultFuelCarrier?._id || station.defaultFuelCarrier || '';

      console.log("Extracted Defaults - Rack:", defaultRackId, "Carrier:", stationDefaultCarrierId); // LOG 2

      setFormData(prev => ({
        ...prev,
        stationId,
        rackId: defaultRackId,
        carrierId: stationDefaultCarrierId,
      }));

      if (defaultRackId) {
        // We pass the carrier ID directly to avoid stale state issues
        handleRackChange(defaultRackId, stationId, stationDefaultCarrierId);
      }
      if (formData.deliveryDate) fetchProjections(stationId, formData.deliveryDate);

    } catch (err) {
      console.error("Station Change Error:", err);
    }
  };

  const handleRackChange = async (
    rackId: string,
    currentStationId?: string,
    passedCarrierId?: string
  ) => {
    try {
      console.log("Fetching Rack Data for:", rackId); // LOG 3
      const rackRes = await axios.get(`/api/fuel-racks/${rackId}`, authHeader);
      const rack = rackRes.data;
      console.log("Rack Details:", rack); // LOG 4

      // Fetch Suppliers
      const supplierRes = await axios.get(`/api/fuel-suppliers?associatedRack=${rackId}`, authHeader);
      const rackSuppliers = supplierRes.data;
      setSuppliers(rackSuppliers);

      // Faster alternative if the Rack is already populated
      const rackCarriers = rack.associatedCarriers || [];
      setCarriers(rackCarriers);

      // 1. Identify the current station from our query data
      const targetStationId = currentStationId || formData.stationId;
      const station = locations.find((s: any) => s._id === targetStationId);

      // 2. Get the grades available in the station's tanks (from our new backend field)
      const stationGrades = station?.availableStationGrades || [];

      // Supplier/Badge Logic
      const defaultSup = rackSuppliers.find((s: any) => s._id === rack.defaultSupplier) || rackSuppliers[0];
      const defaultBadge = defaultSup?.supplierBadges?.find((b: any) => b.isDefault) || defaultSup?.supplierBadges?.[0];

      // CARRIER LOGIC:
      // We use the passedCarrierId (from the station) or fallback to the one in the list
      const finalCarrierId = passedCarrierId || rackCarriers[0]?._id || '';

      // Check if the station's default is actually allowed at this rack
      const isAllowed = rackCarriers.some((c: any) => c._id === finalCarrierId);

      console.log("Carrier Selection - Requested:", finalCarrierId, "Is Allowed:", isAllowed); // LOG 7

      setFormData(prev => {
        // 3. INTERSECTION LOGIC: 
        // Only include grades that the Rack provides AND the Station has tanks for
        const filteredItems = rack.availableGrades
          .filter((grade: string) => stationGrades.includes(grade))
          .map((grade: string) => ({ grade, ltrs: 0 }));

        return {
          ...prev,
          rackId,
          supplierId: defaultSup?._id || '',
          badgeNo: defaultBadge?.badgeNumber || '',
          carrierId: isAllowed ? finalCarrierId : (rackCarriers[0]?._id || ''),
          items: filteredItems // Applied the filter here
        };
      });

      // Trigger PO Generation
      generatePONumber(currentStationId || formData.stationId, formData.orderDate, formData.deliveryDate);
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

  const generatePONumber = async (sId: string, oDate: string, dDate: string) => {
    const station = locations.find((s: any) => s._id === sId);
    // Keep your top-level check
    if (!station || !oDate || !dDate) return;

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
        `/api/fuel-orders/check-existing?stationId=${sId}&orderDate=${oDate}`,
        authHeader
      );

      const { count, existingOrders } = res.data;

      // --- Validation Logic ---
      if (count > 0) {
        // Use originalDeliveryDate from the backend objects
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

        if (differentDeliveryDate) {
          // Logic: Calculate tomorrow's date
          const tomorrow = new Date(oDate + 'T00:00:00');
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];

          alert(`CRITICAL: An order exists for this date with a different delivery date. To maintain consistency, we are moving this Order Date to tomorrow (${tomorrowStr}).`);

          // Recursive call with the new date
          setFormData(prev => ({ ...prev, orderDate: tomorrowStr }));
          generatePONumber(sId, tomorrowStr, dDate);
          return;
        }

        if (sameDeliveryDate) {
          const nextLoad = count + 1;
          const confirm = window.confirm(`Notice: There is already a load scheduled for delivery on ${dDate}. Do you want to create another load (Load #${nextLoad}) for this same day?`);

          if (!confirm) return;

          // If confirmed, update PO with the next load number
          const newPO = `NSP${getFormattedPart(oDate)}-${stationNum}${nextLoad}`;
          setFormData(prev => ({ ...prev, poNumber: newPO }));
          return;
        }
      }

      // Default Case (No existing orders or fresh date)
      const newPO = `NSP${getFormattedPart(oDate)}-${stationNum}${count + 1}`;
      setFormData(prev => ({ ...prev, poNumber: newPO }));

    } catch (err) {
      console.error("PO Gen Error", err);
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
      items: []
    });
    // Clear the cascading dropdown lists
    setRacks([]);
    setCarriers([]);
    setSuppliers([]);
  };

  const handleSubmit = async () => {
    // Validation: Ensure mandatory fields are present
    if (!formData.stationId || !formData.rackId || !formData.poNumber) {
      alert("Please select a Station and Rack before submitting.");
      return;
    }

    // Validation: Ensure at least one item has liters
    const hasFuel = formData.items.some(item => (item.ltrs || 0) > 0);
    if (!hasFuel) {
      alert("Please enter a quantity for at least one fuel grade.");
      return;
    }

    try {
      setIsSubmitting(true);

      // We send the formData as is; the backend handles mapping to Schema field names
      const response = await axios.post('/api/fuel-orders', formData, authHeader);

      if (response.status === 201) {
        alert(`Success! Order ${response.data.poNumber} has been created.`);
        handleReset(); // Clear the form
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to save the order.";
      alert(errorMsg);
      console.error("Submission Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchProjections = async (sId: string, dDate: string) => {
    if (!sId || !dDate) return;
    try {
      const res = await axios.get(`/api/fuel-station-tanks/station/${sId}?date=${dDate}`, authHeader);

      // Group tank data by grade for the UI
      const grouped = res.data.tanks.reduce((acc: any, tank: any) => {
        if (!acc[tank.grade]) {
          acc[tank.grade] = { opening: 0, sales: 0, capacity: 0, closing: 0 };
        }
        acc[tank.grade].opening += tank.openingL;
        acc[tank.grade].sales += tank.estSalesL;
        acc[tank.grade].capacity += tank.maxVolumeCapacity;
        acc[tank.grade].closing += tank.closingL;
        return acc;
      }, {});

      setProjections(grouped);
    } catch (err) {
      console.error("Error fetching projections:", err);
    }
  };


  // Find selected details for the PDF
  const selectedStation = locations.find((s: any) => s._id === formData.stationId);
  const selectedCarrier = carriers.find(c => c._id === formData.carrierId);
  const selectedRack = racks.find(r => r._id === formData.rackId);


  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Create Fuel Order</h1>
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
            onClick={() => setIsPreviewOpen(true)}
            disabled={!formData.stationId || isSubmitting}
          >
            Generate PO PDF
          </Button>
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>PO Preview - {formData.poNumber}</DialogTitle>
              </DialogHeader>

              <div className="flex-1 border rounded-lg overflow-hidden">
                <PDFViewer width="100%" height="100%" showToolbar={false}>
                  <POPreviewDocument
                    data={formData}
                    selectedStation={selectedStation}
                    carrierName={selectedCarrier?.carrierName}
                    rackName={selectedRack?.rackName}
                  />
                </PDFViewer>
              </div>

              <DialogFooter className="flex justify-between items-center sm:justify-between">
                <PDFDownloadLink
                  document={
                    <POPreviewDocument
                      data={formData}
                      selectedStation={selectedStation}
                      carrierName={selectedCarrier?.carrierName}
                      rackName={selectedRack?.rackName}
                    />
                  }
                  fileName={`Fuel Order Form NSP ${selectedStation?.fuelCustomerName || 'Order'} ${formatPDFDate(formData.deliveryDate, false)}.pdf`}
                >
                  {({ loading }) => (
                    <Button variant="outline" disabled={loading}>
                      {loading ? "Preparing..." : "Download PDF"}
                    </Button>
                  )}
                </PDFDownloadLink>

                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    await handleSubmit();
                    setIsPreviewOpen(false);
                  }}
                >
                  Create Order
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN: Logistics & Details */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                Station & Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Select Station</Label>
                <Select onValueChange={handleStationChange} disabled={isLoadingLocations}>
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingLocations ? "Loading..." : "Choose Station..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* The (locations || []) ensures that if the API fails or returns null, 
                       the map doesn't crash the app.
                    */}
                    {(locations || []).map((s: any) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.stationName} <span className="text-xs text-muted-foreground ml-2">({s.tankCount} Tanks)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Order Date</Label>
                {/* Order Date Input */}
                <Input
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setFormData(prev => ({ ...prev, orderDate: newDate }));
                    generatePONumber(formData.stationId, newDate, formData.deliveryDate);
                  }}
                />


              </div>

              <div className="space-y-2">
                <Label>PO Number (Auto-Generated)</Label>
                <div className="flex gap-2">
                  <Input value={formData.poNumber} onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })} />
                  <Button size="icon" variant="ghost" onClick={() => generatePONumber(formData.stationId, formData.orderDate, formData.deliveryDate)}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Delivery Date</Label>
                {/* Delivery Date Input */}
                <Input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => {
                    const newDelDate = e.target.value;
                    setFormData(prev => ({ ...prev, deliveryDate: newDelDate }));
                    fetchProjections(formData.stationId, newDelDate);
                    generatePONumber(formData.stationId, formData.orderDate, newDelDate);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Window Start</Label>
                <Input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Window End</Label>
                <Input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
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
                  <Select value={formData.rackId} onValueChange={(v) => handleRackChange(v)}>
                    <SelectTrigger className="w-full">
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
                    onValueChange={(v) => setFormData({ ...formData, carrierId: v })}
                  >
                    <SelectTrigger className="w-full">
                      <div className="truncate text-left">
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
        <div className="col-span-12 lg:col-span-4">
          <Card className="h-full border-blue-100 bg-blue-50/30">
            <CardHeader className="pb-3 border-b bg-white">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5 text-blue-600" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 space-y-4">
              {/* CASE 1: FORM IS EMPTY (Initial State) */}
              {!formData.stationId ? (
                <div className="text-center py-10 text-muted-foreground px-4 animate-in fade-in duration-500">
                  <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-6 h-6 opacity-20" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-tight">Awaiting Selection</p>
                  <p className="text-[10px] mt-1 font-medium">
                    Select a <strong>Station</strong> and <strong>Rack</strong> to load available fuel grades.
                  </p>
                </div>
              ) : (
                <>
                  {/* CASE 2: STATION SELECTED BUT NO OVERLAP WITH RACK (The "Conflict" State) */}
                  {formData.items.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-amber-50/50 rounded-xl border border-amber-100 border-dashed animate-in zoom-in-95 duration-300">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                      <p className="text-sm font-black uppercase tracking-tight text-amber-700">Mismatch Detected</p>
                      <p className="text-[10px] mt-1 text-amber-600 leading-relaxed font-medium">
                        The selected <strong>Rack</strong> does not provide any fuel grades that match this <strong>Station's</strong> tank configuration.
                      </p>
                    </div>
                  ) : (
                    formData.items.map((item, idx) => {
                      const gradeData = projections[item.grade] || { opening: 0, sales: 0, capacity: 0, closing: 0 };
                      const userLtrs = Number(item.ltrs) || 0;

                      // Theme & Config details
                      const theme = getGradeTheme(item.grade);
                      const config = gradeConfig[item.grade] || { short: item.grade.substring(0, 3).toUpperCase() };

                      // DYNAMIC MATH:
                      const finalClosing = (gradeData.closing + userLtrs);

                      return (
                        <div key={item.grade} className="p-3 bg-white rounded-xl border shadow-sm relative overflow-hidden">
                          {/* High-Contrast Color Accent */}
                          <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", theme.color)} />

                          {/* TOP ROW: Grade & Input */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col leading-tight">
                              <span className={cn("font-black uppercase italic text-sm tracking-tight", theme.label)}>
                                {item.grade}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                                {config.short}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="h-9 w-28 text-right font-mono font-bold border-2 focus:border-blue-500"
                                placeholder="0"
                                value={item.ltrs || ''}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  const newItems = [...formData.items];
                                  newItems[idx] = { ...newItems[idx], ltrs: value };
                                  setFormData({ ...formData, items: newItems });
                                }}
                              />
                              <span className="text-[10px] font-black text-slate-400">LTRS</span>
                            </div>
                          </div>

                          {/* BOTTOM ROW: Metrics Grid (Compact but readable) */}
                          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Est. Opening</span>
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {gradeData.opening.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Est. Sales</span>
                              <span className="text-xs font-mono font-bold text-red-500">
                                -{gradeData.sales.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex flex-col items-end">
                              <span className="text-[9px] font-bold text-blue-500 uppercase leading-none mb-1">Final Closing</span>
                              <span className={cn(
                                "text-xs font-mono font-black",
                                finalClosing > gradeData.capacity ? "text-orange-600" : "text-blue-600"
                              )}>
                                {finalClosing.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* OVERFLOW WARNING (Only if needed) */}
                          {gradeData.capacity > 0 && finalClosing > gradeData.capacity && (
                            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-1 rounded border border-orange-100">
                              <AlertCircle className="h-3 w-3" />
                              Overflow Risk: Exceeds {gradeData.capacity.toLocaleString()}L Capacity
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}
              {formData.items.length > 0 && (
                <div className="pt-4 border-t border-dashed">
                  <div className="flex justify-between items-center text-lg font-bold px-2">
                    <span>Total Volume:</span>
                    <span className="text-blue-600">
                      {formData.items.reduce((sum, i) => sum + (i.ltrs || 0), 0).toLocaleString()} L
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div >
  );
}