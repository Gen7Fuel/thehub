import { create } from 'zustand';

type FormStore = {
    fleetCardNumber: string;
    setFleetCardNumber: (name: string) => void;

    poNumber: string;
    setPoNumber: (name: string) => void;

    customerName: string;
    setCustomerName: (name: string) => void;

    driverName: string;
    setDriverName: (name: string) => void;

    vehicleInfo: string;
    setVehicleInfo: (name: string) => void;

    quantity: number;
    setQuantity: (quantity: number) => void;

    amount: number;
    setAmount: (amount: number) => void;

    fuelType: string;
    setFuelType: (fuelType: string) => void;

    resetForm: () => void;

    receipt: string | null;
    setReceipt: (receipt: string) => void;

    signature: string | null;
    setSignature: (signature: string) => void;

    // Payable form individual variables
    payableVendorName: string;
    setPayableVendorName: (vendorName: string) => void;

    payableLocation: string;
    setPayableLocation: (location: string) => void;

    payableNotes: string;
    setPayableNotes: (notes: string) => void;

    payablePaymentMethod: string;
    setPayablePaymentMethod: (paymentMethod: string) => void;

    payableAmount: number;
    setPayableAmount: (amount: number) => void;

    payableImages: string[];
    setPayableImages: (images: string[]) => void;

date: Date | undefined;
setDate: (date: Date | undefined) => void;


    resetPayableForm: () => void;
}

export const useFormStore = create<FormStore>((set) => ({
    fleetCardNumber: '',
    setFleetCardNumber: (fleetCardNumber) => set({ fleetCardNumber }),
    poNumber: '',
    setPoNumber: (poNumber) => set({ poNumber }),
    customerName: '',
    setCustomerName: (customerName) => set({ customerName }),
    driverName: '',
    setDriverName: (driverName) => set({ driverName }),
    vehicleInfo: '',
    setVehicleInfo: (vehicleInfo) => set({ vehicleInfo }),
    quantity: 0,
    setQuantity: (quantity) => set({ quantity }),
    amount: 0,
    setAmount: (amount) => set({ amount }),
    fuelType: '',
    setFuelType: (fuelType) => set({ fuelType }),
    receipt: null,
    setReceipt: (receipt) => set({ receipt }),
    signature: null,
    setSignature: (signature) => set({ signature }),
    resetForm: () => set({
        fleetCardNumber: '',
        customerName: '',
        driverName: '',
        vehicleInfo: '',
        quantity: 0,
        amount: 0,
        fuelType: '',
        receipt: null,
        signature: null,
    }),

    // Payable form implementation with individual variables
    payableVendorName: '',
    setPayableVendorName: (payableVendorName) => set({ payableVendorName }),

    date: new Date(),
    setDate: ((date) => set({ date })),

    payableLocation: localStorage.getItem('location') || '',
    setPayableLocation: (payableLocation) => set({ payableLocation }),

    payableNotes: '',
    setPayableNotes: (payableNotes) => set({ payableNotes }),

    payablePaymentMethod: '',
    setPayablePaymentMethod: (payablePaymentMethod) => set({ payablePaymentMethod }),

    payableAmount: 0,
    setPayableAmount: (payableAmount) => set({ payableAmount }),

    payableImages: [],
    setPayableImages: (payableImages) => set({ payableImages }),

    resetPayableForm: () => set({
        payableVendorName: '',
        payableLocation: '',
        payableNotes: '',
        payablePaymentMethod: '',
        payableAmount: 0,
        payableImages: [],
    }),
}));