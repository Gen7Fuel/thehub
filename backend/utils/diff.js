function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function sanitize(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'string' && value.length > 500) return value.slice(0, 500) + '…';
  return value;
}

function computeChanges(before = {}, after = {}, options = {}) {
  const { redact = ['password', 'token', 'authorization'] } = options;
  const keys = new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]);
  const out = {};

  for (const k of keys) {
    if (redact.includes(k)) continue;
    const b = before ? before[k] : undefined;
    const a = after ? after[k] : undefined;

    const same =
      (b === a) ||
      (isPlainObject(b) && isPlainObject(a)) ||
      (Array.isArray(b) && Array.isArray(a));

    if (!same) {
      out[k] = { from: sanitize(b), to: sanitize(a) };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

module.exports = { computeChanges };
