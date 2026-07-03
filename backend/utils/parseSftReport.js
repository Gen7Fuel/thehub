// // // Shared parser for .sft shift report files
// // // Extracts numeric metrics via regex; returns an object of parsed values.
// // // If a metric isn't found it will be null. Safedrops included if present.

// // const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')))
// // const pickNum = (re, text) => {
// //   const m = text.match(re)
// //   return m ? toNumber(m[1]) : null
// // }

// // function parseSftReport(text) {
// //   const metrics = {
// //     fuelSales: pickNum(/^\s*Fuel sales\s+([-\d.,]+)\s*$/mi, text),
// //     dealGroupCplDiscounts: pickNum(/^\s*Deal Group CPL discounts\s+([-\d.,]+)\s*$/mi, text),
// //     fuelPriceOverrides: pickNum(/^\s*Fuel Price Overrides\s+([-\d.,]+)\s*$/mi, text),

// //     itemSales: pickNum(/^\s*Item Sales\s+([-\d.,]+)\s*$/mi, text),
// //     depositTotal: pickNum(/^\s*Deposit Total\s+([-\d.,]+)\s*$/mi, text),
// //     pennyRounding: pickNum(/^\s*Penny Rounding\s+([-\d.,]+)\s*$/mi, text),
// //     totalSales: pickNum(/^\s*Total Sales\s+([-\d.,]+)\s*$/mi, text),

// //     afdCredit: pickNum(/^\s*AFD Credit\s+([-\d.,]+)\s*$/mi, text),
// //     afdDebit: pickNum(/^\s*AFD Debit\s+([-\d.,]+)\s*$/mi, text),
// //     kioskCredit: pickNum(/^\s*Kiosk Credit\s+([-\d.,]+)\s*$/mi, text),
// //     kioskDebit: pickNum(/^\s*Kiosk Debit\s+([-\d.,]+)\s*$/mi, text),
// //     kioskGiftCard: pickNum(/^\s*Kiosk Gift Card\s+([-\d.,]+)\s*$/mi, text),
// //     totalPos: pickNum(/^\s*Total POS\s+([-\d.,]+)\s*$/mi, text),
// //     arIncurred: pickNum(/^\s*A\/R incurred\s+([-\d.,]+)\s*$/mi, text),
// //     grandTotal: pickNum(/^\s*Total\s+([-\d.,]+)\s*$/mi, text),

// //     couponsAccepted: pickNum(/^\s*Coupons Accepted\s+([-\d.,]+)\s*$/mi, text),
// //     canadianCash: pickNum(/^\s*Canadian Cash\s+([-\d.,]+)\s*$/mi, text),
// //     cashOnHand: pickNum(/^\s*Cash On Hand\s+([-\d.,]+)\s*$/mi, text),
// //     cashBack: pickNum(/^\s*Cash Back\s+([-\d.,]+)\s*$/mi, text),
// //     payouts: pickNum(/^\s*Payouts\s+([-\d.,]+)\s*$/mi, text),

// //     // NEW: specific lotto/payout fields
// //     // Case-insensitive; tolerate optional colon/dash and $; allow "payout" or "payouts"
// //     lottoPayout: pickNum(/^\s*lotto\s*payouts?\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),

// //     // Department Grand Total: Online Lotto
// //     onlineLottoTotal: (() => {
// //       const m = text.match(
// //         /Department:\s*\d+\s*Online\s+Lotto[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
// //       )
// //       return m ? toNumber(m[1]) : null
// //     })(),

// //     // NEW: Data Wave and FEE DATA WAVE (case-insensitive)
// //     dataWave: pickNum(/^\s*data\s*wave\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),
// //     feeDataWave: pickNum(/^\s*fee\s*data\s*wave\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),

// //     // Department Grand Total: Instant Lott
// //     instantLottTotal: (() => {
// //       const m = text.match(
// //         /Department:\s*\d+\s*Instant\s+Lott[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
// //       )
// //       return m ? toNumber(m[1]) : null
// //     })(),
// //   }

// //   const sd = text.match(/^\s*Safedrops\s+(\d+)\s+([-\d.,]+)\s*$/mi)
// //   if (sd) {
// //     metrics.safedrops = { count: Number(sd[1]), amount: toNumber(sd[2]) }
// //   }
// //   return metrics
// // }

// // module.exports = { parseSftReport }

// // Shared parser for .sft shift report files
// // Extracts numeric metrics via regex; returns an object of parsed values.
// // If a metric isn't found it will be null. Safedrops included if present.
// const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')))
// const pickNum = (re, text) => {
//   const m = text.match(re)
//   return m ? toNumber(m[1]) : null
// }

// // Capture the last "$ amount" on the line that starts with the label (case-insensitive)
// const pickLastMoney = (labelPattern, text) => {
//   // 1) Find the full line that starts with the label
//   const lineRe = new RegExp(`^\\s*${labelPattern}\\b.*$`, 'gmi')
//   const lines = text.match(lineRe)
//   if (!lines || !lines.length) return null
//   const line = lines[lines.length - 1]

//   // 2) From that line, grab the last $ amount
//   const moneyMatches = [...line.matchAll(/\$\s*([-\d.,]+)/g)]
//   if (!moneyMatches.length) return null
//   return toNumber(moneyMatches[moneyMatches.length - 1][1])
// }

// // Capture the $ amount on one of the next few lines following the label line (tolerate blank spacer lines)
// const pickNextLineMoney = (labelPattern, text) => {
//   const lines = text.split(/\r?\n/)
//   const labelRe = new RegExp(`^\n?\t?\s*${labelPattern}\\b`, 'i')
//   for (let i = 0; i < lines.length; i++) {
//     if (labelRe.test(lines[i])) {
//       for (let j = i + 1; j <= i + 4 && j < lines.length; j++) {
//         const line = lines[j]
//         if (!line || /^\s*$/.test(line)) continue
//         const mDollar = line.match(/\$\s*([-\d.,]+)/)
//         if (mDollar) return toNumber(mDollar[1])
//         const mPlain = line.match(/(^|\s)([-\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/)
//         if (mPlain) return toNumber(mPlain[2])
//       }
//       break
//     }
//   }
//   return null
// }

// // Capture the trailing integer on the label line (e.g., count at far right)
// const pickTrailingInt = (labelPattern, text) => {
//   const lineRe = new RegExp(`^\\s*${labelPattern}\\b.*$`, 'gmi')
//   const lines = text.match(lineRe)
//   if (!lines || !lines.length) return null
//   const line = lines[lines.length - 1]
//   const m = line.match(/(\d+)\s*$/)
//   return m ? Number(m[1]) : null
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
//     // afdGiftCard: pickNum(/^\s*AFD\s*Gift\s*Card\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),
//     afdGiftCard: pickNum(/^\s*AFD Gift Card\s+([-\d.,]+)\s*$/mi, text),
//     kioskCredit: pickNum(/^\s*Kiosk Credit\s+([-\d.,]+)\s*$/mi, text),
//     kioskDebit: pickNum(/^\s*Kiosk Debit\s+([-\d.,]+)\s*$/mi, text),
//     kioskGiftCard: pickNum(/^\s*Kiosk Gift Card\s+([-\d.,]+)\s*$/mi, text),
//     totalPos: pickNum(/^\s*Total POS\s+([-\d.,]+)\s*$/mi, text) ?? pickNum(/^\s*POS\s+([-\d.,]+)\s*$/mi, text),
//     arIncurred: pickNum(/^\s*A\/R incurred\s+([-\d.,]+)\s*$/mi, text),
//     grandTotal: pickNum(/^\s*Total\s+([-\d.,]+)\s*$/mi, text),

//     // Native cpl miss -> missedCpl (placed above couponsAccepted)
//     // missedCpl: pickNum(/^\s*Native\s*cpl\s*miss\s+([-\d.,]+)\s*$/mi, text),
//     missedCpl: pickNum(/^\s*Native cpl miss\s+([-\d.,]+)\s*$/mi, text),

//     couponsAccepted: pickNum(/^\s*Coupons Accepted\s+([-\d.,]+)\s*$/mi, text),
//     giftCertificates: pickNum(/^\s*Gift Certificates\s+([-\d.,]+)\s*$/mi, text),
//     cashOffCoupons: pickNum(/^\s*Cash Off Coupons\s+([-\d.,]+)\s*$/mi, text),
//     otherCoupons: pickNum(/^\s*Other Coupons\s+([-\d.,]+)\s*$/mi, text),
//     canadianCash: pickNum(/^\s*Canadian Cash\s+([-\d.,]+)\s*$/mi, text),
//     usCash: pickNum(/^\s*U\.?S\.?\s*Cash\s+([-\d.,]+)\s*$/mi, text),
//     cashOnHand: pickNum(/^\s*Cash On Hand\s+([-\d.,]+)\s*$/mi, text),
//     cashBack: pickNum(/^\s*Cash Back\s+([-\d.,]+)\s*$/mi, text),
//     payouts: pickNum(/^\s*Payouts\s+([-\d.,]+)\s*$/mi, text),
//     unsettledPrepays: pickNum(/^\s*Unsettled Prepays\s+([-\d.,]+)\s*$/mi, text),

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

//     // Use last money value on the line (last column)
//     dataWave: pickLastMoney('data\\s*wave', text),
//     feeDataWave: pickLastMoney('fee\\s*data\\s*wave', text),

//     // Department Grand Total: Instant Lott
//     instantLottTotal: (() => {
//       const m = text.match(
//         /Department:\s*\d+\s*Instant\s+Lott[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
//       )
//       return m ? toNumber(m[1]) : null
//     })(),

//     // SHIFT STATISTICS: Voided Transactions amount appears on the next line
//     voidedTransactionsAmount: pickNextLineMoney('Voided\\s*Transactions', text),
//     voidedTransactionsCount: pickTrailingInt('Voided\\s*Transactions', text),
//   }

//   // Station times (strings in format "YYYY-MM-DD HH:mm"); if missing, leave undefined
//   const pickStationDateTimeString = (label, t) => {
//     const re = new RegExp(`^\\s*${label}\\s*:\\s*(\\d{4}-\\d{2}-\\d{2})\\s+(\\d{2}:\\d{2})\\s*$`, 'mi')
//     const m = t.match(re)
//     return m ? `${m[1]} ${m[2]}` : undefined
//   }
//   const startStr = pickStationDateTimeString('Start', text)
//   const endStr = pickStationDateTimeString('End', text)
//   if (startStr) metrics.stationStart = startStr
//   if (endStr) metrics.stationEnd = endStr

//   const sd = text.match(/^\s*Safedrops\s+(\d+)\s+([-\d.,]+)\s*$/mi)
//   if (sd) {
//     metrics.safedrops = { count: Number(sd[1]), amount: toNumber(sd[2]) }
//   }
//   return metrics
// }

// module.exports = { parseSftReport }

// Shared parser for .sft shift report files
const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')));
const pickNum = (re, text) => {
  const m = text.match(re);
  return m ? toNumber(m[1]) : null;
};

const pickLastMoney = (labelPattern, text) => {
  const lineRe = new RegExp(`^\\s*${labelPattern}\\b.*$`, 'gmi');
  const lines = text.match(lineRe);
  if (!lines || !lines.length) return null;
  const line = lines[lines.length - 1];

  const moneyMatches = [...line.matchAll(/\$\s*([-\d.,]+)/g)];
  if (!moneyMatches.length) return null;
  return toNumber(moneyMatches[moneyMatches.length - 1][1]);
};

const pickNextLineMoney = (labelPattern, text) => {
  const lines = text.split(/\r?\n/);
  const labelRe = new RegExp(`^\n?\t?\s*${labelPattern}\\b`, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (labelRe.test(lines[i])) {
      for (let j = i + 1; j <= i + 4 && j < lines.length; j++) {
        const line = lines[j];
        if (!line || /^\s*$/.test(line)) continue;
        const mDollar = line.match(/\$\s*([-\d.,]+)/);
        if (mDollar) return toNumber(mDollar[1]);
        const mPlain = line.match(/(^|\s)([-\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*$/);
        if (mPlain) return toNumber(mPlain[2]);
      }
      break;
    }
  }
  return null;
};

const pickTrailingInt = (labelPattern, text) => {
  const lineRe = new RegExp(`^\\s*${labelPattern}\\b.*$`, 'gmi');
  const lines = text.match(lineRe);
  if (!lines || !lines.length) return null;
  const line = lines[lines.length - 1];
  const m = line.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
};

/**
 * HELPER: Extracts the first numeric value (Sales column) for a tender type 
 * strictly within the POS TOTALS block context.
 */
const pickPosTotalSales = (tenderLabel, text) => {
  // Capture everything from 'POS TOTALS' down to the dashed boundary line
  const blockMatch = text.match(/POS TOTALS[\s\S]*?----------------------------/i);
  if (!blockMatch) return null;

  const blockText = blockMatch[0];
  // Matches label followed by a 3-digit count, then grabs the Sales currency amount
  const re = new RegExp(`^\\s*${tenderLabel}\\s+\\d{3}\\s+([-\\d.,]+)`, 'mi');
  const m = blockText.match(re);
  return m ? toNumber(m[1]) : null;
};

/**
 * HELPER: Scans the entire text for any of the fuel section blocks,
 * extracts volume and amount for each grade, and aggregates them.
 */
const parseFuelGrades = (text) => {
  const lines = text.split(/\r?\n/);
  const aggregated = {};

  // Regex to detect any of our target fuel section headers
  const headerRe = /(MANUAL\s+SELF\s+SERVE\s+FUEL\s+SALES|SELF\s+SERVE\s+FUEL\s+SALES|FULL\s+SERVE\s+FUEL\s+SALES)/i;
  // Matches a line with a fuel grade name followed by volume and amount numbers
  const dataRowRe = /^\s*([A-Z0-9\s]+?)\s+([-\d.,]+)\s+([-\d.,]+)\s*$/i;

  let inFuelSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we are entering a relevant fuel section
    if (headerRe.test(line)) {
      inFuelSection = true;
      continue;
    }

    if (inFuelSection) {
      // Exit the section configuration when we hit the total boundary separator line
      if (/^-{5,}/.test(line.trim()) || /^\s*Total\b/i.test(line)) {
        inFuelSection = false;
        continue;
      }

      const match = line.match(dataRowRe);
      if (match) {
        const gradeName = match[1].trim().toLowerCase();
        // Skip header tracking artifact rows like "FUEL TYPE" or volume units
        if (gradeName === 'fuel type' || gradeName === 'volume' || gradeName === 'total') continue;

        const volume = toNumber(match[2]);
        const amount = toNumber(match[3]);

        if (!aggregated[gradeName]) {
          aggregated[gradeName] = { volume: 0, amount: 0 };
        }

        // Aggregate across different section blocks (Self vs Full vs Manual)
        if (volume !== null) aggregated[gradeName].volume += volume;
        if (amount !== null) aggregated[gradeName].amount += amount;
      }
    }
  }

  // Convert aggregated values to clean up floating point errors, or return null if empty
  if (Object.keys(aggregated).length === 0) return null;

  const result = {};
  for (const [grade, data] of Object.entries(aggregated)) {
    result[grade] = {
      volume: Number(data.volume.toFixed(2)),
      amount: Number(data.amount.toFixed(2))
    };
  }
  return result;
};

/**
 * BULLETPROOF SPLIT HELPER: Isolates the block, separates lines directly,
 * and processes rows token-by-token to capture both Incurred and Paid metrics.
 */
const parseArCustomers = (text) => {
  // 1️⃣ Extract everything from 'A/R Customers' down to 'POS TOTALS'
  const blockMatch = text.match(/A\/R\s+Customers[\s\S]*?(?=POS\s+TOTALS)/i);
  if (!blockMatch) return [];

  const blockText = blockMatch[0];
  const customersArray = [];

  // 2️⃣ Break the block cleanly into individual rows
  const lines = blockText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip empty lines or headers
    if (!trimmed || /A\/R\s+Customers/i.test(trimmed) || /Cust\s+Name|Incurred|Paid/i.test(trimmed)) {
      continue;
    }

    // 3️⃣ Tokenize row by whitespace arrays
    const tokens = trimmed.split(/\s+/);

    // An A/R data line must end with 2 numeric tracking values (Incurred and Paid)
    if (tokens.length >= 3) {
      const paidStr = tokens[tokens.length - 1];
      const incurredStr = tokens[tokens.length - 2];

      // Verify that both trailing text items are numbers
      if (/^[-\d.,]+$/.test(incurredStr) && /^[-\d.,]+$/.test(paidStr)) {
        const incurredValue = toNumber(incurredStr);
        const paidValue = toNumber(paidStr);

        // Re-assemble the remaining leading elements into the Customer Name string
        const nameTokens = tokens.slice(0, tokens.length - 2);
        const custName = nameTokens.join(' ').trim();

        if (custName) {
          customersArray.push({
            name: custName,
            incurred: incurredValue !== null ? Number(incurredValue.toFixed(2)) : 0,
            paid: paidValue !== null ? Number(paidValue.toFixed(2)) : 0
          });
        }
      }
    }
  }

  return customersArray;
};

/**
 * FIXED HELPER: Finds the 'Grand Total' dollar amount for a specific department ID.
 * Isolates the department block first, then securely extracts its final Grand Total line value.
 */
const pickDeptGrandTotal = (deptId, text) => {
  const cleanId = String(deptId).replace(/^0+/, '');
  const lines = text.split(/\r?\n/);

  let inDept = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect the start of our targeted department
    // Matches "Department: 000101" or "Department: 101"
    if (/Department:\s*0*/i.test(line)) {
      const matchId = line.replace(/^[^\d]+/, '').trim().replace(/^0+/, '');
      if (matchId.startsWith(cleanId)) {
        inDept = true;
        continue;
      } else {
        inDept = false; // Entered a different department block
      }
    }

    if (inDept) {
      // Look for the Grand Total line inside this specific department block
      if (/Grand\s+Total/i.test(line)) {
        const moneyMatch = line.match(/\$\s*([-\d.,]+)/);
        if (moneyMatch) {
          return toNumber(moneyMatch[1]);
        }
      }
    }
  }
  return null;
};

/**
 * HELPER: Isolates department 213 and 999 text blocks, scans individual line items 
 * containing the keyword 'PROPANE', and extracts and sums up their dollar values.
 */
const parsePropaneSales = (text) => {
  const lines = text.split(/\r?\n/);
  const targetDepts = ['213', '999'];
  let totalPropane = 0;
  let inTargetDept = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1️⃣ Detect entry into a department block
    if (/Department:\s*0*/i.test(line)) {
      const matchId = line.replace(/^[^\d]+/, '').trim().replace(/^0+/, '');
      // Check if this department matches '213' or '999'
      if (targetDepts.some(id => matchId.startsWith(id))) {
        inTargetDept = true;
      } else {
        inTargetDept = false; // Entered a different department block, stop tracking
      }
      continue;
    }

    if (inTargetDept) {
      // 2️⃣ Exit condition for the current department item scanning zone
      if (/^-------/.test(trimmed) || /Grand\s+Total/i.test(trimmed)) {
        inTargetDept = false;
        continue;
      }

      // 3️⃣ Filter for lines containing 'PROPANE'
      if (/PROPANE/i.test(trimmed)) {
        // Extract the dollar amount at the end of the line (e.g., "$  119.96" or "$119.96")
        const moneyMatch = trimmed.match(/\$\s*([-\d.,]+)\s*$/);
        if (moneyMatch) {
          const value = toNumber(moneyMatch[1]);
          if (value !== null) {
            totalPropane += value;
          }
        }
      }
    }
  }

  return totalPropane > 0 ? Number(totalPropane.toFixed(2)) : null;
};

/**
 * HELPER: Isolates department 999 text block, scans individual line items 
 * containing the keyword 'BINGO', and extracts and sums up their dollar values.
 */
const parseBingoSales = (text) => {
  const lines = text.split(/\r?\n/);
  let totalBingo = 0;
  let inTargetDept = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1️⃣ Detect entry into department 999 block
    if (/Department:\s*0*/i.test(line)) {
      const matchId = line.replace(/^[^\d]+/, '').trim().replace(/^0+/, '');
      if (matchId.startsWith('999')) {
        inTargetDept = true;
      } else {
        inTargetDept = false; // Entered a different department block, stop tracking
      }
      continue;
    }

    if (inTargetDept) {
      // 2️⃣ Exit condition for the current department block
      if (/^-------/.test(trimmed) || /Grand\s+Total/i.test(trimmed)) {
        inTargetDept = false;
        continue;
      }

      // 3️⃣ Filter for lines containing 'BINGO'
      if (/BINGO/i.test(trimmed)) {
        // Extract the dollar amount at the end of the line (e.g. "$   96.00")
        const moneyMatch = trimmed.match(/\$\s*([-\d.,]+)\s*$/);
        if (moneyMatch) {
          const value = toNumber(moneyMatch[1]);
          if (value !== null) {
            totalBingo += value;
          }
        }
      }
    }
  }

  return totalBingo > 0 ? Number(totalBingo.toFixed(2)) : null;
};

function parseSftReport(text) {
  const metrics = {
    fuelSales: pickNum(/^\s*Fuel sales\s+([-\d.,]+)\s*$/mi, text),
    companyCoupon: pickNum(/^\s*Company Coupon\s+([-\d.,]+)\s*$/mi, text),
    dealGroupCplDiscounts: pickNum(/^\s*Deal Group CPL discounts\s+([-\d.,]+)\s*$/mi, text),
    fuelPriceOverrides: pickNum(/^\s*Fuel Price Overrides\s+([-\d.,]+)\s*$/mi, text),


    itemSales: pickNum(/^\s*Item Sales\s+([-\d.,]+)\s*$/mi, text),
    depositTotal: pickNum(/^\s*Deposit Total\s+([-\d.,]+)\s*$/mi, text),
    pennyRounding: pickNum(/^\s*Penny Rounding\s+([-\d.,]+)\s*$/mi, text),
    totalSales: pickNum(/^\s*Total Sales\s+([-\d.,]+)\s*$/mi, text),
    gst: pickNum(/^\s*GST\s+([-\d.,]+)\s*$/mi, text),
    pst: pickNum(/^\s*PST\s+([-\d.,]+)\s*$/mi, text),

    // NEW: Debit field from upper main section
    debit: pickNum(/^\s*DEBIT\s+([-\d.,]+)\s*$/mi, text),

    afdCredit: pickNum(/^\s*AFD Credit\s+([-\d.,]+)\s*$/mi, text),
    afdDebit: pickNum(/^\s*AFD Debit\s+([-\d.,]+)\s*$/mi, text),
    // afdGiftCard: pickNum(/^\s*AFD\s*Gift\s*Card\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),
    // AFD GC column aggregates two possible shift line items: "AFD Gift Card" and "Ackroo Redeemed".
    // Either, both, or neither may be present on a given shift; combine whichever are found.
    afdGiftCard: (() => {
      const afdGiftCardLine = pickNum(/^\s*AFD Gift Card\s+([-\d.,]+)\s*$/mi, text)
      const ackrooRedeemed = pickNum(/^\s*Ackroo Redeemed\s+([-\d.,]+)\s*$/mi, text)
      if (afdGiftCardLine == null && ackrooRedeemed == null) return null
      return (afdGiftCardLine || 0) + (ackrooRedeemed || 0)
    })(),
    kioskCredit: pickNum(/^\s*Kiosk Credit\s+([-\d.,]+)\s*$/mi, text),
    kioskDebit: pickNum(/^\s*Kiosk Debit\s+([-\d.,]+)\s*$/mi, text),
    kioskGiftCard: pickNum(/^\s*Kiosk Gift Card\s+([-\d.,]+)\s*$/mi, text),
    totalPos: pickNum(/^\s*Total POS\s+([-\d.,]+)\s*$/mi, text) ?? pickNum(/^\s*POS\s+([-\d.,]+)\s*$/mi, text),
    arIncurred: pickNum(/^\s*A\/R incurred\s+([-\d.,]+)\s*$/mi, text),
    grandTotal: pickNum(/^\s*Total\s+([-\d.,]+)\s*$/mi, text),

    missedCpl: pickNum(/^\s*Native cpl miss\s+([-\d.,]+)\s*$/mi, text),
    couponsAccepted: pickNum(/^\s*Coupons Accepted\s+([-\d.,]+)\s*$/mi, text),
    giftCertificates: pickNum(/^\s*Gift Certificates\s+([-\d.,]+)\s*$/mi, text),
    cashOffCoupons: pickNum(/^\s*Cash Off Coupons\s+([-\d.,]+)\s*$/mi, text),
    otherCoupons: pickNum(/^\s*Other Coupons\s+([-\d.,]+)\s*$/mi, text),
    canadianCash: pickNum(/^\s*Canadian Cash\s+([-\d.,]+)\s*$/mi, text),
    usCash: pickNum(/^\s*U\.?S\.?\s*Cash\s+([-\d.,]+)\s*$/mi, text),
    cashOnHand: pickNum(/^\s*Cash On Hand\s+([-\d.,]+)\s*$/mi, text),
    cashBack: pickNum(/^\s*Cash Back\s+([-\d.,]+)\s*$/mi, text),
    payouts: pickNum(/^\s*Payouts\s+([-\d.,]+)\s*$/mi, text),
    unsettledPrepays: pickNum(/^\s*Unsettled Prepays\s+([-\d.,]+)\s*$/mi, text),

    lottoPayout: pickNum(/^\s*lotto\s*payouts?\s*[:\-]?\s*\$?\s*([-\d.,]+)\s*$/mi, text),

    onlineLottoTotal: (() => {
      const m = text.match(
        /Department:\s*\d+\s*Online\s+Lotto[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
      )
      return m ? toNumber(m[1]) : null
    })(),

    dataWave: pickLastMoney('data\\s*wave', text),
    feeDataWave: pickLastMoney('fee\\s*data\\s*wave', text),

    instantLottTotal: (() => {
      const m = text.match(
        /Department:\s*\d+\s*Instant\s+Lott[\s\S]*?^\s*Grand\s+Total[^\n]*\$\s*([-\d.,]+)\s*$/mi
      )
      return m ? toNumber(m[1]) : null
    })(),

    voidedTransactionsAmount: pickNextLineMoney('Voided\\s*Transactions', text),
    voidedTransactionsCount: pickTrailingInt('Voided\\s*Transactions', text),

    // NEW: Tenders parsed strictly from the POS TOTALS table block
    visa: pickPosTotalSales('VISA', text),
    mastercard: pickPosTotalSales('MASTERCARD', text),
    amex: pickPosTotalSales('AMEX', text),
    fuelGrades: parseFuelGrades(text),
    arCustomers: parseArCustomers(text) || [],

    // ADD THIS SECTION:
    tobaccoCig: (() => {
      // const d101 = pickDeptGrandTotal('101', text) || 0;
      // const d104 = pickDeptGrandTotal('104', text) || 0;
      // const d105 = pickDeptGrandTotal('105', text) || 0;
      // const total = d101 + d104 + d105;
      const ids = ['101', '104', '105', '106', '107', '020', '021', '022', '024', '025', '028']; // Expanded to include all common tobacco-related department IDs
      let total = 0;
      ids.forEach(id => {
        total += (pickDeptGrandTotal(id, text) || 0);
      });
      return total > 0 ? Number(total.toFixed(2)) : null;
    })(),

    tobaccoOthers: (() => {
      const ids = ['100', '102', '103', '106', '107', '017', '026', '027'];
      let total = 0;
      ids.forEach(id => {
        total += (pickDeptGrandTotal(id, text) || 0);
      });
      return total > 0 ? Number(total.toFixed(2)) : null;
    })(),
    propaneSales: parsePropaneSales(text),
    bingoSales: parseBingoSales(text)
  }

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
