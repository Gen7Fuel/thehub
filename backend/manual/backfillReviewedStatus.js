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

    // 2. Fetch all existing reports (submitted or not) for in-memory lookup
    const allReports = await CashSummaryReport.find({}, { site: 1, date: 1, submitted: 1 }).lean()

    // Build Sets for quick O(1) lookups
    const submittedReportKeys = new Set()
    const allExistingReportKeys = new Set()

    for (const r of allReports) {
      const dateStr = normalizeToStartOfDay(r.date).toISOString().split('T')[0]
      const key = `${r.site}|${dateStr}`
      
      allExistingReportKeys.add(key)
      if (r.submitted) {
        submittedReportKeys.add(key)
      }
    }

    const shiftBulkOps = []
    let autoReviewedCount = 0
    let reportReviewedCount = 0
    let unreviewedCount = 0

    // Map to track unique site|date pairs where shifts were marked as reviewed
    // Key: "site|YYYY-MM-DD" -> Value: { site, startOfDay }
    const reviewedSiteDatesToEnsure = new Map()

    for (const shift of pendingShifts) {
      let targetReviewedValue = false
      const shiftStartOfDay = normalizeToStartOfDay(shift.date)
      const shiftDateStr = shiftStartOfDay.toISOString().split('T')[0]
      const lookupKey = `${shift.site}|${shiftDateStr}`

      // Rule 1: If canadian_cash_collected is present and not null/undefined
      if (shift.canadian_cash_collected !== undefined && shift.canadian_cash_collected !== null) {
        targetReviewedValue = true
        autoReviewedCount++
        
        // Track this site+date to ensure a CashSummaryReport entry exists
        reviewedSiteDatesToEnsure.set(lookupKey, {
          site: shift.site,
          date: shiftStartOfDay
        })
      } else {
        // Rule 2: Check if corresponding CashSummaryReport exists for site + date and is submitted
        if (submittedReportKeys.has(lookupKey)) {
          targetReviewedValue = true
          reportReviewedCount++

          // Track this site+date as well
          reviewedSiteDatesToEnsure.set(lookupKey, {
            site: shift.site,
            date: shiftStartOfDay
          })
        } else {
          // Rule 3: Missing cash collected AND no submitted report
          targetReviewedValue = false
          unreviewedCount++
        }
      }

      shiftBulkOps.push({
        updateOne: {
          filter: { _id: shift._id },
          update: { $set: { reviewed: targetReviewedValue } },
        },
      })
    }

    // 3. Execute bulk update on CashSummary in batches of 500
    if (shiftBulkOps.length > 0) {
      const batchSize = 500
      for (let i = 0; i < shiftBulkOps.length; i += batchSize) {
        const batch = shiftBulkOps.slice(i, i + batchSize)
        await CashSummary.bulkWrite(batch)
      }
    }

    // 4. Check for missing CashSummaryReport documents and create unsubmitted entries
    const reportBulkOps = []
    let createdUnsubmittedReportsCount = 0

    for (const [key, { site, date }] of reviewedSiteDatesToEnsure.entries()) {
      if (!allExistingReportKeys.has(key)) {
        reportBulkOps.push({
          updateOne: {
            filter: { site, date },
            update: {
              $setOnInsert: {
                site,
                date,
                submitted: false,
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        })
        createdUnsubmittedReportsCount++
      }
    }

    // 5. Execute bulk write for missing CashSummaryReports
    if (reportBulkOps.length > 0) {
      const batchSize = 500
      for (let i = 0; i < reportBulkOps.length; i += batchSize) {
        const batch = reportBulkOps.slice(i, i + batchSize)
        await CashSummaryReport.bulkWrite(batch)
      }
    }

    console.log('--- Migration Summary ---')
    console.log(`Total shifts updated: ${shiftBulkOps.length}`)
    console.log(`- Set reviewed=true (via canadian_cash_collected): ${autoReviewedCount}`)
    console.log(`- Set reviewed=true (via submitted report match): ${reportReviewedCount}`)
    console.log(`- Set reviewed=false (no cash & no submitted report): ${unreviewedCount}`)
    console.log(`- Created new unsubmitted CashSummaryReports: ${createdUnsubmittedReportsCount}`)
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