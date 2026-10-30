function normalizeClientIp(value) {
  if (!value) return undefined;
  let ip = String(value).trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip || undefined;
}

function getClientIp(req) {
  return normalizeClientIp(req.ip || req.socket?.remoteAddress);
}

module.exports = { getClientIp, normalizeClientIp };
