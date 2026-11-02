/**
 * Backfill CashSummary.businessDate from the existing UTC `date` field and
 * each store's configured IANA timezone. CashSummaryReport.businessDate is
 * backfilled from its existing UTC-normalized calendar date.
 *
 * Dry run by default:
 *   node manual/backfillCashSummaryBusinessDate.js
 *   node manual/backfillCashSummaryBusinessDate.js --apply
 *   node manual/backfillCashSummaryBusinessDate.js --site="Silver Grizzly" --apply
 */

require('dotenv').config()

const mongoose = require('mongoose')
const { DateTime } = require('luxon')
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew')
const Location = require('../models/Location')

const apply = process.argv.includes('--apply')
const siteArg = process.argv.find((arg) => arg.startsWith('--site='))
const requestedSite = siteArg ? siteArg.slice('--site='.length).trim() : null
const BATCH_SIZE = 500

function businessDateFor(date, timezone) {
  const instant = new Date(date)
  if (Number.isNaN(instant.getTime())) return null

  const local = DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(timezone)
  return local.isValid ? local.toFormat('yyyy-MM-dd') : null
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI)
  console.log(`Connected to MongoDB (${apply ? 'APPLY' : 'dry run'})`)

  const locationDocs = await Location.find({ type: 'store' })
    .select('site stationName timezone')
    .lean()

  const locations = new Map()
  for (const location of locationDocs) {
    const timezone = location.timezone || 'America/Toronto'
    if (location.site) locations.set(String(location.site), timezone)
    if (location.stationName) locations.set(String(location.stationName), timezone)
  }

  const query = { date: { $exists: true } }
  if (requestedSite) query.site = requestedSite

  const shifts = CashSummary.find(query)
    .select('_id site shift_number date businessDate')
    .sort({ site: 1, date: 1, shift_number: 1 })
    .lean()

  let scanned = 0
  let changed = 0
  let missingLocation = 0
  let invalidDate = 0
  let ops = []

  for await (const shift of shifts.cursor()) {
    scanned += 1
    const timezone = locations.get(String(shift.site))
    if (!timezone) {
      missingLocation += 1
      console.warn(`Skipping ${shift.site}/${shift.shift_number}: no store timezone found`)
      continue
    }

    const businessDate = businessDateFor(shift.date, timezone)
    if (!businessDate) {
      invalidDate += 1
      console.warn(`Skipping ${shift.site}/${shift.shift_number}: invalid date ${shift.date}`)
      continue
    }

    if (shift.businessDate === businessDate) continue
    changed += 1

    if (apply) {
      ops.push({
        updateOne: {
          filter: { _id: shift._id },
          update: { $set: { businessDate } },
        },
      })

      if (ops.length >= BATCH_SIZE) {
        await CashSummary.bulkWrite(ops, { ordered: false })
        ops = []
      }
    }
  }

  if (apply && ops.length) {
    await CashSummary.bulkWrite(ops, { ordered: false })
  }

  const reportQuery = { date: { $exists: true } }
  if (requestedSite) reportQuery.site = requestedSite

  const reports = CashSummaryReport.find(reportQuery)
    .select('_id site date businessDate')
    .sort({ site: 1, date: 1 })
    .lean()

  let reportsScanned = 0
  let reportsChanged = 0
  let reportOps = []

  for await (const report of reports.cursor()) {
    reportsScanned += 1
    const instant = new Date(report.date)
    if (Number.isNaN(instant.getTime())) {
      invalidDate += 1
      console.warn(`Skipping report ${report.site}/${report._id}: invalid date ${report.date}`)
      continue
    }

    // Reports historically use a UTC-normalized YYYY-MM-DD date anchor.
    const businessDate = instant.toISOString().slice(0, 10)
    if (report.businessDate === businessDate) continue
    reportsChanged += 1

    if (apply) {
      reportOps.push({
        updateOne: {
          filter: { _id: report._id },
          update: { $set: { businessDate } },
        },
      })

      if (reportOps.length >= BATCH_SIZE) {
        await CashSummaryReport.bulkWrite(reportOps, { ordered: false })
        reportOps = []
      }
    }
  }

  if (apply && reportOps.length) {
    await CashSummaryReport.bulkWrite(reportOps, { ordered: false })
  }

  console.log(`Scanned: ${scanned}`)
  console.log(`${apply ? 'Updated' : 'Would update'}: ${changed}`)
  console.log(`Missing location timezone: ${missingLocation}`)
  console.log(`Invalid dates: ${invalidDate}`)
  console.log(`Reports scanned: ${reportsScanned}`)
  console.log(`${apply ? 'Updated' : 'Would update'} reports: ${reportsChanged}`)

  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
