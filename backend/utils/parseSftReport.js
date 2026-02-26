// // Shared parser for .sft shift report files
// // Extracts numeric metrics via regex; returns an object of parsed values.
// // If a metric isn't found it will be null. Safedrops included if present.

// const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')))
// const pickNum = (re, text) => {
//   const m = text.match(re)
//   return m ? toNumber(m[1]) : null
// }

// function parseSftReport(text) {
//   const metrics = {
//     fuelSales: pickNum(/^\s*Fuel sales\s+([-\d.,]+)\s*$/mi, text),
//     dealGroupCplDiscounts: pickNum(/^\s*Deal Group CPL discounts\s+([-\d.,]+)\s*$/mi, text),
//     fuelPriceOverrides: pickNum(/^\s*Fuel Price Overrides\s+([-\d.,]+)\s*$/mi, text),

//     itemSales: pickNum(/^\s*Item Sales\s+([-\d.,]+)\s*$/mi, text),
//     depositTotal: pickNum(/^\s*Deposit Total\s+([-\d.,]+)\s*$/mi, text),
//     pennyRounding: pickNum(/^\s*Penny Rounding\s+([-\d.,]+)\s*$/mi, text),
//     totalSales: pickNum(/^\s*Total Sales\s+([-\d.,]+)\s*$/mi, text),

//     afdCredit: pickNum(/^\s*AFD Credit\s+([-\d.,]+)\s*$/mi, text),
//     afdDebit: pickNum(/^\s*AFD Debit\s+([-\d.,]+)\s*$/mi, text),
//     kioskCredit: pickNum(/^\s*Kiosk Credit\s+([-\d.,]+)\s*$/mi, text),
//     kioskDebit: pickNum(/^\s*Kiosk Debit\s+([-\d.,]+)\s*$/mi, text),
//     kioskGiftCard: pickNum(/^\s*Kiosk Gift Card\s+([-\d.,]+)\s*$/mi, text),
//     totalPos: pickNum(/^\s*Total POS\s+([-\d.,]+)\s*$/mi, text),
//     arIncurred: pickNum(/^\s*A\/R incurred\s+([-\d.,]+)\s*$/mi, text),
//     grandTotal: pickNum(/^\s*Total\s+([-\d.,]+)\s*$/mi, text),

//     couponsAccepted: pickNum(/^\s*Coupons Accepted\s+([-\d.,]+)\s*$/mi, text),
//     canadianCash: pickNum(/^\s*Canadian Cash\s+([-\d.,]+)\s*$/mi, text),
//     cashOnHand: pickNum(/^\s*Cash On Hand\s+([-\d.,]+)\s*$/mi, text),
//     cashBack: pickNum(/^\s*Cash Back\s+([-\d.,]+)\s*$/mi, text),
//     payouts: pickNum(/^\s*Payouts\s+([-\d.,]+)\s*$/mi, text),

//     // NEW: specific lotto/payout fields
//     // Case-insensitive; tolerate optional colon/dash and $; allow "payout" or "payouts"
//     lottoPayout: pickNum(/^\s*lotto\s*payouts?\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),

//     // Department Grand Total: Online Lotto
//     onlineLottoTotal: (() => {
//       const m = text.match(
//         /Department:\s*\d+\s*Online\s+Lotto[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
//       )
//       return m ? toNumber(m[1]) : null
//     })(),

//     // NEW: Data Wave and FEE DATA WAVE (case-insensitive)
//     dataWave: pickNum(/^\s*data\s*wave\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),
//     feeDataWave: pickNum(/^\s*fee\s*data\s*wave\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),

//     // Department Grand Total: Instant Lott
//     instantLottTotal: (() => {
//       const m = text.match(
//         /Department:\s*\d+\s*Instant\s+Lott[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
//       )
//       return m ? toNumber(m[1]) : null
//     })(),
//   }

//   const sd = text.match(/^\s*Safedrops\s+(\d+)\s+([-\d.,]+)\s*$/mi)
//   if (sd) {
//     metrics.safedrops = { count: Number(sd[1]), amount: toNumber(sd[2]) }
//   }
//   return metrics
// }

// module.exports = { parseSftReport }

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

// Capture the $ amount on one of the next few lines following the label line (tolerate blank spacer lines)
const pickNextLineMoney = (labelPattern, text) => {
  const lines = text.split(/\r?\n/)
  const labelRe = new RegExp(`^\n?\t?\s*${labelPattern}\\b`, 'i')
  for (let i = 0; i < lines.length; i++) {
    if (labelRe.test(lines[i])) {
      for (let j = i + 1; j <= i + 4 && j < lines.length; j++) {
        const line = lines[j]
        if (!line || /^\s*$/.test(line)) continue
        const mDollar = line.match(/\$\s*([-\d.,]+)/)
        if (mDollar) return toNumber(mDollar[1])
        const mPlain = line.match(/(^|\s)([-\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/)
        if (mPlain) return toNumber(mPlain[2])
      }
      break
    }
  }
  return null
}

// Capture the trailing integer on the label line (e.g., count at far right)
const pickTrailingInt = (labelPattern, text) => {
  const lineRe = new RegExp(`^\\s*${labelPattern}\\b.*$`, 'gmi')
  const lines = text.match(lineRe)
  if (!lines || !lines.length) return null
  const line = lines[lines.length - 1]
  const m = line.match(/(\d+)\s*$/)
  return m ? Number(m[1]) : null
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
    // afdGiftCard: pickNum(/^\s*AFD\s*Gift\s*Card\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),
    afdGiftCard: pickNum(/^\s*AFD Gift Card\s+([-\d.,]+)\s*$/mi, text),
    kioskCredit: pickNum(/^\s*Kiosk Credit\s+([-\d.,]+)\s*$/mi, text),
    kioskDebit: pickNum(/^\s*Kiosk Debit\s+([-\d.,]+)\s*$/mi, text),
    kioskGiftCard: pickNum(/^\s*Kiosk Gift Card\s+([-\d.,]+)\s*$/mi, text),
    totalPos: pickNum(/^\s*Total POS\s+([-\d.,]+)\s*$/mi, text),
    arIncurred: pickNum(/^\s*A\/R incurred\s+([-\d.,]+)\s*$/mi, text),
    grandTotal: pickNum(/^\s*Total\s+([-\d.,]+)\s*$/mi, text),

    // Native cpl miss -> missedCpl (placed above couponsAccepted)
    // missedCpl: pickNum(/^\s*Native\s*cpl\s*miss\s+([-\d.,]+)\s*$/mi, text),
    missedCpl: pickNum(/^\s*Native cpl miss\s+([-\d.,]+)\s*$/mi, text),

    couponsAccepted: pickNum(/^\s*Coupons Accepted\s+([-\d.,]+)\s*$/mi, text),
    canadianCash: pickNum(/^\s*Canadian Cash\s+([-\d.,]+)\s*$/mi, text),
    usCash: pickNum(/^\s*U\.?S\.?\s*Cash\s+([-\d.,]+)\s*$/mi, text),
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

    // SHIFT STATISTICS: Voided Transactions amount appears on the next line
    voidedTransactionsAmount: pickNextLineMoney('Voided\\s*Transactions', text),
    voidedTransactionsCount: pickTrailingInt('Voided\\s*Transactions', text),
  }

  // Station times (strings in format "YYYY-MM-DD HH:mm"); if missing, leave undefined
  const pickStationDateTimeString = (label, t) => {
    const re = new RegExp(`^\\s*${label}\\s*:\\s*(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{2}:\\d{2})\\s*$`, 'mi')
    const m = t.match(re)
    return m ? `${m[1]} ${m[2]}` : undefined
  }
  const startStr = pickStationDateTimeString('Start', text)
  const endStr = pickStationDateTimeString('End', text)
  if (startStr) metrics.stationStart = startStr
  if (endStr) metrics.stationEnd = endStr

  const sd = text.match(/^\s*Safedrops\s+(\d+)\s+([-\d.,]+)\s*$/mi)
  if (sd) {
    metrics.safedrops = { count: Number(sd[1]), amount: toNumber(sd[2]) }
  }
  return metrics
}

module.exports = { parseSftReport }
