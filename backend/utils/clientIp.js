function normalizeClientIp(value) {
  if (!value) return undefined;

  let ip = String(value).trim();
  if (!ip) return undefined;

  // Express may expose IPv4 addresses through an IPv6-mapped representation.
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);

  return ip || undefined;
}

function getClientIp(req) {
  // req.ip is resolved by Express using the configured trusted-proxy chain.
  // Do not read X-Forwarded-For directly here: direct header parsing allows a
  // client to select the address written to security logs.
  return normalizeClientIp(req.ip || req.socket?.remoteAddress);
}

module.exports = { getClientIp, normalizeClientIp };
