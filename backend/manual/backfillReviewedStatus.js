const mongoose = require('mongoose')
const connectDB = require('../config/db')
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew') // Adjust path as needed

/**
 * Normalizes a date object/string to UTC start-of-day for matching
 */
function normalizeToStartOfDay(dateInput) {
  const d = new Date(dateInput)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function backfillReviewedStatus() {
  console.log('--- Starting Backfill of Reviewed Field on CashSummary Documents ---')

  try {
    // 1. Fetch only documents where 'reviewed' key is missing or undefined
    const pendingShifts = await CashSummary.find({
      $or: [{ reviewed: { $exists: false } }, { reviewed: null }],
    }).lean()

    console.log(`Found ${pendingShifts.length} CashSummary documents missing the 'reviewed' key.`)

    if (pendingShifts.length === 0) {
      console.log('No documents require backfilling.')
      return
    }

    // 2. Fetch all submitted reports to perform in-memory lookup for optimal performance
    const submittedReports = await CashSummaryReport.find({ submitted: true }, { site: 1, date: 1 }).lean()

    // Build a Set of "site|YYYY-MM-DD" keys for quick O(1) matching
    const submittedReportKeys = new Set(
      submittedReports.map((r) => {
        const dateStr = normalizeToStartOfDay(r.date).toISOString().split('T')[0]
        return `${r.site}|${dateStr}`
      })
    )

    const bulkOps = []
    let autoReviewedCount = 0
    let reportReviewedCount = 0
    let unreviewedCount = 0

    for (const shift of pendingShifts) {
      let targetReviewedValue = false

      // Rule 1: If canadian_cash_collected is present and not null/undefined
      if (shift.canadian_cash_collected !== undefined && shift.canadian_cash_collected !== null) {
        targetReviewedValue = true
        autoReviewedCount++
      } else {
        // Rule 2: Check if corresponding CashSummaryReport exists for site + date and is submitted
        const shiftDateStr = normalizeToStartOfDay(shift.date).toISOString().split('T')[0]
        const lookupKey = `${shift.site}|${shiftDateStr}`

        if (submittedReportKeys.has(lookupKey)) {
          targetReviewedValue = true
          reportReviewedCount++
        } else {
          // Rule 3: Missing cash collected AND no submitted report
          targetReviewedValue = false
          unreviewedCount++
        }
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: shift._id },
          update: { $set: { reviewed: targetReviewedValue } },
        },
      })
    }

    // 3. Execute bulk update in batches of 500
    if (bulkOps.length > 0) {
      const batchSize = 500
      for (let i = 0; i < bulkOps.length; i += batchSize) {
        const batch = bulkOps.slice(i, i + batchSize)
        await CashSummary.bulkWrite(batch)
      }
    }

    console.log('--- Migration Summary ---')
    console.log(`Total shifts updated: ${bulkOps.length}`)
    console.log(`- Set reviewed=true (via canadian_cash_collected): ${autoReviewedCount}`)
    console.log(`- Set reviewed=true (via submitted report match): ${reportReviewedCount}`)
    console.log(`- Set reviewed=false (no cash & no submitted report): ${unreviewedCount}`)
  } catch (err) {
    console.error('Error during backfill script execution:', err)
    throw err
  }
}

async function run() {
  let hadError = false
  try {
    await connectDB()
    await backfillReviewedStatus()
  } catch (err) {
    hadError = true
    console.error('Script failed:', err)
  } finally {
    try {
      await mongoose.disconnect()
      console.log('Mongo disconnected.')
    } catch (e) {}
    process.exit(hadError ? 1 : 0)
  }
}

if (require.main === module) run()