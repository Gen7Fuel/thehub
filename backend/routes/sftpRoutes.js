const express = require('express');
const { withSftp } = require('../utils/sftp')
const { parseSftReport } = require('../utils/parseSftReport')
const { getSftpConfig } = require('../config/sftpConfig')

const router = express.Router();

router.get('/receive', async (req, res) => {
  const { site } = req.query
  const type = (req.query.type || 'sft').toString().toLowerCase()
  const extNoDot = type === 'br' ? 'br' : 'sft'
  const ext = `.${extNoDot}`

  if (!getSftpConfig(site)) {
    return res.status(400).json({ error: `No SFTP credentials configured for site: ${site || '(missing)'}` })
  }

  try {
    const files = await withSftp(site, async (sftp) => {
      const remoteDir = '/receive'
      const list = await sftp.list(remoteDir)

      return list
        .filter((f) => typeof f.name === 'string' && f.name.toLowerCase().endsWith(ext))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
        .map((f) => ({
          name: f.name,
          size: f.size,
          modifyTime: f.modifyTime,
          accessTime: f.accessTime,
          type: f.type,
          path: `${remoteDir}/${f.name}`,
        }))
    })

    res.json({ files })
  } catch (err) {
    console.error('SFTP list error:', err)
    res.status(500).json({ error: 'Failed to list files' })
  }
})

router.get('/receive/:shift', async (req, res) => {
  const { site } = req.query
  const type = (req.query.type || 'sft').toString().toLowerCase()
  const extNoDot = type === 'br' ? 'br' : 'sft'
  const ext = `.${extNoDot}`

  if (!getSftpConfig(site)) {
    return res.status(400).json({ error: `No SFTP credentials configured for site: ${site || '(missing)'}` })
  }

  const { shift } = req.params
  if (!/^\d+$/.test(shift)) {
    return res.status(400).json({ error: 'Invalid shift' })
  }

  try {
    const result = await withSftp(site, async (sftp) => {
      const remoteDir = '/receive'
      const list = await sftp.list(remoteDir)

      const target = list.find(
        (f) =>
          typeof f.name === 'string' &&
          f.name.toLowerCase().endsWith(ext) &&
          new RegExp(`\\b${shift}\\.${extNoDot}$`, 'i').test(f.name)
      )

      if (!target) return { status: 404 }

      const remotePath = `${remoteDir}/${target.name}`
      const fileBuf = await sftp.get(remotePath)
      const content = fileBuf.toString('utf8')

      // Only SFT parsed for now; BR returns raw content without metrics
      const metrics = extNoDot === 'sft' ? parseSftReport(content) : null

      return {
        status: 200,
        data: { shift, name: target.name, content, metrics, type: extNoDot },
      }
    })

    if (result.status === 404) return res.status(404).json({ error: 'Shift file not found' })
    res.json(result.data)
  } catch (err) {
    console.error('SFTP read error:', err)
    res.status(500).json({ error: 'Failed to read file' })
  }
})

module.exports = router;