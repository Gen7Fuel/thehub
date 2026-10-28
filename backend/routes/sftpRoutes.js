const express = require('express')
const moment = require('moment-timezone')
const Location = require('../models/Location')

const router = express.Router()

// Office API base (server-to-server HTTP)
// const OFFICE_SFTP_API_BASE = 'http://24.141.32.206:5002'
const OFFICE_SFTP_API_BASE = 'http://24.50.55.130:5000'

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

/**
 * Extract the shift date and number from an SFT filename.
 * Example: SFT 202602181530 00000000000 0000021678.sft
 */
function parseSftFilename(filename) {
  if (typeof filename !== 'string') return null

  const dateMatch = filename.match(/\s(\d{12})\s/)
  const shiftMatch = filename.match(/(\d+)\.sft$/i)
  if (!dateMatch || !shiftMatch) return null

  const timestamp = dateMatch[1]
  return {
    date: `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`,
    shiftNumber: shiftMatch[1],
  }
}

/**
 * GET /api/sftp/shift-summary
 *
 * Returns the SFT shifts available for every store for today and the
 * preceding four calendar days. File contents are intentionally not fetched.
 */
router.get('/shift-summary', async (_req, res) => {
  try {
    const locations = await Location.find({ type: 'store' }, 'stationName timezone').lean()
    const cutoff = moment().tz('America/Toronto').subtract(4, 'days').startOf('day')
    const today = moment().tz('America/Toronto').endOf('day')
    const summary = {}
    const failures = []

    for (const location of locations) {
      if (!location.stationName) continue

      try {
        const listUrl = new URL('/api/sftp/receive', OFFICE_SFTP_API_BASE)
        listUrl.searchParams.set('site', location.stationName)
        listUrl.searchParams.set('type', 'sft')

        const listResp = await fetchWithTimeout(listUrl.toString())
        if (!listResp.ok) {
          throw new Error(`SFTP list returned HTTP ${listResp.status}`)
        }

        const payload = await listResp.json()
        const files = Array.isArray(payload?.files) ? payload.files : []

        for (const file of files) {
          const parsed = parseSftFilename(file?.name)
          if (!parsed) continue

          const fileDate = moment.tz(parsed.date, 'YYYY-MM-DD', 'America/Toronto')
          if (fileDate.isBefore(cutoff) || fileDate.isAfter(today)) continue

          const stationSummary = summary[parsed.date] || (summary[parsed.date] = {})
          const siteSummary = stationSummary[location.stationName] || (stationSummary[location.stationName] = {
            count: 0,
            shiftNumbers: [],
          })

          if (!siteSummary.shiftNumbers.includes(parsed.shiftNumber)) {
            siteSummary.shiftNumbers.push(parsed.shiftNumber)
            siteSummary.count += 1
          }
        }
      } catch (siteError) {
        const message = siteError?.message || String(siteError)
        failures.push({ site: location.stationName, error: message })
        console.error(`[SFTP Shift Summary] Failed for site "${location.stationName}": ${message}`)
      }
    }

    if (failures.length > 0 && Object.keys(summary).length === 0) {
      return res.status(502).json({
        error: 'Failed to fetch SFTP shift summary',
        failures,
      })
    }

    return res.json(summary)
  } catch (err) {
    console.error('SFTP shift summary error:', err?.message || err)
    return res.status(502).json({ error: 'Failed to build SFTP shift summary' })
  }
})

// Proxy: GET /api/sftp/receive?site=...&type=sft|br
router.get('/receive', async (req, res) => {
  try {
    const url = new URL('/api/sftp/receive', OFFICE_SFTP_API_BASE)
    for (const [k, v] of Object.entries(req.query || {})) {
      if (v != null) url.searchParams.set(k, String(v))
    }

    const resp = await fetchWithTimeout(url.toString())
    const text = await resp.text()
    res.status(resp.status).type(resp.headers.get('content-type') || 'application/json')
    try {
      res.send(JSON.parse(text))
    } catch {
      res.send(text)
    }
  } catch (err) {
    console.error('SFTP proxy list error:', err?.message || err)
    res.status(502).json({ error: 'Failed to reach office SFTP API' })
  }
})

// Proxy: GET /api/sftp/receive/:shift?site=...&type=sft|br
router.get('/receive/:shift', async (req, res) => {
  const { shift } = req.params
  if (!/^\d+$/.test(shift)) return res.status(400).json({ error: 'Invalid shift' })

  try {
    const url = new URL(`/api/sftp/receive/${encodeURIComponent(shift)}`, OFFICE_SFTP_API_BASE)
    for (const [k, v] of Object.entries(req.query || {})) {
      if (v != null) url.searchParams.set(k, String(v))
    }

    const resp = await fetchWithTimeout(url.toString())
    const text = await resp.text()
    res.status(resp.status).type(resp.headers.get('content-type') || 'application/json')
    try {
      res.send(JSON.parse(text))
    } catch {
      res.send(text)
    }
  } catch (err) {
    console.error('SFTP proxy read error:', err?.message || err)
    res.status(502).json({ error: 'Failed to reach office SFTP API' })
  }
})

router.get('/check/:shift', async (req, res) => {
  const { shift } = req.params
  if (!/^\d+$/.test(shift)) return res.status(400).json({ valid: false, error: 'Invalid shift' })

  try {
    const url = new URL(`/api/sftp/check/${encodeURIComponent(shift)}`, OFFICE_SFTP_API_BASE)
    for (const [k, v] of Object.entries(req.query || {})) {
      if (v != null && v !== '') url.searchParams.set(k, String(v))
    }

    const resp = await fetchWithTimeout(url.toString())
    const text = await resp.text()
    res.status(resp.status).type(resp.headers.get('content-type') || 'application/json')
    try {
      return res.send(JSON.parse(text))
    } catch {
      return res.send(text)
    }
  } catch (err) {
    console.error('SFTP proxy check error:', err?.message || err)
    res.status(502).json({ valid: false, error: 'Failed to reach office SFTP API' })
  }
})

module.exports = router
