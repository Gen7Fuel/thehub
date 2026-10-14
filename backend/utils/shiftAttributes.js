// Validation + BSON type-casting for ad-hoc, typed "custom attributes" that
// can be attached to a CashSummary document without being part of its fixed
// schema — see routes/cashSummaryNewRoutes.js, PUT/DELETE /:id/attributes/:name.
//
// These are written via the raw driver collection (Model.collection),
// bypassing Mongoose casting/strict-mode entirely, so the schema itself stays
// untouched and every other route's validation is unaffected. The reserved-
// name check here is the only thing standing between a mistyped attribute
// name and silently clobbering data the SFT cron, reports, or Hub's own UI
// depend on — it must run before every write.

const mongoose = require('mongoose')

const EXTRA_RESERVED_NAMES = [
  'id', 'save', 'toJSON', 'toObject', 'schema', 'errors', 'isNew',
  'constructor', 'prototype', '__proto__',
]

const ATTRIBUTE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/

const ATTRIBUTE_INT32_MIN = -2147483648
const ATTRIBUTE_INT32_MAX = 2147483647

function isValidAttributeName(name) {
  return typeof name === 'string' && ATTRIBUTE_NAME_RE.test(name)
}

// Every top-level path already on the model's schema, plus a few
// Mongoose/JS-internal names — anything a custom attribute name must not
// collide with. Derived from the schema (not hand-maintained) so it can't
// drift out of sync as fields are added to the model over time.
function buildReservedAttributeNames(model) {
  const names = new Set(EXTRA_RESERVED_NAMES)
  for (const path of Object.keys(model.schema.paths)) {
    names.add(path.split('.')[0])
  }
  return names
}

// Casts a raw request value to the requested BSON-typed representation.
// Returns { value } on success or { error } on a validation failure — never
// throws, so callers can turn `error` directly into a 400 response.
function castAttributeValue(type, rawValue) {
  switch (type) {
    case 'String':
      return { value: String(rawValue) }
    case 'Int32': {
      const n = Number(rawValue)
      if (!Number.isInteger(n) || n < ATTRIBUTE_INT32_MIN || n > ATTRIBUTE_INT32_MAX) {
        return { error: 'Value is not a valid 32-bit integer' }
      }
      return { value: new mongoose.mongo.Int32(n) }
    }
    case 'Double': {
      const n = Number(rawValue)
      if (!Number.isFinite(n)) return { error: 'Value is not a valid number' }
      return { value: new mongoose.mongo.Double(n) }
    }
    case 'Boolean': {
      if (typeof rawValue === 'boolean') return { value: rawValue }
      if (rawValue === 'true') return { value: true }
      if (rawValue === 'false') return { value: false }
      return { error: 'Value is not a valid boolean' }
    }
    default:
      return { error: `Unsupported type "${type}"` }
  }
}

module.exports = {
  ATTRIBUTE_NAME_RE,
  isValidAttributeName,
  buildReservedAttributeNames,
  castAttributeValue,
}
