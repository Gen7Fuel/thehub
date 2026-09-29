// NOTE: backend/models is bind-mounted into the auth-backend container, which
// runs a different Mongoose major with its own node_modules. Keep this file's
// requires limited to mongoose and avoid callback-style middleware.
const mongoose = require('mongoose')

/**
 * PlanogramItemSchema
 * One product position from the uploaded planogram sheet.
 */
const PlanogramItemSchema = new mongoose.Schema(
  {
    gtin: { type: String, required: true },  // canonical GTIN-14, zero-padded
    name: { type: String, default: '' },     // product name as it appears in the sheet
    fixture: { type: String, default: '' },  // e.g. "Shelf 74"
    bay: { type: String, default: '' },
    sheet: { type: String, default: '' },    // source sheet, for tracing bad uploads
  },
  { _id: false } // these are lookup rows, not addressable documents
)

/**
 * PlanogramSchema
 * One document per site. Storing the whole planogram in a single document makes
 * a re-upload a single atomic $set — a delete-then-insert of per-item documents
 * could leave a site half-populated if it failed midway.
 */
const PlanogramSchema = new mongoose.Schema(
  {
    site: { type: String, required: true, trim: true },
    items: { type: [PlanogramItemSchema], default: [] },
    gtinCount: { type: Number, default: 0 },
    sourceFilename: { type: String, default: '' },
    sheetNames: { type: [String], default: [] },
    uploadedBy: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Declared here only — adding `unique: true` to the field as well would make
// Mongoose warn about a duplicate index.
PlanogramSchema.index({ site: 1 }, { unique: true })

module.exports = mongoose.model('Planogram', PlanogramSchema)
