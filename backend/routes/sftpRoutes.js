const express = require('express')

const router = express.Router()

// Office API base (server-to-server HTTP)
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

module.exports = router