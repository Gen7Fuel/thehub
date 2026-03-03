import { calculateOverShort } from '@/lib/lottery-logic';
import { useFormStore } from '@/store'// Adjust path
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Info } from 'lucide-react'

const InfoDialog = ({ title, imageName }: { title: string; imageName: string }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="ml-2 inline-flex items-center text-blue-500 hover:text-blue-700 transition-colors">
          <Info size={16} />
        </button>
      </DialogTrigger>
      {/* Changed max-w-md to max-w-4xl for a much larger viewing area */}
      <DialogContent className="max-w-4xl w-[90vw] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title} Reference</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="border rounded-lg shadow-sm overflow-hidden bg-white w-full">
            <img
              src={`/lotto_max_reports/${imageName}.png`}
              alt={title}
              className="w-full h-auto object-contain"
            />
          </div>
          {/* <p className="text-base text-center text-muted-foreground font-medium bg-slate-50 p-4 rounded-md border w-full">
            Kindly find the section mentioned in the Red Box on your Report and enter the corresponding value mentioned in the Green Box. (Note: The images are for reference only and may not exactly match your report, but the highlighted sections will guide you to the correct values.)
          </p> */}
          <div className="text-sm md:text-base text-muted-foreground font-medium bg-slate-50 p-5 rounded-md border w-full">
            <ul className="list-none space-y-2">
              <li>
                <span className="text-red-600">●</span> <strong>Step 1:</strong> Locate the section marked by the <strong>Red Box</strong> on your Lotto Report.
              </li>
              <li>
                <span className="text-green-600">●</span> <strong>Step 2:</strong> Enter the corresponding value found inside the <strong>Green Box</strong>.
              </li>
            </ul>
            <p className="mt-3 text-xs font-normal opacity-70 italic text-center">
              Note: The images are for reference only and actual values may differ, but the highlighted sections will guide you to the correct values.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface Props {
  lotteryData: any;      // The values from state or API
  bullockData: any;      // The values from the system report
  isReadOnly?: boolean;  // True for List/Report pages
  showImages?: boolean;  // True only for the Lottery List page
  onViewImages?: (imgs: string[]) => void;
}

// Helper to render Input vs Text
interface DataCellProps {
  field: string;
  width?: string;
  isPayoutCalc?: boolean;
  lottery: any;      // Pass these as props now
  isReadOnly: boolean;
  // Note: we remove the '?' from the name here and handle optionality in the interface
  extraLogic?: (val: number) => void;
}

const formatCurrency = (val: any) =>
  typeof val === 'number' ? `$${val.toFixed(2)}` : val;

const OverShortCell = ({ value }: { value: number }) => (
  <td className={`px-4 py-2 ${value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
    {formatCurrency(value)}
  </td>
);

const DataCell = ({
  field,
  width = "w-36",
  lottery,
  isReadOnly,
  isPayoutCalc = false,
  extraLogic
}: DataCellProps) => {
  if (isReadOnly) {
    // Accessing lottery[field] safely
    return <td className="px-4 py-2">{formatCurrency((lottery as any)[field])}</td>;
  }

  return (
    <td className="px-4 py-2">
      <input
        type="number"
        className={`${width} p-2 border rounded ${field === 'payouts' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        // We cast lottery to any here if the keys are dynamic, 
        // or use keyof if you want to be super strict.
        value={(lottery as any)[field] ?? 0}
        readOnly={field === 'payouts'}
        onChange={(e) => {
          const val = Number(e.target.value || 0);
          if (isPayoutCalc && extraLogic) {
            extraLogic(val);
          } else {
            useFormStore.getState().setLotteryValues({ [field]: val });
          }
        }}
      />
    </td>
  );
};

export function LotteryComparisonTable({
  lotteryData,
  bullockData,
  isReadOnly = false,
  showImages = false,
  onViewImages
}: Props) {

  // Normalize data (Handling different key names from API vs Store)
  const lottery = {
    onlineSales: lotteryData.onlineSales ?? lotteryData.onlineLottoTotal ?? 0,
    onlineCancellations: lotteryData.onlineCancellations ?? 0,
    onlineDiscounts: lotteryData.onlineDiscounts ?? 0,
    vouchersRedeemed: lotteryData.vouchersRedeemed ?? 0,
    scratchSales: lotteryData.scratchSales ?? lotteryData.instantLottTotal ?? 0,
    scratchFreeTickets: lotteryData.scratchFreeTickets ?? 0,
    oldScratchTickets: lotteryData.oldScratchTickets ?? 0,
    payouts: lotteryData.payouts ?? lotteryData.lottoPayout ?? 0,
    onDemandFreeTickets: lotteryData.onDemandFreeTickets ?? 0,
    onDemandCashPayout: lotteryData.onDemandCashPayout ?? 0,
    scratchCashPayout: lotteryData.scratchCashPayout ?? 0,
    dataWave: lotteryData.dataWave ?? 0,
    feeDataWave: lotteryData.feeDataWave ?? 0,
    images: lotteryData.images || [],
    datawaveImages: lotteryData.datawaveImages || [],
  };


  const overShort = calculateOverShort(lottery, bullockData);

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="min-w-full table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Lottery Report</th>
            <th className="px-4 py-2 text-left">Bulloch Report</th>
            <th className="px-4 py-2 text-left">Over / Short</th>
          </tr>
        </thead>
        <tbody>
          {/* ONLINE SALES */}
          <tr className="border-t font-semibold">
            <td className="px-4 py-2 flex items-center">
              Online Sales <InfoDialog title="Online Sales" imageName="online_sales" />
            </td>
            <DataCell field="onlineSales" width="w-40" lottery={lottery} isReadOnly={isReadOnly} />
            <td className="px-4 py-2">{formatCurrency(bullockData?.onlineSales ?? '-')}</td>
            <OverShortCell value={overShort.onlineSales} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              Lotto Cancellations <InfoDialog title="Lotto Cancellations" imageName="cancellations" />
            </td>
            <DataCell field="onlineCancellations" lottery={lottery} isReadOnly={isReadOnly} />
            <td colSpan={2} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              Lotto Discounts <InfoDialog title="Lotto Discounts" imageName="discounts" />
            </td>
            <DataCell field="onlineDiscounts" lottery={lottery} isReadOnly={isReadOnly} />
            <td colSpan={2} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              Vouchers Redeemed <InfoDialog title="Vouchers Redeemed" imageName="vouchers_redeemed" />
            </td>
            <DataCell
              field="vouchersRedeemed"
              isPayoutCalc={true}
              extraLogic={(val) => useFormStore.getState().setLotteryValues({
                vouchersRedeemed: val,
                payouts: (lottery.onDemandCashPayout || 0) + (lottery.scratchCashPayout || 0) + val + (lottery.scratchFreeTickets || 0)
              })}
              lottery={lottery}
              isReadOnly={isReadOnly}
            />
            <td colSpan={2} />
          </tr>

          {/* SCRATCH SALES */}
          <tr className="border-t font-semibold">
            <td className="px-4 py-2 flex items-center">
              Scratch Sales <InfoDialog title="Scratch Sales" imageName="scratch_sales" />
            </td>
            <DataCell field="scratchSales" width="w-40" lottery={lottery} isReadOnly={isReadOnly} />
            <td className="px-4 py-2">{formatCurrency(bullockData?.scratchSales ?? '-')}</td>
            <OverShortCell value={overShort.scratchSales} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              Scratch and Win (S&W) Free Tickets <InfoDialog title="SNW Free Tickets" imageName="scratch_ft_sales" />
            </td>
            <DataCell
              field="scratchFreeTickets"
              isPayoutCalc={true}
              extraLogic={(val) => useFormStore.getState().setLotteryValues({
                scratchFreeTickets: val,
                payouts: (lottery.onDemandCashPayout || 0) + (lottery.scratchCashPayout || 0) + val + (lottery.vouchersRedeemed || 0)
              })}
              lottery={lottery}
              isReadOnly={isReadOnly}
            />
            <td colSpan={2} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8">Old Scratch Tickets</td>
            <DataCell field="oldScratchTickets" lottery={lottery} isReadOnly={isReadOnly} />
            <td colSpan={2} />
          </tr>

          {/* PAYOUTS SECTION */}
          <tr className="border-t font-semibold">
            <td className="px-4 py-2">Total Payouts (Calculated)</td>
            <DataCell field="payouts" width="w-40" lottery={lottery} isReadOnly={isReadOnly} />
            <td className="px-4 py-2">{formatCurrency(bullockData?.payouts ?? '-')}</td>
            <OverShortCell value={overShort.payouts} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              On Demand (Online) Free Tickets <InfoDialog title="On Demand Free Tickets" imageName="online_ft_sales" />
            </td>
            <DataCell field="onDemandFreeTickets" lottery={lottery} isReadOnly={isReadOnly} />
            <td colSpan={2} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              On Demand (Online) Cash Payout <InfoDialog title="On Demand Cash Payout" imageName="online_cash_payout" />
            </td>
            <DataCell
              field="onDemandCashPayout"
              isPayoutCalc={true}
              extraLogic={(val) => useFormStore.getState().setLotteryValues({
                onDemandCashPayout: val,
                payouts: val + (lottery.scratchCashPayout || 0) + (lottery.scratchFreeTickets || 0) + (lottery.vouchersRedeemed || 0)
              })}
              lottery={lottery}
              isReadOnly={isReadOnly}
            />
            <td colSpan={2} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              Scratch and Win (S&W) Free Tickets <InfoDialog title="SNW Free Tickets" imageName="scratch_ft_sales" />
            </td>
            <DataCell
              field="scratchFreeTickets"
              isPayoutCalc={true}
              extraLogic={(val) => useFormStore.getState().setLotteryValues({
                scratchFreeTickets: val,
                payouts: (lottery.onDemandCashPayout || 0) + (lottery.scratchCashPayout || 0) + val + (lottery.vouchersRedeemed || 0)
              })}
              lottery={lottery}
              isReadOnly={isReadOnly}
            />
            <td colSpan={2} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8 flex items-center">
              Scratch and Win (S&W) Cash Payout <InfoDialog title="SNW Cash Payout" imageName="scratch_cash_payout" />
            </td>
            <DataCell
              field="scratchCashPayout"
              isPayoutCalc
              extraLogic={(val) => useFormStore.getState().setLotteryValues({
                scratchCashPayout: val,
                payouts: (lottery.onDemandCashPayout || 0) + val + (lottery.scratchFreeTickets || 0) + (lottery.vouchersRedeemed || 0)
              })}
              lottery={lottery}
              isReadOnly={isReadOnly}
            />
            <td colSpan={2} />
          </tr>

          {/* DATAWAVE SECTION */}
          <tr className="border-t font-semibold">
            <td className="px-4 py-2">Datawave Value</td>
            <DataCell field="dataWave" width="w-40" lottery={lottery} isReadOnly={isReadOnly} />
            <td className="px-4 py-2">{formatCurrency(bullockData?.dataWave ?? '-')}</td>
            <OverShortCell value={overShort.dataWave} />
          </tr>

          <tr className="border-t bg-gray-50">
            <td className="px-4 py-2 pl-8">Datawave Fee</td>
            <DataCell field="feeDataWave" lottery={lottery} isReadOnly={isReadOnly} />
            <td className="px-4 py-2">{formatCurrency(bullockData?.feeDataWave ?? '-')}</td>
            <OverShortCell value={overShort.feeDataWave} />
          </tr>

          {/* IMAGE ROWS (Condition: showImages=true) */}
          {showImages && (
            <>
              <tr className="border-t">
                <td className="px-4 py-2 font-semibold">Images</td>
                <td className="px-4 py-2" colSpan={3}>
                  <div className="flex gap-3 text-sm">
                    <span><strong>{lottery.images.length}</strong> Lottery</span>
                    <span className="text-gray-500">/</span>
                    <span><strong>{lottery.datawaveImages.length}</strong> DataWave</span>
                  </div>
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-2 font-semibold">Actions</td>
                <td className="px-4 py-2" colSpan={3}>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={lottery.images.length === 0} onClick={() => onViewImages?.(lottery.images)}>
                      <Eye className="h-4 w-4 mr-1" /> Lottery Images
                    </Button>
                    <Button size="sm" variant="outline" disabled={lottery.datawaveImages.length === 0} onClick={() => onViewImages?.(lottery.datawaveImages)}>
                      <Eye className="h-4 w-4 mr-1" /> DataWave Images
                    </Button>
                  </div>
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}