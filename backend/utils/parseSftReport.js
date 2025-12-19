// Shared parser for .sft shift report files
// Extracts numeric metrics via regex; returns an object of parsed values.
// If a metric isn't found it will be null. Safedrops included if present.
const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')))
const pickNum = (re, text) => {
  const m = text.match(re)
  return m ? toNumber(m[1]) : null
}

// Capture the last "$ amount" on the line that starts with the label (case-insensitive)
const pickLastMoney = (labelPattern, text) => {
  // 1) Find the full line that starts with the label
  const lineRe = new RegExp(`^\\s*${labelPattern}\\b.*$`, 'gmi')
  const lines = text.match(lineRe)
  if (!lines || !lines.length) return null
  const line = lines[lines.length - 1]

  // 2) From that line, grab the last $ amount
  const moneyMatches = [...line.matchAll(/\$\s*([-\d.,]+)/g)]
  if (!moneyMatches.length) return null
  return toNumber(moneyMatches[moneyMatches.length - 1][1])
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
    payouts: pickNum(/^\s*Payouts\s+([-\d.,]+)\s*$/mi, text),

    // NEW: specific lotto/payout fields
    // Case-insensitive; tolerate optional colon/dash and $; allow "payout" or "payouts"
    lottoPayout: pickNum(/^\s*lotto\s*payouts?\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),

    // Department Grand Total: Online Lotto
    onlineLottoTotal: (() => {
      const m = text.match(
        /Department:\s*\d+\s*Online\s+Lotto[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
      )
      return m ? toNumber(m[1]) : null
    })(),

    // Use last money value on the line (last column)
    dataWave: pickLastMoney('data\\s*wave', text),
    feeDataWave: pickLastMoney('fee\\s*data\\s*wave', text),

    // Department Grand Total: Instant Lott
    instantLottTotal: (() => {
      const m = text.match(
        /Department:\s*\d+\s*Instant\s+Lott[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
      )
      return m ? toNumber(m[1]) : null
    })(),
  }

  const sd = text.match(/^\s*Safedrops\s+(\d+)\s+([-\d.,]+)\s*$/mi)
  if (sd) {
    metrics.safedrops = { count: Number(sd[1]), amount: toNumber(sd[2]) }
  }
  return metrics
}

module.exports = { parseSftReport }