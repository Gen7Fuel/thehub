const React = require('react');
const { pdf, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer');
const CashSummary = require('../models/CashSummaryNew');
const Location = require('../models/Location');

const h = React.createElement;

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

  const totalTenders = Object.values(data.tenders).reduce((a, b) => a + (b || 0), 0) + (data.reportedCash || 0);

  const totalArIncurred = Object.values(data.arCustomers).reduce((sum, item) => sum + (item.incurred || 0), 0);
  const totalArPaid = Object.values(data.arCustomers).reduce((sum, item) => sum + (item.paid || 0), 0);
  const activeArEntries = Object.entries(data.arCustomers).filter(([_, item]) => (item.incurred !== 0 || item.paid !== 0));

  let overShortStyle = styles.valZero;
  if (data.overShortCash > 0.01) overShortStyle = styles.valPositive;
  if (data.overShortCash < -0.01) overShortStyle = styles.valNegative;

  // Rule: Show warning note if variance > $50 and no AR data exists
  const showArMissingNote = Math.abs(data.overShortCash) > 50 && activeArEntries.length === 0;

  return h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      // Header
      h(View, { style: styles.headerContainer },
        h(View, { style: styles.headerRow },
          h(Text, { style: styles.titleText }, 'Chicken Delight End of Day'),
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
      ...Object.entries(data.tenders).map(([name, val]) => renderRow(name, val)),
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

      // Display note when Over/Short is significant & no AR details are recorded
      showArMissingNote && h(Text, { style: styles.warningNote }, '* Note: Over/Short threshold exceeded $50, but A/R details were not entered during the shift.')
    )
  );
}

async function generateChickenDelightEodReportPdf({ site, date }) {
  const [yy, mm, dd] = String(date).split('-').map(Number);
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0);

  // 1️⃣ Fetch Chicken Delight shifts only
  const rows = await CashSummary.find({ 
    site, 
    date: { $gte: start, $lt: end }, 
    isChickenDelight: true 
  }).lean();

  const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0);

  // 2️⃣ Aggregate Tenders
  const tendersAgg = {};

  rows.forEach((r) => {
    if (r.tenders && Array.isArray(r.tenders)) {
      r.tenders.forEach((t) => {
        const tenderKey = (t.key || t.name)?.toUpperCase().trim();
        const val = typeof t.value === 'number' ? t.value : (typeof t.amount === 'number' ? t.amount : 0);
        
        if (tenderKey) {
          tendersAgg[tenderKey] = (tendersAgg[tenderKey] || 0) + val;
        }
      });
    }

    if (r.visa) tendersAgg['VISA'] = (tendersAgg['VISA'] || 0) + r.visa;
    if (r.mastercard) tendersAgg['MASTERCARD'] = (tendersAgg['MASTERCARD'] || 0) + r.mastercard;
    if (r.amex) tendersAgg['AMEX'] = (tendersAgg['AMEX'] || 0) + r.amex;
    if (r.debit) tendersAgg['DEBIT'] = (tendersAgg['DEBIT'] || 0) + r.debit;
  });

  // 3️⃣ Aggregate A/R Customers
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

  // 4️⃣ Metrics & Formulas
  const canadianCashCollected = sum('canadian_cash_collected');
  
  // report_canadian_cash is ALREADY saved as: rawTotal - (tendersSum - tips)
  const reportedCash = sum('report_canadian_cash');
  const chickenDelightTips = sum('chickenDelightTips');

  // Over / Short calculation: (Cash Collected + Tips) - Cash Reported
  const overShortCash = (canadianCashCollected + chickenDelightTips) - reportedCash;

  const itemSales = sum('item_sales') || sum('parsedItemSales');

  // 5️⃣ Bind aggregated data
  const aggregatedData = {
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

  const instance = pdf(h(ChickenDelightEodDoc, { site, date, data: aggregatedData }));
  return await instance.toBuffer();
}

module.exports = { generateChickenDelightEodReportPdf };