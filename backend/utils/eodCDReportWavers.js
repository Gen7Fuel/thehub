const React = require('react');
const { pdf, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer');
const CashSummary = require('../models/CashSummaryNew');
const Location = require('../models/Location');

const h = React.createElement;

// Helper to safely stream React-PDF output into a Node Buffer
async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}

// Helper function to map site names for PDF display
const { formatReportSiteName } = require('./siteDisplayName');

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    color: '#333333',
  },
  headerContainer: {
    marginBottom: 15,
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
    fontSize: 9,
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
  colAmount: { width: 90, textAlign: 'right' },
  textBold: { fontWeight: 'bold' },
  rowIndent: { paddingLeft: 12 },

  valPositive: { color: '#059669', fontWeight: 'bold' },
  valNegative: { color: '#dc2626', fontWeight: 'bold' },
  valZero: { color: '#6b7280', fontWeight: 'bold' },

  arColName: { flex: 1, textAlign: 'left' },
  arColAmt: { width: 90, textAlign: 'right' },

  warningNote: {
    marginTop: 6,
    fontSize: 8,
    fontStyle: 'italic',
    color: '#dc2626',
  }
});

function ChickenDelightEodDoc({ site, date, data }) {
  const displaySiteName = formatReportSiteName(site);

  const renderRow = (desc, amount, isTotalHighlight = false, customAmountStyle = null, isIndented = false) => {
    let amtStr = '';
    if (typeof amount === 'number') {
      amtStr = amount >= 0 ? `$${amount.toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
    }

    const rowStyle = isTotalHighlight ? styles.totalRow : styles.tableRow;

    return h(View, { style: rowStyle },
      h(Text, { style: [styles.colDesc, isTotalHighlight && styles.textBold, isIndented && styles.rowIndent] }, desc),
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

  const totalTenders = Object.values(data.tenders || {}).reduce((a, b) => a + (b || 0), 0) + (data.reportedCash || 0);

  const totalArIncurred = Object.values(data.arCustomers || {}).reduce((sum, item) => sum + (item.incurred || 0), 0);
  const totalArPaid = Object.values(data.arCustomers || {}).reduce((sum, item) => sum + (item.paid || 0), 0);
  const activeArEntries = Object.entries(data.arCustomers || {}).filter(([_, item]) => (item.incurred !== 0 || item.paid !== 0));

  let overShortStyle = styles.valZero;
  if (data.overShortCash > 0.01) overShortStyle = styles.valPositive;
  if (data.overShortCash < -0.01) overShortStyle = styles.valNegative;

  // Rule: Show warning note if variance > $50 and no AR data exists
  const showArMissingNote = Math.abs(data.overShortCash) > 50 && activeArEntries.length === 0;

  return h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      // Header Section
      h(View, { style: styles.headerContainer },
        h(View, { style: styles.headerRow },
          h(Text, { style: styles.titleText }, 'Chicken Delight End of Day'),
          h(Text, { style: styles.rightHeaderText }, `REPORT FOR ${displaySiteName.toUpperCase()}`)
        ),
        h(View, { style: styles.headerRow },
          h(Text, null, `Station: ${displaySiteName}`),
          h(Text, { style: styles.rightHeaderText }, `Period: Daily`)
        ),
        h(View, { style: styles.headerRow },
          h(Text, null, `Date: ${date}`),
          h(Text, { style: styles.rightHeaderText }, `Page 1 / 1`)
        )
      ),

      h(View, { style: styles.divider }),

      h(View, { style: styles.tableHeader },
        h(Text, { style: styles.colDesc }, 'Description'),
        h(Text, { style: styles.colAmount }, 'Amount')
      ),

      // 1. Sales Section (No Fuel Sales)
      renderSectionHeader('Sales'),
      renderRow('Item Sales', data.itemSales, false, null, true),

      renderSubSectionHeader('Taxes'),
      renderRow('GST', data.gst, false, null, true),
      renderRow('PST', data.pst, false, null, true),

      renderRow('Penny Rounding', data.pennyRounding, false, null, true),
      renderRow('Total Sales', data.totalSales, true, null, false),

      // 2. Over / Short Section Block
      renderSectionHeader('Over / Short'),
      renderRow('Ovr/Sh Cash', data.overShortCash, false, overShortStyle),
      renderRow('Cash Collected', data.canadianCashCollected, false, null, true),
      renderRow('Cash Reported', data.reportedCash, false, null, true),
      renderRow('Chicken Delight Tips', data.chickenDelightTips, false, null, true),

      // 3. Tenders Section Block
      renderSectionHeader('Tenders'),
      ...Object.entries(data.tenders || {}).map(([name, val]) => renderRow(name, val)),
      renderRow('Cash', data.reportedCash),
      renderRow('Total Tenders', totalTenders, true),

      // 4. A/R Details Section Block
      renderSectionHeader('A/R Details'),
      h(View, { style: [styles.tableRow, styles.textBold, { borderBottomWidth: 0.5, borderBottomColor: '#333333', paddingBottom: 2 }] },
        h(Text, { style: styles.arColName }, 'A/R Customer'),
        h(Text, { style: styles.arColAmt }, 'Incurred'),
        h(Text, { style: styles.arColAmt }, 'Paid')
      ),
      activeArEntries.map(([custName, item]) => 
        h(View, { key: custName, style: styles.tableRow },
          h(Text, { style: styles.arColName }, custName),
          h(Text, { style: styles.arColAmt }, item.incurred >= 0 ? `$${item.incurred.toFixed(2)}` : `-$${Math.abs(item.incurred).toFixed(2)}`),
          h(Text, { style: styles.arColAmt }, item.paid >= 0 ? `$${item.paid.toFixed(2)}` : `-$${Math.abs(item.paid).toFixed(2)}`)
        )
      ),
      h(View, { style: styles.totalRow },
        h(Text, { style: [styles.arColName, styles.textBold] }, 'Total A/R'),
        h(Text, { style: [styles.arColAmt, styles.textBold] }, totalArIncurred >= 0 ? `$${totalArIncurred.toFixed(2)}` : `-$${Math.abs(totalArIncurred).toFixed(2)}`),
        h(Text, { style: [styles.arColAmt, styles.textBold] }, totalArPaid >= 0 ? `$${totalArPaid.toFixed(2)}` : `-$${Math.abs(totalArPaid).toFixed(2)}`)
      ),

      showArMissingNote && h(Text, { style: styles.warningNote }, '* Note: Over/Short threshold exceeded $50, but A/R details were not entered during the shift.')
    )
  );
}

/**
 * 1. Data Fetcher for single date Chicken Delight shifts
 */
async function fetchChickenDelightEodDataForDate({ site, date }) {
  const [yy, mm, dd] = String(date).split('-').map(Number);
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0);

  const rows = await CashSummary.find({ 
    site, 
    date: { $gte: start, $lt: end }, 
    isChickenDelight: true 
  }).lean();

  const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);

  const tendersAgg = {};
  rows.forEach((r) => {
    if (r.tenders && Array.isArray(r.tenders)) {
      r.tenders.forEach((t) => {
        const tenderKey = (t.key || t.name)?.toUpperCase().trim();
        const val = typeof t.value === 'number' ? t.value : (typeof t.amount === 'number' ? t.amount : 0);
        if (tenderKey) tendersAgg[tenderKey] = (tendersAgg[tenderKey] || 0) + val;
      });
    }

    if (r.visa) tendersAgg['VISA'] = (tendersAgg['VISA'] || 0) + r.visa;
    if (r.mastercard) tendersAgg['MASTERCARD'] = (tendersAgg['MASTERCARD'] || 0) + r.mastercard;
    if (r.amex) tendersAgg['AMEX'] = (tendersAgg['AMEX'] || 0) + r.amex;
    if (r.debit) tendersAgg['DEBIT'] = (tendersAgg['DEBIT'] || 0) + r.debit;
  });

  const arCustomersAgg = {};
  rows.forEach((r) => {
    if (r.arCustomers && Array.isArray(r.arCustomers)) {
      r.arCustomers.forEach((cust) => {
        const custName = cust.name?.trim();
        if (custName) {
          if (!arCustomersAgg[custName]) {
            arCustomersAgg[custName] = { incurred: 0, paid: 0 };
          }
          arCustomersAgg[custName].incurred += (typeof cust.incurred === 'number' ? cust.incurred : 0);
          arCustomersAgg[custName].paid += (typeof cust.paid === 'number' ? cust.paid : 0);
        }
      });
    }
  });

  const canadianCashCollected = sum('canadian_cash_collected');
  const reportedCash = sum('report_canadian_cash');
  const chickenDelightTips = sum('chickenDelightTips');
  const overShortCash = (canadianCashCollected + chickenDelightTips) - reportedCash;
  const itemSales = sum('item_sales') || sum('parsedItemSales');

  return {
    itemSales,
    gst: sum('gst'),
    pst: sum('pst'),
    pennyRounding: sum('pennyRounding'),
    totalSales: sum('totalSales') || sum('grandTotal'),
    canadianCashCollected,
    chickenDelightTips,
    reportedCash,
    overShortCash: typeof overShortCash === 'number' ? Number(overShortCash.toFixed(2)) : 0,
    tenders: tendersAgg,
    arCustomers: arCustomersAgg,
  };
}

/**
 * 2. Cumulative Data Combiner for multiple days
 */
function combineChickenDelightEodData(dailyDataList) {
  const combined = {
    itemSales: 0,
    gst: 0,
    pst: 0,
    pennyRounding: 0,
    totalSales: 0,
    canadianCashCollected: 0,
    chickenDelightTips: 0,
    reportedCash: 0,
    overShortCash: 0,
    tenders: {},
    arCustomers: {}
  };

  dailyDataList.forEach((day) => {
    if (!day) return;
    combined.itemSales += (day.itemSales || 0);
    combined.gst += (day.gst || 0);
    combined.pst += (day.pst || 0);
    combined.pennyRounding += (day.pennyRounding || 0);
    combined.totalSales += (day.totalSales || 0);
    combined.canadianCashCollected += (day.canadianCashCollected || 0);
    combined.chickenDelightTips += (day.chickenDelightTips || 0);
    combined.reportedCash += (day.reportedCash || 0);

    // Combine Tenders
    if (day.tenders) {
      Object.entries(day.tenders).forEach(([k, v]) => {
        combined.tenders[k] = (combined.tenders[k] || 0) + (v || 0);
      });
    }

    // Combine AR Customers
    if (day.arCustomers) {
      Object.entries(day.arCustomers).forEach(([custName, item]) => {
        if (!combined.arCustomers[custName]) {
          combined.arCustomers[custName] = { incurred: 0, paid: 0 };
        }
        combined.arCustomers[custName].incurred += (item.incurred || 0);
        combined.arCustomers[custName].paid += (item.paid || 0);
      });
    }
  });

  // Re-calculate Over/Short for cumulative dataset
  combined.overShortCash = Number(((combined.canadianCashCollected + combined.chickenDelightTips) - combined.reportedCash).toFixed(2));

  return combined;
}

/**
 * 3. Render Buffer Function
 */
async function generateChickenDelightEodReportBuffer({ site, date, data }) {
  const instance = pdf(h(ChickenDelightEodDoc, { site, date, data }));
  const result = await instance.toBuffer();

  if (Buffer.isBuffer(result)) {
    return result;
  }

  return await streamToBuffer(result);
}

/**
 * 4. Primary Function (UNCHANGED SIGNATURE AND PURPOSE FOR MAIN ROUTE)
 */
async function generateChickenDelightEodReportPdf({ site, date }) {
  const data = await fetchChickenDelightEodDataForDate({ site, date });
  return await generateChickenDelightEodReportBuffer({ site, date, data });
}

module.exports = {
  generateChickenDelightEodReportPdf, // Main route entrypoint (100% backward-compatible)
  fetchChickenDelightEodDataForDate,
  combineChickenDelightEodData,
  generateChickenDelightEodReportBuffer
};