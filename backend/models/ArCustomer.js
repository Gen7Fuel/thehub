const mongoose = require('mongoose')

const ArCustomerSchema = new mongoose.Schema({
  customerId:  { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  creditLimit: { type: Number, default: null },
  phone:       { type: String, default: '' },
  email:       { type: String, default: '' },
  notes:       { type: String, default: '' },
  // This customer's own dedicated fleet card number, populated into the PO
  // form's Fleet Card Number field on quick-select tap. Optional.
  fleetCardNumber: { type: String, trim: true, unique: true, sparse: true },
  quickSelectSites: [{
    stationName: { type: String, required: true, trim: true },
    site:        { type: String }, // Additive alias of stationName, auto-synced
    order:       { type: Number, default: 0 },
    _id: false,
  }],
}, { timestamps: true })

ArCustomerSchema.index({ 'quickSelectSites.stationName': 1 })

// quickSelectSites is an array of subdocuments, so the shared
// attachSiteAlias helper (which targets a single top-level field) doesn't
// apply directly — mirror its stationName -> site sync, and its
// override-protection, per element instead.
//
// Note: this uses isDirectModified(), not isModified(). Because the whole
// quickSelectSites array is replaced on every write, isModified('site') on
// an entry is always true (it cascades from the modified parent array path),
// which would make every entry look like an "explicit override" and break
// the default auto-sync. isDirectModified() only reports true when `site`
// itself was set on that entry, which is what we actually want to detect.
ArCustomerSchema.pre('validate', function (next) {
  if (Array.isArray(this.quickSelectSites)) {
    this.quickSelectSites.forEach((entry) => {
      const legacyVal = entry.stationName;
      if (legacyVal !== undefined && legacyVal !== null) {
        const explicitlyDifferent = entry.isDirectModified('site') && entry.site !== legacyVal;
        if (!explicitlyDifferent) entry.site = legacyVal;
      }
    });
  }
  next();
});

module.exports = mongoose.model('ArCustomer', ArCustomerSchema)
