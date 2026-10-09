const mongoose = require('mongoose');

/**
 * CashRecSageEntry
 * The Sage Intacct Other Receipt created for one site's cash-rec day. One per
 * site + date: its existence (or a fresh claim) blocks creating a second one,
 * and the page uses it to show "created" instead of the button.
 */
const cashRecSageEntrySchema = new mongoose.Schema(
  {
    site: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, the cash-rec day
    claimedAt: { type: Date }, // set while the Intacct call is in flight
    key: { type: String }, // Intacct other-receipt key, once created
    lineCount: { type: Number },
    total: { type: Number },
    createdBy: { type: String, default: '' }, // email of the user who clicked the button
  },
  { timestamps: true }
);

cashRecSageEntrySchema.index({ site: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CashRecSageEntry', cashRecSageEntrySchema);
