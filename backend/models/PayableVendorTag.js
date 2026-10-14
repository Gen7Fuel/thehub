const mongoose = require('mongoose');

/**
 * PayableVendorTag
 * Links a free-text payable vendor name to its Sage Intacct vendor, so every
 * payable entered under that name can be matched to Intacct. Tags are global
 * (one per name, across all sites); names are matched ignoring case and extra
 * whitespace, so "Global  Payments" and "global payments" share one tag.
 */
const payableVendorTagSchema = new mongoose.Schema(
  {
    nameKey: { type: String, required: true, unique: true }, // normalized vendor name
    vendorName: { type: String, required: true, trim: true }, // name as first tagged, for display
    sageVendorId: { type: String, required: true, trim: true }, // e.g. "V00041"
    sageVendorName: { type: String, required: true, trim: true }, // Intacct vendor name at tag time
    taggedBy: { type: String, default: '' }, // email of the user who last set the tag
  },
  { timestamps: true }
);

payableVendorTagSchema.statics.normalizeName = function (name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
};

module.exports = mongoose.model('PayableVendorTag', payableVendorTagSchema);
