// Run in the backend container. Dry run by default; --apply writes the plan.
const mongoose = require('mongoose')
const fs = require('node:fs')
const { DateTime } = require('luxon')
const { CashSummary } = require('../models/CashSummaryNew')
const Location = require('../models/Location')
const { parseSftReport } = require('../utils/parseSftReport')

const SITE = 'Sioux Valley'
const FIELDS = ['payouts', 'parsedPayouts', 'lottoPayout']

function correction(content) {
  if (!content?.trim()) throw new Error('Empty SFT report')
  const parsed = parseSftReport(content, SITE)
  // Empty or unexpected reports must not erase saved monetary values.
  if (parsed.payouts == null && parsed.lottoPayout == null && parsed.totalSales == null) {
    throw new Error('No payout amounts found in SFT report')
  }
  const lottoWinLine = content.split(/\r?\n/).find(line => /lotto\s+win/i.test(line))
  if (lottoWinLine && !/^\s*LOTTO WIN\s+([-\d.,]+)\s*$/i.test(lottoWinLine)) {
    throw new Error('Unrecognized LOTTO WIN format')
  }
  const values = {
    payouts: parsed.payouts ?? 0,
    parsedPayouts: parsed.payouts ?? 0,
    lottoPayout: parsed.lottoPayout ?? 0,
  }
  if (Object.values(values).some(value => !Number.isFinite(value))) {
    throw new Error('Invalid parsed payout amount')
  }
  return { values, lottoWin: lottoWinLine ? Number(lottoWinLine.match(/([-\d.,]+)\s*$/)[1].replaceAll(',', '')) : 0, stationEnd: parsed.stationEnd }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const start = process.env.BACKFILL_START || '2026-10-01'
  const end = process.env.BACKFILL_END || DateTime.now().setZone('America/Toronto').toISODate()
  if (![start, end].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid) || start > end) {
    throw new Error('Invalid date range')
  }
  const auditPath = process.env.BACKFILL_AUDIT || `/tmp/sioux-payouts-${start}-${end}-${apply ? 'apply' : 'dry-run'}-${Date.now()}.json`
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 })
  try {
    const location = await Location.findOne({ $or: [{ site: SITE }, { stationName: SITE }] }).lean()
    if (!location) throw new Error('Sioux Valley location not found')
    const zone = location.timezone || 'America/Winnipeg'
    const shifts = await CashSummary.find({ site: SITE }).select('_id site shift_number date businessDate stationEnd payouts parsedPayouts lottoPayout').lean()
    const selected = shifts.filter(shift => {
      const day = shift.businessDate || DateTime.fromJSDate(shift.date).setZone(zone).toISODate()
      return day >= start && day <= end
    })
    if (!selected.length) throw new Error('No saved shifts found in requested range')
    const report = { site: SITE, start, end, apply, scanned: selected.length, plan: [], errors: [] }
    // Fetch every source before applying changes; a missing report stops writes.
    for (const shift of selected) {
      try {
        const url = new URL(`/api/sftp/receive/${encodeURIComponent(shift.shift_number)}`, 'http://24.50.55.130:5000')
        url.searchParams.set('site', SITE)
        url.searchParams.set('type', 'sft')
        const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
        if (!response.ok) throw new Error(`SFT HTTP ${response.status}`)
        const source = await response.json()
        const parsed = correction(String(source.content || '').replace(/^\uFEFF/, ''))
        if (shift.stationEnd && shift.stationEnd !== parsed.stationEnd) throw new Error('Source stationEnd differs from saved shift')
        const before = Object.fromEntries(FIELDS.map(field => [field, shift[field] ?? null]))
        report.plan.push({ id: String(shift._id), shift: shift.shift_number, date: shift.businessDate || shift.date, before, after: parsed.values, lottoWin: parsed.lottoWin, changed: FIELDS.some(field => before[field] !== parsed.values[field]) })
      } catch (error) {
        report.errors.push({ shift: shift.shift_number, error: error.message })
      }
    }
    fs.writeFileSync(auditPath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ auditPath, scanned: report.scanned, changed: report.plan.filter(row => row.changed).length, withLottoWin: report.plan.filter(row => row.lottoWin !== 0).length, lottoWinTotal: Number(report.plan.reduce((sum, row) => sum + row.lottoWin, 0).toFixed(2)), errors: report.errors }))
    if (report.errors.length) throw new Error('Source validation failed; no shifts updated')
    for (const row of report.plan) {
      if (!row.changed || !apply) continue
      const result = await CashSummary.updateOne(
        { _id: row.id, site: SITE, ...row.before },
        { $set: row.after },
      )
      if (result.matchedCount !== 1) throw new Error(`Concurrent change on shift ${row.shift}; stopped`)
      row.applied = true
      fs.writeFileSync(auditPath, JSON.stringify(report, null, 2))
    }
    if (apply) {
      const saved = await CashSummary.find({ _id: { $in: report.plan.map(row => row.id) } }).select(FIELDS.join(' ')).lean()
      const byId = new Map(saved.map(shift => [String(shift._id), shift]))
      for (const row of report.plan) {
        if (FIELDS.some(field => byId.get(row.id)?.[field] !== row.after[field])) throw new Error(`Verification failed for shift ${row.shift}`)
      }
      report.verified = saved.length
      fs.writeFileSync(auditPath, JSON.stringify(report, null, 2))
      console.log(`Verified ${report.verified} saved shifts. Updated ${report.plan.filter(row => row.applied).length}.`)
    }
  } finally {
    await mongoose.disconnect()
  }
}

module.exports = { correction }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
