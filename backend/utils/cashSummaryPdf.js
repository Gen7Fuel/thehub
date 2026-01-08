const React = require('react')
const { pdf, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer')
const CashSummary = require('../models/CashSummaryNew')
const { CashSummaryReport } = require('../models/CashSummaryNew')
const { Lottery } = require('../models/Lottery')

// function aggregateBullock(rows) {
//   const sum = (k) =>
//     rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0)

//   return {
//     onlineSales: sum('onlineLottoTotal'),
//     scratchSales: sum('instantLottTotal'),
//     payouts: sum('lottoPayout'),
//     dataWave: sum('dataWave'),
//     dataWaveFee: sum('feeDataWave'),
//   }
// }
// Helper for formatting
const fmt = (n) =>
  typeof n === 'number' && !Number.isNaN(n)
    ? n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '-'
const currency = (n) => `$${fmt(Number(n || 0))}`

function aggregateBullock(rows) {
  const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0)
  return {
    onlineSales: sum('onlineLottoTotal'),
    scratchSales: sum('instantLottTotal'),
    payouts: sum('lottoPayout'),
    dataWave: sum('dataWave'),
    dataWaveFee: sum('feeDataWave'),
  }
}

// function LotteryTable({ lottery, bullock }) {
//   if (!lottery) return null
//   const h = React.createElement

//   const money = (n) => (n != null ? `$${Number(n).toFixed(2)}` : '—')

//   const diff = (a, b) =>
//     typeof a === 'number' && typeof b === 'number' ? a - b : null

//   const DiffCell = ({ value }) =>
//     value == null
//       ? h(Text, { style: styles.muted }, '—')
//       : h(
//         Text,
//         { style: value > 0 ? styles.pos : value < 0 ? styles.neg : styles.muted },
//         `$${value.toFixed(2)}`
//       )

//   const rows = [
//     {
//       label: 'Online Sales',
//       lotto: lottery.onlineLottoTotal,
//       bullock: bullock?.onlineSales,
//       diff:
//         (bullock?.onlineSales ?? 0) -
//         ((lottery.onlineLottoTotal ?? 0) -
//           (lottery.onlineCancellations ?? 0) -
//           (lottery.onlineDiscounts ?? 0)),
//       bold: true,
//     },
//     {
//       label: 'Lotto Cancellations',
//       lotto: lottery.onlineCancellations,
//       indent: true,
//       alt: true,
//     },
//     {
//       label: 'Lotto Discounts',
//       lotto: lottery.onlineDiscounts,
//       indent: true,
//       alt: true,
//     },
//     {
//       label: 'Scratch Sales',
//       lotto: lottery.instantLottTotal,
//       bullock: bullock?.scratchSales,
//       diff:
//         (bullock?.scratchSales ?? 0) -
//         ((lottery.instantLottTotal ?? 0) +
//           (lottery.scratchFreeTickets ?? 0)),
//       bold: true,
//     },
//     {
//       label: 'Scratch Free Tickets',
//       lotto: lottery.scratchFreeTickets,
//       indent: true,
//       alt: true,
//     },
//     {
//       label: 'Payouts',
//       lotto: lottery.lottoPayout,
//       bullock: bullock?.payouts,
//       diff:
//         (bullock?.payouts ?? 0) -
//         ((lottery.lottoPayout ?? 0) +
//           (lottery.scratchFreeTickets ?? 0)),
//       bold: true,
//     },
//     {
//       label: 'Scratch Free Tickets Payouts',
//       lotto: lottery.scratchFreeTickets,
//       indent: true,
//       alt: true,
//     },
//     {
//       label: 'Datawave Value',
//       lotto: lottery.dataWave,
//       bullock: bullock?.dataWave,
//       diff: diff(bullock?.dataWave, lottery.dataWave),
//       bold: true,
//     },
//     {
//       label: 'Datawave Fee',
//       lotto: lottery.feeDataWave,
//       bullock: bullock?.dataWaveFee,
//       diff: diff(bullock?.dataWaveFee, lottery.feeDataWave),
//       indent: true,
//       alt: true,
//     },
//   ]

//   return h(
//     View,
//     { style: styles.table },
//     h(
//       View,
//       { style: styles.tableHeader },
//       h(Text, { style: [styles.th, styles.colDesc] }, 'Description'),
//       h(Text, { style: [styles.th, styles.col] }, 'Lottery'),
//       h(Text, { style: [styles.th, styles.col] }, 'Bulloch'),
//       h(Text, { style: [styles.th, styles.col] }, 'Over / Short')
//     ),
//     ...rows.map((r, i) =>
//       h(
//         View,
//         { key: i, style: [styles.tableRow, r.alt && styles.tableRowAlt] },
//         h(
//           Text,
//           { style: [styles.td, styles.colDesc, r.indent && styles.indent, r.bold && styles.rowValue] },
//           r.label
//         ),
//         h(Text, { style: [styles.td, styles.col] }, money(r.lotto)),
//         h(Text, { style: [styles.td, styles.col] }, money(r.bullock)),
//         h(View, { style: [styles.td, styles.col] }, r.diff != null ? h(DiffCell, { value: r.diff }) : h(Text, {}, '—'))
//       )
//     )
//   )
// }
// 1. Restored the diff helper function
const diff = (a, b) => 
  (typeof a === 'number' && typeof b === 'number') ? a - b : null;

function LotteryTable({ lottery, bullock }) {
  if (!lottery) return null;
  const h = React.createElement;

  const rows = [
    {
      label: 'Online Sales',
      lotto: lottery.onlineLottoTotal,
      bullock: bullock?.onlineSales,
      diff: (bullock?.onlineSales ?? 0) -
        ((lottery.onlineLottoTotal ?? 0) - (lottery.onlineCancellations ?? 0) - (lottery.onlineDiscounts ?? 0)),
      bold: true,
    },
    { label: 'Lotto Cancellations', lotto: lottery.onlineCancellations, indent: true, alt: true },
    { label: 'Lotto Discounts', lotto: lottery.onlineDiscounts, indent: true, alt: true },
    {
      label: 'Scratch Sales',
      lotto: lottery.instantLottTotal,
      bullock: bullock?.scratchSales,
      diff: (bullock?.scratchSales ?? 0) -
        ((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets ?? 0) + (lottery.oldScratchTickets ?? 0)),
      bold: true,
    },
    { label: 'Scratch Free Tickets', lotto: lottery.scratchFreeTickets, indent: true, alt: true },
    { label: 'Old Scratch Tickets', lotto: lottery.oldScratchTickets, indent: true, alt: true },
    {
      label: 'Payouts',
      lotto: lottery.lottoPayout,
      bullock: bullock?.payouts,
      diff: (bullock?.payouts ?? 0) - ((lottery.lottoPayout ?? 0) + (lottery.scratchFreeTickets ?? 0)),
      bold: true,
    },
    {
      label: 'Datawave Value',
      lotto: lottery.dataWave,
      bullock: bullock?.dataWave,
      diff: diff(bullock?.dataWave, lottery.dataWave), // Using restored diff
      bold: true,
    },
    {
      label: 'Datawave Fee', // Restored Datawave Fee
      lotto: lottery.feeDataWave,
      bullock: bullock?.dataWaveFee,
      diff: diff(bullock?.dataWaveFee, lottery.feeDataWave),
      indent: true,
      alt: true,
    },
  ];

  // ... (rest of LotteryTable render logic is the same)
  return h(View, { style: styles.table },
    h(View, { style: styles.tableHeader },
      h(Text, { style: [styles.th, styles.colDesc] }, 'Description'),
      h(Text, { style: [styles.th, styles.col] }, 'Lottery'),
      h(Text, { style: [styles.th, styles.col] }, 'Bulloch'),
      h(Text, { style: [styles.th, styles.col] }, 'Over / Short')
    ),
    ...rows.map((r, i) =>
      h(View, { key: i, style: [styles.tableRow, r.alt && styles.tableRowAlt] },
        h(Text, { style: [styles.td, styles.colDesc, r.indent && styles.indent, r.bold && styles.rowValue] }, r.label),
        h(Text, { style: [styles.td, styles.col] }, currency(r.lotto)),
        h(Text, { style: [styles.td, styles.col] }, r.bullock != null ? currency(r.bullock) : '—'),
        h(Text, { style: [styles.td, styles.col, r.diff > 0 ? styles.pos : r.diff < 0 ? styles.neg : styles.muted] }, 
          r.diff != null ? currency(r.diff) : '—')
      )
    )
  );
}

function AdjustedTotalsCards({ totals, lottery, bullock }) {
  const h = React.createElement;
  if (!lottery) return null;

  // Calculation Logic
  const onlineOS = (bullock?.onlineSales || 0) - 
    ((lottery.onlineLottoTotal ?? 0) - (lottery.onlineCancellations || 0) - (lottery.onlineDiscounts || 0));
  
  const scratchOS = (bullock?.scratchSales || 0) - 
    ((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets || 0) + (lottery.oldScratchTickets || 0));

  const payoutOS = (bullock?.payouts || 0) - 
    ((lottery.lottoPayout ?? 0) + (lottery.scratchFreeTickets || 0));

  const adjReported = (totals.report_canadian_cash || 0) + onlineOS + scratchOS;
  const adjItemSales = (totals.item_sales || 0) + onlineOS + scratchOS;
  const adjPayouts = (totals.payouts || 0) + payoutOS;
  const adjOS = (totals.canadian_cash_collected || 0) - adjReported;

  // Column 1: Cash flow (3 cards)
  const col1 = [
    { label: 'Total Canadian Cash Counted', value: currency(totals.canadian_cash_collected) },
    { label: 'Final Canadian Cash Reported', value: currency(adjReported) },
    { label: 'Final Over/Short', value: currency(adjOS), color: adjOS >= 0 ? styles.valueOk : styles.valueBad },
  ];

  // Column 2: Sales & Payouts (2 cards)
  const col2 = [
    { label: 'Final Item Sales', value: currency(adjItemSales) },
    { label: 'Final Payouts', value: currency(adjPayouts) },
  ];

  const renderCard = (c, i) => 
    h(View, { key: i, style: [styles.card, { width: '100%', marginBottom: 6, backgroundColor: '#fff' }] },
      h(Text, { style: styles.label }, c.label),
      h(Text, { style: [styles.value, c.color] }, c.value)
    );

  return h(
    View, 
    { 
      style: { 
        flexDirection: 'row', 
        backgroundColor: '#f9fafb', // Light grey background
        borderWidth: 1, 
        borderColor: '#e5e7eb',    // Grey border
        borderRadius: 8, 
        padding: 12, 
        marginTop: 5,
        gap: 12 
      } 
    },
    // Left Column
    h(View, { style: { flex: 1 } }, col1.map(renderCard)),
    // Right Column
    h(View, { style: { flex: 1 } }, col2.map(renderCard))
  );
}

async function loadReportData(site, date) {
  const [yy, mm, dd] = String(date).split('-').map(Number)
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

  const rows = await CashSummary.find({ site, date: { $gte: start, $lt: end } })
    .sort({ shift_number: 1 })
    .lean()

  const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0)

  const totals = {
    count: rows.length,
    canadian_cash_collected: sum('canadian_cash_collected'),
    item_sales: sum('item_sales'),
    cash_back: sum('cash_back'),
    loyalty: sum('loyalty'),
    cpl_bulloch: sum('cpl_bulloch'),
    exempted_tax: sum('exempted_tax'),
    report_canadian_cash: sum('report_canadian_cash'),
    payouts: sum('payouts'),
  }

  return { rows, totals }
}

// const fmt = (n) =>
//   typeof n === 'number' && !Number.isNaN(n)
//     ? n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
//     : '-'
// const currency = (n) => `$${fmt(Number(n || 0))}`

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: 'Helvetica' },
  titleRow: { marginBottom: 10 },
  title: { fontSize: 16, fontWeight: 700 },
  sub: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 6 },
  grid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 8,
    marginRight: '4%',
    marginBottom: 10,
  },
  cardRight: { marginRight: 0 },
  label: { color: '#6b7280', fontSize: 9, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: 700 },
  valueOk: { color: '#059669' },
  valueBad: { color: '#dc2626' },
  shiftCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  shiftHeader: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  row: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowLabel: { color: '#6b7280' },
  rowValue: { fontWeight: 700 },
  notesBlock: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
  },
  notesText: { fontSize: 10, lineHeight: 1.3 },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 10,
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },

  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },

  th: {
    padding: 6,
    fontWeight: 700,
    fontSize: 9,
  },

  td: {
    padding: 6,
    fontSize: 9,
  },

  colDesc: { width: '40%' },
  col: { width: '20%' },

  pos: { color: '#059669', fontWeight: 700 },
  neg: { color: '#dc2626', fontWeight: 700 },
  muted: { color: '#6b7280' },

  indent: { paddingLeft: 14 },

  shiftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  shiftCardCompact: {
    width: '31%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 5,
    padding: 6,
    marginBottom: 6,
  },

  shiftHeaderCompact: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },

  shiftRowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },

  shiftLabelCompact: {
    fontSize: 8,
    color: '#6b7280',
  },

  shiftValueCompact: {
    fontSize: 8,
    fontWeight: 700,
  },

})

function TotalsCards({ totals, unsettledPrepays, handheldDebit }) {
  const overShort = Number((totals.canadian_cash_collected || 0) - (totals.report_canadian_cash || 0))
  const h = React.createElement
  const cards = [
    { label: 'Total Canadian Cash Counted', value: currency(totals.canadian_cash_collected) },
    { label: 'Total Canadian Cash Reported', value: currency(totals.report_canadian_cash) },
    {
      label: 'Over/Short',
      value: (overShort >= 0 ? '' : '-') + currency(Math.abs(overShort)),
      color: overShort >= 0 ? styles.valueOk : styles.valueBad,
    },
    { label: 'Item Sales', value: currency(totals.item_sales) },
    { label: 'Cash Back', value: currency(totals.cash_back) },
    { label: 'Loyalty', value: currency(totals.loyalty) },
    { label: 'Exempted Tax', value: currency(totals.exempted_tax) },
    { label: 'Payouts', value: currency(totals.payouts) },
  ]

  if (typeof unsettledPrepays === 'number' && !Number.isNaN(unsettledPrepays)) {
    cards.push({
      label: 'Unsettled Prepays',
      value: currency(unsettledPrepays),
    })
  }
  if (typeof handheldDebit === 'number' && !Number.isNaN(handheldDebit)) {
    cards.push({
      label: 'Handheld Debit',
      value: currency(handheldDebit),
    })
  }

  // Render in two columns, wrapping
  return h(
    View,
    { style: styles.grid },
    ...cards.map((c, i) =>
      h(
        View,
        { key: i, style: [styles.card, (i % 2 === 1) ? styles.cardRight : null] },
        h(Text, { style: styles.label }, c.label),
        h(Text, { style: [styles.value, c.color] }, c.value)
      )
    )
  )
}

// function AdjustedTotalsCards({ totals, lottery, bullock }) {
//   const h = React.createElement
//   if (!lottery) return null

//   // Calculations based on your provided logic
//   const onlineOverShort = (bullock?.onlineSales || 0) - 
//     ((lottery.onlineLottoTotal ?? 0) - (lottery.onlineCancellations || 0) - (lottery.onlineDiscounts || 0))
  
//   const scratchOverShort = (bullock?.scratchSales || 0) - 
//     ((lottery.instantLottTotal ?? 0) + (lottery.scratchFreeTickets || 0) + (lottery.oldScratchTickets || 0))

//   const payoutOverShort = (bullock?.payouts || 0) - 
//     ((lottery.lottoPayout ?? 0) + (lottery.scratchFreeTickets || 0))

//   const adjReportedCash = (totals.report_canadian_cash || 0) + onlineOverShort + scratchOverShort
//   const adjItemSales = (totals.item_sales || 0) + onlineOverShort + scratchOverShort
//   const adjPayouts = (totals.payouts || 0) + payoutOverShort
//   const adjOverShort = (totals.canadian_cash_collected || 0) - adjReportedCash

//   const cards = [
//     { label: 'Final Canadian Cash Reported', value: currency(adjReportedCash) },
//     { label: 'Final Over/Short', value: currency(adjOverShort), color: adjOverShort >= 0 ? styles.valueOk : styles.valueBad },
//     { label: 'Final Item Sales', value: currency(adjItemSales) },
//     { label: 'Final Payouts', value: currency(adjPayouts) },
//   ]

//   return h(View, { style: [styles.grid, { backgroundColor: '#f3f4f6', padding: 8, borderRadius: 6, marginTop: 5 }] },
//     ...cards.map((c, i) =>
//       h(View, { key: i, style: [styles.card, { backgroundColor: '#fff' }] },
//         h(Text, { style: styles.label }, c.label),
//         h(Text, { style: [styles.value, c.color] }, c.value)
//       )
//     )
//   )
// }

function ShiftsList({ rows }) {
  const h = React.createElement

  if (!rows.length) {
    return h(Text, { style: styles.rowLabel }, 'No entries for this date.')
  }

  return h(
    View,
    { style: styles.shiftGrid },
    ...rows.map((r, i) =>
      h(
        View,
        { key: i, style: styles.shiftCardCompact },
        h(
          Text,
          { style: styles.shiftHeaderCompact },
          `Shift ${r.shift_number ?? ''}`
        ),

        h(
          View,
          { style: styles.shiftRowCompact },
          h(Text, { style: styles.shiftLabelCompact }, 'Counted'),
          h(Text, { style: styles.shiftValueCompact }, currency(r.canadian_cash_collected))
        ),

        h(
          View,
          { style: styles.shiftRowCompact },
          h(Text, { style: styles.shiftLabelCompact }, 'Reported'),
          h(Text, { style: styles.shiftValueCompact }, currency(r.report_canadian_cash))
        )
      )
    )
  )
}

function NotesSection({ notes }) {
  const h = React.createElement
  const lines = String(notes || '').split(/\r?\n/)
  return h(
    View,
    { style: styles.notesBlock },
    ...lines.map((line, i) =>
      h(Text, { key: i, style: styles.notesText }, line.length ? line : ' ')
    )
  )
}

// Render optional daily adjustments when values exist
function ExtrasSection({ unsettledPrepays, handheldDebit }) {
  const h = React.createElement
  const hasUnsettled = typeof unsettledPrepays === 'number' && !Number.isNaN(unsettledPrepays)
  const hasHandheld = typeof handheldDebit === 'number' && !Number.isNaN(handheldDebit)
  if (!hasUnsettled && !hasHandheld) return null

  return h(
    View,
    { style: styles.notesBlock },
    hasUnsettled &&
      h(
        View,
        { style: styles.row },
        h(Text, { style: styles.rowLabel }, 'Unsettled Prepays'),
        h(Text, { style: styles.rowValue }, currency(unsettledPrepays))
      ),
    hasHandheld &&
      h(
        View,
        { style: styles.row },
        h(Text, { style: styles.rowLabel }, 'Handheld Debit'),
        h(Text, { style: styles.rowValue }, currency(handheldDebit))
      )
  )
}

// function ReportDoc({ site, date, rows, totals, notes }) {
// function ReportDoc({ site, date, rows, totals, notes, lottery, bullock, unsettledPrepays, handheldDebit }) {
//   const h = React.createElement
//   return h(
//     Document,
//     null,
//     h(
//       Page,
//       { size: 'A4', style: styles.page },
//       h(
//         View,
//         { style: styles.titleRow },
//         h(Text, { style: styles.title }, `Cash Summary — ${site} — ${date}`)
//       ),
//       h(Text, { style: styles.sectionTitle }, 'Totals'),
//       h(TotalsCards, { totals, unsettledPrepays, handheldDebit }),
//       // No separate Adjustments section/cards; handled in TotalsCards
//       lottery &&
//       h(
//         React.Fragment,
//         null,
//         h(Text, { style: styles.sectionTitle }, 'Lottery'),
//         h(LotteryTable, { lottery, bullock })
//       ),
//       h(Text, { style: styles.sectionTitle }, 'Shifts'),
//       h(View, { wrap: false }, h(ShiftsList, { rows })),
//       h(Text, { style: styles.sectionTitle }, 'Notes'),
//       h(NotesSection, { notes })
//     )
//   )
// }
function ReportDoc({ site, date, rows, totals, notes, lottery, bullock, unsettledPrepays, handheldDebit }) {
  const h = React.createElement;

  // Check if we have extra cards that might push content too far down
  const hasExtras = (typeof unsettledPrepays === 'number' && !Number.isNaN(unsettledPrepays)) || 
                    (typeof handheldDebit === 'number' && !Number.isNaN(handheldDebit));

  return h(Document, null,
    h(Page, { size: 'A4', style: styles.page },
      // Header
      h(View, { style: styles.titleRow },
        h(Text, { style: styles.title }, `Cash Summary — ${site} — ${date}`)
      ),

      // 1. Totals Section
      h(Text, { style: styles.sectionTitle }, 'Totals'),
      h(TotalsCards, { totals, unsettledPrepays, handheldDebit }),

      // 2. Adjusted Totals Section
      lottery && h(React.Fragment, null,
        h(Text, { style: styles.sectionTitle }, 'Adjusted Totals (After Lottery)'),
        h(AdjustedTotalsCards, { totals, lottery, bullock })
      ),

      // --- CONDITIONAL PAGE BREAK ---
      // If we have extras and a lottery table, start the table on a new page to avoid breaking
      lottery && hasExtras && h(View, { break: true }),

      // 3. Lottery Details Section
      lottery && h(React.Fragment, null,
        h(Text, { style: styles.sectionTitle }, 'Lottery Details'),
        h(LotteryTable, { lottery, bullock })
      ),

      // 4. Shifts Section
      h(Text, { style: styles.sectionTitle }, 'Shifts'),
      h(View, { wrap: false }, h(ShiftsList, { rows })),

      // 5. Notes Section
      h(Text, { style: styles.sectionTitle }, 'Notes'),
      h(NotesSection, { notes })
    )
  );
}

async function generateCashSummaryPdf({ site, date, notes = '' }) {
  if (!site || !date) throw new Error('site and date are required')

  const [yy, mm, dd] = String(date).split('-').map(Number)
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

  let reportDocForExtras = null
  if (!notes) {
    const reportDoc = await CashSummaryReport.findOne({ site, date: start }).lean()
    notes = reportDoc?.notes || ''
    reportDocForExtras = reportDoc
  }

  const rows = await CashSummary.find({ site, date: { $gte: start, $lt: end } })
    .sort({ shift_number: 1 })
    .lean()
  const bullock = aggregateBullock(rows)

  const lottery = await Lottery.findOne({ site, date }).lean()


  const sum = (k) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? r[k] : 0), 0)
  const totals = {
    count: rows.length,
    canadian_cash_collected: sum('canadian_cash_collected'),
    item_sales: sum('item_sales'),
    cash_back: sum('cash_back'),
    loyalty: sum('loyalty'),
    cpl_bulloch: sum('cpl_bulloch'),
    exempted_tax: sum('exempted_tax'),
    report_canadian_cash: sum('report_canadian_cash'),
    payouts: sum('payouts'),
  }

  // const instance = pdf(React.createElement(ReportDoc, { site, date, rows, totals, notes }))
  // Fetch report again if needed to read optional extras
  if (!reportDocForExtras) {
    try {
      reportDocForExtras = await CashSummaryReport.findOne({ site, date: start }).lean()
    } catch (_) { /* ignore */ }
  }
  const unsettledPrepays = reportDocForExtras?.unsettledPrepays
  const handheldDebit = reportDocForExtras?.handheldDebit

  const instance = pdf(
    React.createElement(ReportDoc, {
      site,
      date,
      rows,
      totals,
      notes,
      lottery,
      bullock,
      unsettledPrepays,
      handheldDebit,
    })
  )

  return await instance.toBuffer()
}

// async function generateCashSummaryPdf({ site, date }) {
//   if (!site || !date) throw new Error('site and date are required')
//   const { rows, totals } = await loadReportData(site, date)
//   const instance = pdf(React.createElement(ReportDoc, { site, date, rows, totals }))
//   return await instance.toBuffer()
// }

module.exports = { generateCashSummaryPdf }