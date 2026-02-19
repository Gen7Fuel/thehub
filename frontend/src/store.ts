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

    // ...existing props
    lotteryValues: {
        onlineSales: number;
        scratchSales: number;
        scratchFreeTickets: number;
        oldScratchTickets: number;
        onlineCancellations: number;
        onlineDiscounts: number;
        payouts: number;
        datawaveValue: number;
        datawaveFee: number;
        onDemandFreeTickets: number;
        onDemandCashPayout: number;
        scratchCashPayout: number;
    };
    setLotteryValues: (vals: Partial<{
        onlineSales: number;
        scratchSales: number;
        scratchFreeTickets: number;
        oldScratchTickets: number;
        onlineCancellations: number;
        onlineDiscounts: number;
        payouts: number;
        datawaveValue: number;
        datawaveFee: number;
        onDemandFreeTickets: number;
        onDemandCashPayout: number;
        scratchCashPayout: number;
    }>) => void;

    lotteryImages: string[];
    setLotteryImages: (images: string[]) => void;

    datawaveImages: string[],
    setDatawaveImages: (imgs: string[]) => void,

    lotterySite: string;
    setLotterySite: (site: string) => void;

    resetLotteryForm: () => void;
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

    payableLocation: '',
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

    lotteryValues: {
        onlineSales: 0,
        scratchSales: 0,
        scratchFreeTickets: 0,
        oldScratchTickets: 0,
        onlineCancellations: 0,
        onlineDiscounts: 0,
        payouts: 0,
        datawaveValue: 0,
        datawaveFee: 0,
        onDemandFreeTickets: 0,
        onDemandCashPayout: 0,
        scratchCashPayout: 0,
    },
    setLotteryValues: (vals) =>
        set((state) => ({ lotteryValues: { ...state.lotteryValues, ...vals } })),

    lotteryImages: [],
    setLotteryImages: (lotteryImages) => set({ lotteryImages }),

    datawaveImages: [],
    setDatawaveImages: (datawaveImages) => set({ datawaveImages }),

    resetLotteryForm: () => set({
        lotteryValues: {
            onlineSales: 0,
            scratchSales: 0,
            scratchFreeTickets: 0,
            oldScratchTickets: 0,
            onlineCancellations: 0,
            onlineDiscounts: 0,
            payouts: 0,
            datawaveValue: 0,
            datawaveFee: 0,
            onDemandFreeTickets: 0,
            onDemandCashPayout: 0,
            scratchCashPayout: 0,
        },
        lotteryImages: [],
        datawaveImages: [],
    }),
    // current selected site for lottery flow
    lotterySite: '',
    setLotterySite: (lotterySite: string) => set({ lotterySite }),
}));