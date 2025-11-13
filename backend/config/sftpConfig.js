const normalizeSiteKey = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '_')

// Per-site only. If a site is not configured, return null.
function getSftpConfig(site) {
  if (!site) return null
  const key = normalizeSiteKey(site)

  const host = process.env[`SFTP_HOST`]
  const portRaw = process.env[`SFTP_PORT`]
  const username = process.env[`SFTP_${key}_USER`] || process.env[`SFTP_${key}_USERNAME`]
  const password = process.env[`SFTP_${key}_PASS`] || process.env[`SFTP_${key}_PASSWORD`]

  if (!username || !password || !host || !portRaw) {
    return null
  }

  return {
    host,
    port: Number(portRaw) || 22,
    username,
    password,
  }
}

module.exports = { getSftpConfig, normalizeSiteKey }