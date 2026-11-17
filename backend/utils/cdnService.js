const DEFAULT_CDN_SERVICE_URL = 'http://cdn:5001';

// Transport only: never use this setting to generate public links stored in
// documents or sent to users. The optional fallback preserves legacy report URLs.
function cdnServiceBaseUrl(fallback = DEFAULT_CDN_SERVICE_URL) {
  const base = (process.env.CDN_SERVICE_URL || fallback).trim().replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error('CDN service URL must be an absolute HTTP(S) URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('CDN service URL must use HTTP(S) without credentials, query or fragment');
  }
  return base;
}

function cdnServiceUrl(path) {
  return `${cdnServiceBaseUrl()}/cdn/${path}`;
}

module.exports = { cdnServiceBaseUrl, cdnServiceUrl };
