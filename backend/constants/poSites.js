// Sites whose PO numbers come from an externally issued book that recycles
// numbers, so the per-station PO-number uniqueness rule does not apply to them.
//
// IMPORTANT: do not require this file from backend/models/* — auth-backend
// bind-mounts backend/models without the rest of the tree, so a require of
// "../constants/..." inside a model crashes auth-backend at startup with
// MODULE_NOT_FOUND. Keep the require in routes/scripts.
const DUPLICATE_PO_ALLOWED_SITES = ['Wavers West', 'Wavers East']

const enforcesPoUniqueness = (stationName) =>
  !DUPLICATE_PO_ALLOWED_SITES.includes(String(stationName || '').trim())

module.exports = { DUPLICATE_PO_ALLOWED_SITES, enforcesPoUniqueness }
