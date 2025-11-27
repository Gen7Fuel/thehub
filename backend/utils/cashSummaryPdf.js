const React = require('react')
const { pdf, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer')
const CashSummary = require('../models/CashSummaryNew')
const { CashSummaryReport } = require('../models/CashSummaryNew')

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

const fmt = (n) =>
  typeof n === 'number' && !Number.isNaN(n)
    ? n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '-'
const currency = (n) => `$${fmt(Number(n || 0))}`

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
})

function TotalsCards({ totals }) {
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

function ShiftsList({ rows }) {
  const h = React.createElement
  if (!rows.length) {
    return h(Text, { style: styles.rowLabel }, 'No entries for this date.')
  }
  return h(
    View,
    null,
    ...rows.map((r, i) =>
      h(
        View,
        { key: i, style: styles.shiftCard },
        h(Text, { style: styles.shiftHeader }, `Shift Number ${r.shift_number ?? ''}`),
        h(
          View,
          { style: styles.row },
          h(Text, { style: styles.rowLabel }, 'Canadian Cash Counted'),
          h(Text, { style: styles.rowValue }, currency(r.canadian_cash_collected))
        ),
        h(
          View,
          { style: styles.row },
          h(Text, { style: styles.rowLabel }, 'Canadian Cash Reported'),
          h(Text, { style: styles.rowValue }, currency(r.report_canadian_cash))
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

function ReportDoc({ site, date, rows, totals, notes }) {
  const h = React.createElement
  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(
        View,
        { style: styles.titleRow },
        h(Text, { style: styles.title }, `Cash Summary — ${site} — ${date}`)
      ),
      h(Text, { style: styles.sectionTitle }, 'Totals'),
      h(TotalsCards, { totals }),
      h(Text, { style: styles.sectionTitle }, 'Shifts'),
      h(ShiftsList, { rows }),
      h(Text, { style: styles.sectionTitle }, 'Notes'),
      h(NotesSection, { notes })
    )
  )
}

async function generateCashSummaryPdf({ site, date, notes = '' }) {
  if (!site || !date) throw new Error('site and date are required')

  const [yy, mm, dd] = String(date).split('-').map(Number)
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

  if (!notes) {
    const reportDoc = await CashSummaryReport.findOne({ site, date: start }).lean()
    notes = reportDoc?.notes || ''
  }

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

  const instance = pdf(React.createElement(ReportDoc, { site, date, rows, totals, notes }))
  return await instance.toBuffer()
}

// async function generateCashSummaryPdf({ site, date }) {
//   if (!site || !date) throw new Error('site and date are required')
//   const { rows, totals } = await loadReportData(site, date)
//   const instance = pdf(React.createElement(ReportDoc, { site, date, rows, totals }))
//   return await instance.toBuffer()
// }

module.exports = { generateCashSummaryPdf }