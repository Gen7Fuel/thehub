const { DateTime } = require('luxon')
const Location = require('../models/Location')
const { CashSummary, CashSummaryReport } = require('../models/CashSummaryNew')

// Handle default or named ES Module export safely
const LotteryModule = require('../models/Lottery')
const Lottery = LotteryModule.default || LotteryModule.Lottery || LotteryModule

const cron = require('node-cron')
const { generateCashSummaryPdf } = require('../utils/cashSummaryPdf')
const { generateEodReportPdf } = require('../utils/eodReportWavers')
const { generateChickenDelightEodReportPdf } = require('../utils/eodCDReportWavers')
const { generateShiftReportsPdf } = require('../utils/shiftReportsPdf')
const { generateLotteryImagesPdf } = require('../utils/lotteryImagesPdf')
const {
  getDepositSlipAttachment,
  attachmentContentToBase64
} = require('../routes/cashSummaryNewRoutes')
const { emailQueue } = require('../queues/emailQueue')

const CUTOFF_DATE_STR = '2026-09-02'
const CDN_BASE_URL = process.env.CDN_BASE_URL || process.env.PUBLIC_CDN_BASE_URL || 'http://cdn:5001'
const CASH_SUMMARY_EMAILS = (process.env.CASH_SUMMARY_EMAILS || 'reports@bosservicesltd.com')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

const SITE_CC_MAP = {
  Oliver: ['ZBaptiste@oib.ca'],
  Osoyoos: ['ZBaptiste@oib.ca'],
  'Wavers West': ['office@wavers.ca'],
  'Wavers East': ['manager@boncommunitystore.ca']
}

/**
 * Normalizes a Luxon DateTime into a UTC JavaScript Date representing 00:00:00 local time
 */
const getNormalizedDate = (dt) => {
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day))
}

const autoSubmitCashSummaryReports = async () => {
  console.log('--- Starting Automated Cash Summary Submission Job ---', new Date().toISOString())

  try {
    // 1. Fetch active locations
    const locations = await Location.find({
      type: 'store'
    }).lean()

    const systemUserObjectId = null

    for (const loc of locations) {
      const { site, timezone, province, sellsLottery } = loc
      if (!timezone) continue

      const isManitoba = province === 'MB' || province === 'Manitoba'

      // Get location's local "yesterday"
      const nowLocal = DateTime.now().setZone(timezone)
      const yesterdayLocal = nowLocal.minus({ days: 1 })
      
      const cutoffDt = DateTime.fromISO(CUTOFF_DATE_STR, { zone: timezone })

      let currentDt = cutoffDt
      while (currentDt <= yesterdayLocal) {
        const dateStr = currentDt.toFormat('yyyy-MM-dd')
        const startOfDay = getNormalizedDate(currentDt)
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

        // Check if report is already submitted
        const existingReport = await CashSummaryReport.findOne({
          site,
          date: startOfDay
        }).lean()

        if (existingReport && existingReport.submitted) {
          currentDt = currentDt.plus({ days: 1 })
          continue
        }

        // 2. Fetch all shifts submitted for this site and date
        const shifts = await CashSummary.find({
          site,
          date: { $gte: startOfDay, $lte: endOfDay }
        }).lean()

        // If no shifts exist or ANY shift is NOT reviewed, skip submission
        if (!shifts.length) {
          currentDt = currentDt.plus({ days: 1 })
          continue
        }

        const allReviewed = shifts.every((shift) => shift.reviewed === true)
        if (!allReviewed) {
          console.log(`[${site}] Shifts for ${dateStr} are not all reviewed yet. Skipping submission.`)
          currentDt = currentDt.plus({ days: 1 })
          continue
        }

        // 3. Check for Lottery record matching the string YYYY-MM-DD date format
        if (sellsLottery) {
          const lotteryDoc = await Lottery.findOne({
            site,
            date: dateStr
          }).lean()

          if (!lotteryDoc) {
            console.log(`[${site}] Lottery record missing for ${dateStr}. Skipping submission.`)
            currentDt = currentDt.plus({ days: 1 })
            continue
          }
        }

        // 4. Mark the record as submitted (locks the record)
        await CashSummaryReport.findOneAndUpdate(
          { site, date: startOfDay },
          {
            $set: {
              site,
              date: startOfDay,
              submitted: true,
              submittedAt: new Date(),
              submittedBy: systemUserObjectId
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )

        console.log(`[${site}] Marked Cash Summary Report for ${dateStr} as submitted. Generating attachments...`)

        // 5. Generate attachments and queue email
        try {
          const cashSummaryPdf = await generateCashSummaryPdf({ site, date: dateStr, isManitoba })
          const shiftReportsPdf = await generateShiftReportsPdf({ site, date: dateStr })
          
          const reqMock = { protocol: 'https', get: () => CDN_BASE_URL || '' }
          const depositSlip = await getDepositSlipAttachment(reqMock, site, startOfDay, endOfDay)

          const cdnBase = (CDN_BASE_URL || '').replace(/\/$/, '')
          const lotteryImagesPdf = await generateLotteryImagesPdf({ site, date: dateStr, origin: cdnBase })

          const attachments = [
            {
              filename: `Cash-Summary-${site}-${dateStr}.pdf`,
              content: cashSummaryPdf,
              contentType: 'application/pdf'
            }
          ]

          if (lotteryImagesPdf) {
            attachments.push({
              filename: `Lottery-Datawave-Images-${site}-${dateStr}.pdf`,
              content: lotteryImagesPdf,
              contentType: 'application/pdf'
            })
          }

          if (shiftReportsPdf) {
            attachments.push({
              filename: `Shift-Reports-${site}-${dateStr}.pdf`,
              content: shiftReportsPdf,
              contentType: 'application/pdf'
            })
          }

          if (site === 'Wavers West' || site === 'Wavers East') {
            try {
              const eodWaversPdf = await generateEodReportPdf({ site, date: dateStr, isManitoba })
              attachments.push({
                filename: `End-of-Day-Report-${site}-${dateStr}.pdf`,
                content: eodWaversPdf,
                contentType: 'application/pdf'
              })
            } catch (eodErr) {
              console.error(`Failed generating Wavers EOD report for ${site}:`, eodErr.message)
            }

            if (site === 'Wavers West') {
              try {
                const eodChickenDelightPdf = await generateChickenDelightEodReportPdf({ site, date: dateStr })
                attachments.push({
                  filename: `Chicken-Delight-End-of-Day-Report-${site}-${dateStr}.pdf`,
                  content: eodChickenDelightPdf,
                  contentType: 'application/pdf'
                })
              } catch (cdErr) {
                console.error('Failed generating Chicken Delight EOD report:', cdErr.message)
              }
            }
          }

          if (depositSlip) attachments.push(depositSlip)

          let cc = ['mohammad@gen7fuel.com', 'daksh@gen7fuel.com']
          if (SITE_CC_MAP[site]) {
            cc.push(...SITE_CC_MAP[site])
          }

          const serializedAttachments = await Promise.all(
            attachments.map(async (att) => ({
              filename: att.filename,
              content: await attachmentContentToBase64(att.content),
              encoding: 'base64',
              contentType: att.contentType
            }))
          )

          await emailQueue.add('sendCashSummaryEmail', {
            to: CASH_SUMMARY_EMAILS.join(','),
            cc,
            // to: 'daksh@gen7fuel.com',
            subject: `Daily Report – ${site} – ${dateStr}`,
            text: `Attached are the Cash Summary${shiftReportsPdf ? ', Shift Reports' : ''}${depositSlip ? ' and Bank Deposit Slip' : ''} for ${site} on ${dateStr}.`,
            attachments: serializedAttachments
          })

          console.log(`Successfully queued Cash Summary email for ${site} on ${dateStr}`)
        } catch (emailErr) {
          console.error(`Error generating PDF/Email queue for ${site} on ${dateStr}:`, emailErr)
        }

        currentDt = currentDt.plus({ days: 1 })
      }
    }

    console.log('--- Automated Cash Summary Submission Job Finished ---')
  } catch (err) {
    console.error('Critical Failure in Auto Cash Summary Cron:', err)
  }
}

// Execute daily at 6:30 AM EST
cron.schedule(
  '30 6 * * *',
  () => {
    console.log('Triggering daily 6:30 AM Cash Summary auto-submit job...')
    autoSubmitCashSummaryReports()
  },
  {
    scheduled: true,
    timezone: 'America/Toronto'
  }
)

module.exports = { autoSubmitCashSummaryReports }