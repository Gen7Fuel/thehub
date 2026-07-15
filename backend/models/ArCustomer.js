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
// apply directly — mirror stationName -> site per element instead.
ArCustomerSchema.pre('validate', function (next) {
  if (Array.isArray(this.quickSelectSites)) {
    this.quickSelectSites.forEach((entry) => {
      if (entry.stationName != null && entry.site !== entry.stationName) {
        entry.site = entry.stationName;
      }
    });
  }
  next();
});

module.exports = mongoose.model('ArCustomer', ArCustomerSchema)
