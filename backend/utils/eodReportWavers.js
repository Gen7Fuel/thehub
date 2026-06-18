const React = require('react');
const { pdf, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer');
const CashSummary = require('../models/CashSummaryNew');
const { CashSummaryReport } = require('../models/CashSummaryNew');
const { Lottery } = require('../models/Lottery');
const Location = require('../models/Location');

const h = React.createElement;

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#333333',
  },
  headerContainer: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  rightHeaderText: {
    textAlign: 'right',
    fontSize: 10,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginTop: 8,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 4,
    marginBottom: 5,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    backgroundColor: '#F2F2F2',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E2F0D9',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 2,
  },
  subSectionHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 1,
  },
  sectionHeaderText: {
    fontWeight: 'bold',
    color: '#1E4620',
  },
  subSectionHeaderText: {
    fontWeight: 'bold',
    color: '#333333',
    textDecoration: 'underline',
  },
  colDesc: { flex: 2, textAlign: 'left' },
  colQty: { width: 60, textAlign: 'right' },
  colAmount: { width: 90, textAlign: 'right' },
  textBold: { fontWeight: 'bold' },
  rowIndent: { paddingLeft: 12 },

  valPositive: { color: '#059669', fontWeight: 'bold' },
  valNegative: { color: '#dc2626', fontWeight: 'bold' },
  valZero: { color: '#6b7280', fontWeight: 'bold' },
});

function EodReportDoc({ site, date, data }) {
  const renderRow = (desc, qty, amount, isTotalHighlight = false, customAmountStyle = null, isIndented = false) => {
    let amtStr = '';
    if (typeof amount === 'number') {
      amtStr = amount >= 0 ? `$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
    }

    const qtyStr = typeof qty === 'number' ? qty.toFixed(2) : (qty || '');
    const rowStyle = isTotalHighlight ? styles.totalRow : styles.tableRow;

    return h(View, { style: rowStyle },
      h(Text, { style: [styles.colDesc, isTotalHighlight && styles.textBold, isIndented && styles.rowIndent] }, desc),
      h(Text, { style: styles.colQty }, qtyStr),
      h(Text, { style: [styles.colAmount, isTotalHighlight && styles.textBold, customAmountStyle] }, amtStr)
    );
  };

  const renderSectionHeader = (title) => {
    return h(View, { style: styles.sectionHeaderRow },
      h(Text, { style: styles.sectionHeaderText }, title)
    );
  };

  const renderSubSectionHeader = (title) => {
    return h(View, { style: styles.subSectionHeaderRow },
      h(Text, { style: styles.subSectionHeaderText }, title)
    );
  };

  // Calculate section totals dynamically
  const totalTenders = Object.values(data.tenders).reduce((a, b) => a + (b || 0), 0) + (data.reportCanadianCash || 0);
  const totalAr = Object.values(data.arCustomers).reduce((a, b) => a + (b || 0), 0);

  let overShortStyle = styles.valZero;
  if (data.overShortCash > 0.01) overShortStyle = styles.valPositive;
  if (data.overShortCash < -0.01) overShortStyle = styles.valNegative;

  return h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      // Header Section
      h(View, { style: styles.headerContainer },
        h(View, { style: styles.headerRow },
          h(Text, { style: styles.titleText }, 'End of day'),
          h(Text, { style: styles.rightHeaderText }, `REPORT FOR ${site.toUpperCase()}`)
        ),
        h(View, { style: styles.headerRow },
          h(Text, null, `Station: ${site}`),
          h(Text, { style: styles.rightHeaderText }, `Period: Daily`)
        ),
        h(View, { style: styles.headerRow },
          h(Text, null, `Date: ${date}`),
          h(Text, { style: styles.rightHeaderText }, `Page 1 / 1`)
        )
      ),

      h(View, { style: styles.divider }),

      // Table Matrix Labels
      h(View, { style: styles.tableHeader },
        h(Text, { style: styles.colDesc }, 'Description'),
        h(Text, { style: styles.colQty }, 'Qty'),
        h(Text, { style: styles.colAmount }, 'Amount')
      ),

      // 1. Cleaned Sales Section Block
      renderSectionHeader('Sales'),
      renderRow('Fuel Sales', '', data.fuelSales, false, null, true),
      renderRow('Fuel Price Overrides', '', data.fuelPriceOverrides, false, null, true),
      renderRow('Item Sales', '', data.itemSales, false, null, true),

      renderSubSectionHeader('Taxes'),
      renderRow('GST', '', data.gst, false, null, true),
      renderRow('PST', '', data.pst, false, null, true),

      renderRow('Penny Rounding', '', data.pennyRounding, false, null, true),
      renderRow('Total Sales', '', data.totalSales, true, null, false),

      // 2. Over / Short Section Block
      // 2. Over / Short Section Block with Manitoba contextual breakdown parameters
      renderSectionHeader('Over / Short'),
      renderRow('Ovr/Sh Cash', '', data.overShortCash, false, overShortStyle),
      ...(data.isManitoba ? [
        renderRow('Cash Collected', '', data.totalCanadianCashCollected, false, null, true),
        renderRow('Cash Reported', '', data.reportCanadianCash, false, null, true),
        renderRow('Cheques Cashed Out', '', data.chequesCashedOut, false, null, true)
      ] : []),

      // 3. Tenders Section Block (Iterating through all gathered key/value options)
      renderSectionHeader('Tenders'),
      ...Object.entries(data.tenders).map(([name, val]) => renderRow(name, '', val)),
      renderRow('Cash', '', data.reportCanadianCash),
      renderRow('Total Tenders', '', totalTenders, true),

      // 4. A/R Customers Section Block (Filtering out $0 entries)
      renderSectionHeader('A/R Incurred'),
      ...Object.entries(data.arCustomers)
        .filter(([_, val]) => val !== 0) // 👈 Drops rows where the incurred amount is exactly 0
        .map(([custName, val]) => renderRow(custName, '', val)),
      renderRow('Total A/R Incurred', '', totalAr, true),

      // 5. Sale by Department Section Block
      renderSectionHeader('Sale by Department'),
      ...Object.entries(data.fuelGrades).map(([grade, info]) =>
        renderRow(`Fuel sales: ${grade.toUpperCase()}`, info.volume, info.amount)
      ),
      renderRow('Tobacco Cig', '', data.tobaccoCig),
      renderRow('Tobacco Others', '', data.tobaccoOthers),
      renderRow('Propane Sales', '', data.propaneSales),

      ...(data.sellsLottery ? [
        renderRow('Lottery Sales', '', data.lotterySales),
        renderRow('Lottery Payouts', '', data.lottoPayout)
      ] : [])
    )
  );
}

async function generateEodReportPdf({ site, date, isManitoba = false }) {
  const [yy, mm, dd] = String(date).split('-').map(Number);
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0);

  const locationDoc = await Location.findOne({ stationName: site }).lean();
  const sellsLottery = locationDoc?.sellsLottery === true;

  const rows = await CashSummary.find({ site, date: { $gte: start, $lt: end } }).lean();
  const reportDoc = await CashSummaryReport.findOne({ site, date: start }).lean();

  let lottery = null;
  if (sellsLottery) {
    lottery = await Lottery.findOne({ site, date }).lean();
  }

  const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);

  // 1️⃣ Aggregate Tenders Dynamically from BOTH flat keys and the sub-document array
  const tendersAgg = {};
  rows.forEach((r) => {
    if (r.tenders && Array.isArray(r.tenders)) {
      r.tenders.forEach((t) => {
        const tenderKey = (t.key || t.name)?.toUpperCase().trim();
        if (tenderKey) {
          tendersAgg[tenderKey] = (tendersAgg[tenderKey] || 0) + (t.value || t.amount || 0);
        }
      });
    }
    if (r.visa) tendersAgg['VISA'] = (tendersAgg['VISA'] || 0) + r.visa;
    if (r.mastercard) tendersAgg['MASTERCARD'] = (tendersAgg['MASTERCARD'] || 0) + r.mastercard;
    if (r.amex) tendersAgg['AMEX'] = (tendersAgg['AMEX'] || 0) + r.amex;
    if (r.debit) tendersAgg['DEBIT'] = (tendersAgg['DEBIT'] || 0) + r.debit;
  });

  // 2️⃣ Aggregate Fuel Grades
  const fuelAgg = {};
  rows.forEach((r) => {
    if (r.fuelGrades && Array.isArray(r.fuelGrades)) {
      r.fuelGrades.forEach((f) => {
        if (f.grade) {
          if (!fuelAgg[f.grade]) fuelAgg[f.grade] = { volume: 0, amount: 0 };
          fuelAgg[f.grade].volume += (f.volume || 0);
          fuelAgg[f.grade].amount += (f.amount || 0);
        }
      });
    }
  });

  // 3️⃣ Aggregate A/R Customer sub-document arrays safely
  const arCustomersAgg = {};
  rows.forEach((r) => {
    if (r.arCustomers && Array.isArray(r.arCustomers)) {
      r.arCustomers.forEach((cust) => {
        const custName = cust.name?.trim();
        const amt = cust.incurred;
        if (custName && typeof amt === 'number') {
          arCustomersAgg[custName] = (arCustomersAgg[custName] || 0) + amt;
        }
      });
    }
  });

  // 4️⃣ Compute Manitoba Over / Short Variance Logic (Factoring in Cheques)
  const totalCanadianCashCollected = sum('canadian_cash_collected');
  const reportCanadianCash = sum('report_canadian_cash');
  const chequesCashedOut = sum('chequesCashedOut');
  const unsettledPrepays = reportDoc?.unsettledPrepays || 0;
  const handheldDebit = reportDoc?.handheldDebit || 0;

  // Add cheques to collected physical assets ONLY if it's a Manitoba site
  const physicalAssets = totalCanadianCashCollected + (isManitoba ? chequesCashedOut : 0);
  let overShortCash = null;

  if (sellsLottery && lottery) {
    const onlineSalesBulloch = sum('onlineLottoTotal');
    const onlineOS = (onlineSalesBulloch || 0) - ((lottery.onlineLottoTotal || 0) - (lottery.onlineCancellations || 0));
    const scratchOS = 0;
    const adjReported = (reportCanadianCash || 0) + onlineOS + scratchOS;

    overShortCash = physicalAssets - adjReported + unsettledPrepays + handheldDebit;
  } else {
    overShortCash = physicalAssets - reportCanadianCash + unsettledPrepays + handheldDebit;
  }

  // 5️⃣ Bind Everything together into aggregatedData
  const aggregatedData = {
    isManitoba, // Passed flag inside data context payload
    sellsLottery,
    fuelSales: sum('fuelSales'),
    fuelPriceOverrides: sum('fuelPriceOverrides'),
    itemSales: sum('item_sales') || sum('parsedItemSales'),
    gst: sum('gst'),
    pst: sum('pst'),
    pennyRounding: sum('pennyRounding'),
    totalSales: sum('totalSales') || sum('grandTotal'),
    totalCanadianCashCollected,
    reportCanadianCash,
    chequesCashedOut,
    overShortCash: typeof overShortCash === 'number' ? Number(overShortCash.toFixed(2)) : null,
    tenders: tendersAgg,
    fuelGrades: fuelAgg,
    arCustomers: arCustomersAgg,
    tobaccoCig: sum('tobaccoCig'),
    tobaccoOthers: sum('tobaccoOthers'),
    propaneSales: sum('propaneSales'),
    lotterySales: sellsLottery ? (sum('onlineLottoTotal') + sum('instantLottTotal')) : 0,
    lottoPayout: sellsLottery ? sum('lottoPayout') : 0,
  };

  const instance = pdf(h(EodReportDoc, { site, date, data: aggregatedData }));
  return await instance.toBuffer();
}

module.exports = { generateEodReportPdf };