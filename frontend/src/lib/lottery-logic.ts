// lib/lottery-logic.ts

export const calculateOverShort = (lottery: any, bullock: any) => {
  return {
    onlineSales:
      (bullock?.onlineSales || 0) -
      ((lottery.onlineSales || 0) -
        (lottery.onlineCancellations || 0) -
        (lottery.onlineDiscounts || 0)),
    scratchSales:
      (bullock?.scratchSales || 0) -
      ((lottery.scratchSales || 0) +
        (lottery.scratchFreeTickets || 0) +
        (lottery.oldScratchTickets || 0)),
    payouts: (bullock?.payouts || 0) - (lottery.payouts || 0),
    dataWave: (bullock?.dataWave || 0) - (lottery.dataWave || 0),
    feeDataWave: (bullock?.feeDataWave || 0) - (lottery.feeDataWave || 0),
  };
};