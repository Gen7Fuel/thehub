// Shared parser for .sft shift report files
// Extracts numeric metrics via regex; returns an object of parsed values.
// If a metric isn't found it will be null. Safedrops included if present.

const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')))
const pickNum = (re, text) => {
  const m = text.match(re)
  return m ? toNumber(m[1]) : null
}

function parseSftReport(text) {
  const metrics = {
    fuelSales: pickNum(/^\s*Fuel sales\s+([-\d.,]+)\s*$/mi, text),
    dealGroupCplDiscounts: pickNum(/^\s*Deal Group CPL discounts\s+([-\d.,]+)\s*$/mi, text),
    fuelPriceOverrides: pickNum(/^\s*Fuel Price Overrides\s+([-\d.,]+)\s*$/mi, text),

    itemSales: pickNum(/^\s*Item Sales\s+([-\d.,]+)\s*$/mi, text),
    depositTotal: pickNum(/^\s*Deposit Total\s+([-\d.,]+)\s*$/mi, text),
    pennyRounding: pickNum(/^\s*Penny Rounding\s+([-\d.,]+)\s*$/mi, text),
    totalSales: pickNum(/^\s*Total Sales\s+([-\d.,]+)\s*$/mi, text),

    afdCredit: pickNum(/^\s*AFD Credit\s+([-\d.,]+)\s*$/mi, text),
    afdDebit: pickNum(/^\s*AFD Debit\s+([-\d.,]+)\s*$/mi, text),
    kioskCredit: pickNum(/^\s*Kiosk Credit\s+([-\d.,]+)\s*$/mi, text),
    kioskDebit: pickNum(/^\s*Kiosk Debit\s+([-\d.,]+)\s*$/mi, text),
    kioskGiftCard: pickNum(/^\s*Kiosk Gift Card\s+([-\d.,]+)\s*$/mi, text),
    totalPos: pickNum(/^\s*Total POS\s+([-\d.,]+)\s*$/mi, text),
    arIncurred: pickNum(/^\s*A\/R incurred\s+([-\d.,]+)\s*$/mi, text),
    grandTotal: pickNum(/^\s*Total\s+([-\d.,]+)\s*$/mi, text),

    couponsAccepted: pickNum(/^\s*Coupons Accepted\s+([-\d.,]+)\s*$/mi, text),
    canadianCash: pickNum(/^\s*Canadian Cash\s+([-\d.,]+)\s*$/mi, text),
    cashOnHand: pickNum(/^\s*Cash On Hand\s+([-\d.,]+)\s*$/mi, text),
    cashBack: pickNum(/^\s*Cash Back\s+([-\d.,]+)\s*$/mi, text),
  }

  const sd = text.match(/^\s*Safedrops\s+(\d+)\s+([-\d.,]+)\s*$/mi)
  if (sd) {
    metrics.safedrops = { count: Number(sd[1]), amount: toNumber(sd[2]) }
  }
  return metrics
}

module.exports = { parseSftReport }
