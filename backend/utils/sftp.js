const SftpClient = require('ssh2-sftp-client')
const { getSftpConfig } = require('../config/sftpConfig')

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function withSftp(site, fn, attempts = 3) {
  const cfg = getSftpConfig(site)
  if (!cfg) throw new Error(`Missing SFTP config for site: ${site || 'default'}`)

  let lastErr
  for (let i = 0; i < attempts; i++) {
    const sftp = new SftpClient()
    try {
      await sftp.connect(cfg)
      const result = await fn(sftp)
      await sftp.end().catch(() => {})
      return result
    } catch (err) {
      lastErr = err
      await sftp.end().catch(() => {})
      if (i < attempts - 1) await delay(200 * Math.pow(2, i)) // 200ms, 400ms
    }
  }
  throw lastErr
}

module.exports = { withSftp }