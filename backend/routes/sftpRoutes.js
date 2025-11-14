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
// const express = require('express');
// const { withSftp } = require('../utils/sftp')
// const { parseSftReport } = require('../utils/parseSftReport')
// const { getSftpConfig } = require('../config/sftpConfig')

// const router = express.Router();

// router.get('/receive', async (req, res) => {
//   const { site } = req.query
//   const type = (req.query.type || 'sft').toString().toLowerCase()
//   const extNoDot = type === 'br' ? 'br' : 'sft'
//   const ext = `.${extNoDot}`

//   if (!getSftpConfig(site)) {
//     return res.status(400).json({ error: `No SFTP credentials configured for site: ${site || '(missing)'}` })
//   }

//   try {
//     const files = await withSftp(site, async (sftp) => {
//       const remoteDir = '/receive'
//       const list = await sftp.list(remoteDir)

//       return list
//         .filter((f) => typeof f.name === 'string' && f.name.toLowerCase().endsWith(ext))
//         .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
//         .map((f) => ({
//           name: f.name,
//           size: f.size,
//           modifyTime: f.modifyTime,
//           accessTime: f.accessTime,
//           type: f.type,
//           path: `${remoteDir}/${f.name}`,
//         }))
//     })

//     res.json({ files })
//   } catch (err) {
//     console.error('SFTP list error:', err)
//     res.status(500).json({ error: 'Failed to list files' })
//   }
// })

// router.get('/receive/:shift', async (req, res) => {
//   const { site } = req.query
//   const type = (req.query.type || 'sft').toString().toLowerCase()
//   const extNoDot = type === 'br' ? 'br' : 'sft'
//   const ext = `.${extNoDot}`

//   if (!getSftpConfig(site)) {
//     return res.status(400).json({ error: `No SFTP credentials configured for site: ${site || '(missing)'}` })
//   }

//   const { shift } = req.params
//   if (!/^\d+$/.test(shift)) {
//     return res.status(400).json({ error: 'Invalid shift' })
//   }

//   try {
//     const result = await withSftp(site, async (sftp) => {
//       const remoteDir = '/receive'
//       const list = await sftp.list(remoteDir)

//       const target = list.find(
//         (f) =>
//           typeof f.name === 'string' &&
//           f.name.toLowerCase().endsWith(ext) &&
//           new RegExp(`\\b${shift}\\.${extNoDot}$`, 'i').test(f.name)
//       )

//       if (!target) return { status: 404 }

//       const remotePath = `${remoteDir}/${target.name}`
//       const fileBuf = await sftp.get(remotePath)
//       const content = fileBuf.toString('utf8')

//       // Only SFT parsed for now; BR returns raw content without metrics
//       const metrics = extNoDot === 'sft' ? parseSftReport(content) : null

//       return {
//         status: 200,
//         data: { shift, name: target.name, content, metrics, type: extNoDot },
//       }
//     })

//     if (result.status === 404) return res.status(404).json({ error: 'Shift file not found' })
//     res.json(result.data)
//   } catch (err) {
//     console.error('SFTP read error:', err)
//     res.status(500).json({ error: 'Failed to read file' })
//   }
// })

// module.exports = router;