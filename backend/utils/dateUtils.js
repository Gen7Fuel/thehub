export function dateFromYMDLocal(ymd, h = 23, m = 59, s = 59, ms = 999) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return null
  const [yy, mm, dd] = String(ymd).split('-').map(Number)
  return new Date(yy, mm - 1, dd, h, m, s, ms)
}