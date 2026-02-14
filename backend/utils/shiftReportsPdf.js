const React = require('react')
const { pdf, Document, Page, Text, StyleSheet } = require('@react-pdf/renderer')
const CashSummary = require('../models/CashSummaryNew')

const OFFICE_SFTP_API_BASE = process.env.OFFICE_SFTP_API_BASE || 'http://24.141.32.206:5002'

async function fetchWithTimeout(url, opts = {}, ms = 15000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), ms)
  try {
    const _fetch = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default
    return await _fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(t)
  }
}

async function getShiftNumbersForDate(site, dateYmd) {
  const [yy, mm, dd] = String(dateYmd).split('-').map(Number)
  const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0)
  const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)
  const docs = await CashSummary.find({ site, date: { $gte: start, $lt: end } }, { shift_number: 1 }).lean()
  return Array.from(new Set(docs.map(d => String(d.shift_number)))).sort((a,b)=>Number(a)-Number(b))
}

async function fetchShiftReportContent(site, shift) {
  if (!OFFICE_SFTP_API_BASE) {
    console.warn('OFFICE_SFTP_API_BASE not set; cannot fetch shift reports')
    return null
  }
  const url = new URL(`/api/sftp/receive/${encodeURIComponent(shift)}`, OFFICE_SFTP_API_BASE)
  url.searchParams.set('site', site)
  url.searchParams.set('type', 'sft')
  const resp = await fetchWithTimeout(url.toString(), {}, 20000)
  if (!resp.ok) {
    console.warn(`Shift ${shift} fetch failed ${resp.status}: ${url}`)
    return null
  }
  const data = await resp.json().catch(() => null)
  const content = String(data?.content || '').replace(/^\uFEFF/, '')
  return content || null
}

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: 'Courier' },
  header: { fontSize: 12, marginBottom: 8 },
  sub: { fontSize: 9, color: '#6b7280', marginBottom: 8 },
  pre: { fontSize: 9, lineHeight: 1.2 },
})

function ReportsDoc({ site, date, reports }) {
  const h = React.createElement
  return h(
    Document,
    null,
    ...reports.map((r, i) =>
      h(
        Page,
        { size: 'A4', style: styles.page, key: `${r.shift}-${i}` },
        h(Text, { style: styles.header }, `Shift Report – ${r.shift}`),
        h(Text, { style: styles.sub }, `${site} — ${date}`),
        h(Text, { style: styles.pre }, r.content || 'No content')
      )
    )
  )
}

async function generateShiftReportsPdf({ site, date }) {
  const shifts = await getShiftNumbersForDate(site, date)
  console.log('ShiftReports: shifts', shifts)
  if (!shifts.length) return null

  const reports = []
  for (const shift of shifts) {
    try {
      const content = await fetchShiftReportContent(site, shift)
      if (content) reports.push({ shift, content })
    } catch (e) {
      console.warn('Shift report fetch error', shift, e.message)
    }
  }
  if (!reports.length) {
    console.log('ShiftReports: no report contents gathered')
    return null
  }

  const instance = pdf(React.createElement(ReportsDoc, { site, date, reports }))
  return await instance.toBuffer()
}

module.exports = { generateShiftReportsPdf }