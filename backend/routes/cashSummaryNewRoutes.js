const express = require('express')
const CashSummary = require('../models/CashSummaryNew')
// const SftpClient = require('ssh2-sftp-client')
const { withSftp } = require('../utils/sftp')
const { getSftpConfig } = require('../config/sftpConfig')
const { parseSftReport } = require('../utils/parseSftReport')

const router = express.Router()

// SFTP config (Couchiching for now; move per-site creds to env later)
// const SFTP_CONFIG_ALL = {
//   host: process.env.SFTP_HOST || '205.211.164.97',
//   port: process.env.SFTP_PORT || '24',
//   sites: {
//     rankin: {
//         username: process.env.SFTP_RANKIN_USER || 'ind00560-bk',
//         password: process.env.SFTP_RANKIN_PASS || 'VPYTuI98Ll',
//     },
//     couchiching: {
//       username: process.env.SFTP_COUCHICHING_USER || 'ind00731-bk',
//       password: process.env.SFTP_COUCHICHING_PASS || '9d2rYetVF6',
//     },
//   }
// }

// const normalizeSiteKey = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '_')

// function getSiteSftpConfig(site) {
//   const key = normalizeSiteKey(site)
//   const creds = SFTP_CONFIG_ALL.sites[key]
//   if (!creds) return null
//   return {
//     host: SFTP_CONFIG_ALL.host,
//     port: SFTP_CONFIG_ALL.port,
//     username: creds.username,
//     password: creds.password,
//   }
// }


// Shared parser
// const { parseSftReport } = require('../utils/parseSftReport')

// Retryable per-request SFTP helper
// const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// async function withSftpForSite(site, fn, attempts = 3) {
//   const cfg = getSiteSftpConfig(site)
//   if (!cfg) throw new Error(`No SFTP credentials configured for site: ${site}`)
//   let lastErr
//   for (let i = 0; i < attempts; i++) {
//     const sftp = new SftpClient()
//     try {
//       await sftp.connect(cfg)
//       const result = await fn(sftp)
//       await sftp.end().catch(() => {})
//       return result
//     } catch (err) {
//       lastErr = err
//       await sftp.end().catch(() => {})
//       if (i < attempts - 1) await delay(200 * Math.pow(2, i))
//     }
//   }
//   throw lastErr
// }

router.post('/', async (req, res) => {
  try {
    const {
      site,
      shift_number,
      date,
      canadian_cash_collected,
      item_sales,
      cash_back,
      loyalty,
      cpl_bulloch,
      exempted_tax,
    } = req.body || {}

    if (!shift_number) return res.status(400).json({ error: 'shift_number is required' })
    if (!date) return res.status(400).json({ error: 'date is required' })

    let values = {
      canadian_cash_collected: norm(canadian_cash_collected),
      item_sales: norm(item_sales),
      cash_back: norm(cash_back),
      loyalty: norm(loyalty),
      cpl_bulloch: norm(cpl_bulloch),
      report_canadian_cash: undefined,
    }

    // Enrich from SFTP if the selected site has credentials configured
    if (site && getSftpConfig(site)) {
      try {
        const { parsed } = await withSftp(site, async (sftp) => {
          const remoteDir = '/receive'
          const list = await sftp.list(remoteDir)
          const target = list.find(
            (f) =>
              typeof f.name === 'string' &&
              f.name.toLowerCase().endsWith('.sft') &&
              new RegExp(`\\b${shift_number}\\.sft$`).test(f.name)
          )
          if (!target) return { parsed: null }

          const remotePath = `${remoteDir}/${target.name}`
          const buf = await sftp.get(remotePath)
          const content = buf.toString('utf8').replace(/^\uFEFF/, '')
          const metrics = parseSftReport(content)
          return { parsed: metrics }
        })

        if (parsed) {
          values = {
            canadian_cash_collected: values.canadian_cash_collected, // do NOT overwrite user counted
            item_sales: parsed.itemSales ?? values.item_sales,
            cash_back: parsed.cashBack ?? values.cash_back,
            loyalty: parsed.couponsAccepted ?? values.loyalty,
            cpl_bulloch: parsed.fuelPriceOverrides ?? values.cpl_bulloch,
            report_canadian_cash: parsed.canadianCash ?? values.report_canadian_cash,
          }
        }
      } catch (e) {
        console.warn(`SFTP enrichment skipped for site ${site}:`, e?.message || e)
      }
    }

    const doc = new CashSummary({
      site,
      shift_number: String(shift_number),
      date: new Date(date),
      canadian_cash_collected: values.canadian_cash_collected,
      item_sales: values.item_sales,
      cash_back: values.cash_back,
      loyalty: values.loyalty,
      cpl_bulloch: values.cpl_bulloch,
      report_canadian_cash: values.report_canadian_cash,
      exempted_tax: norm(exempted_tax),
    })

    const saved = await doc.save()
    res.status(201).json(saved)
  } catch (err) {
    console.error('CashSummary create error:', err)
    res.status(500).json({ error: 'Failed to save CashSummary' })
  }
})

// router.post('/', async (req, res) => {
//   try {
//     const {
//       site,
//       shift_number,
//       date,
//       canadian_cash_collected,
//       item_sales,
//       cash_back,
//       loyalty,
//       cpl_bulloch,
//       exempted_tax,
//     } = req.body || {}

//     if (!shift_number) return res.status(400).json({ error: 'shift_number is required' })
//     if (!date) return res.status(400).json({ error: 'date is required' })

//     // Default values from request (will be overridden by SFTP for Couchiching when available)
//     let values = {
//       canadian_cash_collected: norm(canadian_cash_collected),
//       item_sales: norm(item_sales),
//       cash_back: norm(cash_back),
//       loyalty: norm(loyalty),
//       cpl_bulloch: norm(cpl_bulloch),
//     }

//     if (site && getSiteSftpConfig(site)) {
//       try {
//         const { parsed } = await withSftpForSite(site, async (sftp) => {
//         const remoteDir = '/receive'
//         const list = await sftp.list(remoteDir)
//         const target = list.find(
//           (f) =>
//           typeof f.name === 'string' &&
//           f.name.toLowerCase().endsWith('.sft') &&
//           new RegExp(`\\b${shift_number}\\.sft$`).test(f.name)
//         )
//         if (!target) return { parsed: null }
//           const remotePath = `${remoteDir}/${target.name}`
//           const buf = await sftp.get(remotePath)
//           const content = buf.toString('utf8').replace(/^\uFEFF/, '')
//           const metrics = parseSftReport(content)
//           return { parsed: metrics }
//         })

//         if (parsed) {
//         values = {
//           canadian_cash_collected: values.canadian_cash_collected, // do NOT overwrite
//           item_sales: parsed.itemSales ?? values.item_sales,
//           cash_back: parsed.cashBack ?? values.cash_back,
//           loyalty: parsed.couponsAccepted ?? values.loyalty,
//           cpl_bulloch: parsed.fuelPriceOverrides ?? values.cpl_bulloch,
//           report_canadian_cash: parsed.canadianCash ?? values.report_canadian_cash,
//         }
//       }
//       } catch (e) {
//           console.warn(`SFTP enrichment skipped for site ${site}:`, e?.message || e)
//       }
//     }
//     // Only fetch from SFTP for Couchiching; later this can be extended per site
//     // if (site && String(site).toLowerCase() === 'couchiching') {
//     //   try {
//     //     const { parsed } = await withSftp(async (sftp) => {
//     //       const remoteDir = '/receive'
//     //       const list = await sftp.list(remoteDir)
//     //       const target = list.find(
//     //         (f) =>
//     //           typeof f.name === 'string' &&
//     //           f.name.toLowerCase().endsWith('.sft') &&
//     //           new RegExp(`\\b${shift_number}\\.sft$`).test(f.name)
//     //       )
//     //       if (!target) {
//     //         return { parsed: null }
//     //       }
//     //       const remotePath = `${remoteDir}/${target.name}`
//     //       const buf = await sftp.get(remotePath)
//     //       const content = buf.toString('utf8')
//     //       const metrics = parseSftReport(content)
//     //       return { parsed: metrics }
//     //     })

//     //     if (parsed) {
//     //       // Map parsed metrics to model fields
//     //       // IMPORTANT: Do NOT overwrite canadian_cash_collected with report's Canadian Cash
//     //       values = {
//     //         canadian_cash_collected: values.canadian_cash_collected,
//     //         item_sales: parsed.itemSales ?? values.item_sales,
//     //         cash_back: parsed.cashBack ?? values.cash_back,
//     //         // coupons_accepted -> loyalty
//     //         loyalty: parsed.couponsAccepted ?? values.loyalty,
//     //         // fuel_price_overrides -> cpl_bulloch
//     //         cpl_bulloch: parsed.fuelPriceOverrides ?? values.cpl_bulloch,
//     //       }
//     //       // Persist report Canadian Cash separately
//     //       values.report_canadian_cash = parsed.canadianCash ?? undefined
//     //     }
//     //   } catch (e) {
//     //     // Do not block create if SFTP fails; just log
//     //     console.warn('SFTP enrichment skipped:', e?.message || e)
//     //   }
//     // }

//     const doc = new CashSummary({
//       site,
//       shift_number: String(shift_number),
//       date: new Date(date),
//       canadian_cash_collected: values.canadian_cash_collected,
//       item_sales: values.item_sales,
//       cash_back: values.cash_back,
//       loyalty: values.loyalty,
//       cpl_bulloch: values.cpl_bulloch,
//       report_canadian_cash: values.report_canadian_cash,
//       exempted_tax: norm(exempted_tax),
//     })

//     const saved = await doc.save()
//     res.status(201).json(saved)
//   } catch (err) {
//     console.error('CashSummary create error:', err)
//     res.status(500).json({ error: 'Failed to save CashSummary' })
//   }
// })

function norm(v) {
  if (v === '' || v == null) return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}

router.get('/', async (req, res) => {
  try {
    const { site } = req.query
    if (!site) {
      return res.status(400).json({ error: 'site query parameter is required' })
    }

    const docs = await CashSummary
      .find({ site })
      .sort({ date: -1, createdAt: -1 })
      .lean()

    res.json(docs)
  } catch (err) {
    console.error('CashSummary list error:', err)
    res.status(500).json({ error: 'Failed to fetch CashSummary list' })
  }
})

router.get('/report', async (req, res) => {
  try {
    const { site, date } = req.query
    if (!site) return res.status(400).json({ error: 'site is required' })
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ error: 'date (YYYY-MM-DD) is required' })
    }

    const [yy, mm, dd] = String(date).split('-').map(Number)
    const start = new Date(yy, mm - 1, dd, 0, 0, 0, 0) // local midnight
    const end = new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0)

    const rows = await CashSummary.find({
      site,
      date: { $gte: start, $lt: end },
    })
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
    }

    res.json({ site, date, rows, totals })
  } catch (err) {
    console.error('CashSummary report error:', err)
    res.status(500).json({ error: 'Failed to fetch report' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const doc = await CashSummary.findById(req.params.id).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(doc)
  } catch (err) {
    console.error('CashSummary get error:', err)
    res.status(500).json({ error: 'Failed to fetch CashSummary' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const {
      site,
      shift_number,
      date,
      canadian_cash_collected,
      item_sales,
      cash_back,
      loyalty,
      cpl_bulloch,
      exempted_tax,
      report_canadian_cash,
    } = req.body || {}

    if (!shift_number) return res.status(400).json({ error: 'shift_number is required' })
    if (!date) return res.status(400).json({ error: 'date is required' })

    const updated = await CashSummary.findByIdAndUpdate(
      req.params.id,
      {
        site,
        shift_number: String(shift_number),
        date: new Date(date),
        canadian_cash_collected: norm(canadian_cash_collected),
        item_sales: norm(item_sales),
        cash_back: norm(cash_back),
        loyalty: norm(loyalty),
        cpl_bulloch: norm(cpl_bulloch),
        exempted_tax: norm(exempted_tax),
        report_canadian_cash: norm(report_canadian_cash),
      },
      { new: true, runValidators: true }
    ).lean()

    if (!updated) return res.status(404).json({ error: 'Not found' })
    res.json(updated)
  } catch (err) {
    console.error('CashSummary update error:', err)
    res.status(500).json({ error: 'Failed to update CashSummary' })
  }
})



module.exports = router