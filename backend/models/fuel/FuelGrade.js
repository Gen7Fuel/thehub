const mongoose = require('mongoose');

const fuelGradeSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, maxlength: 80, immutable: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  shortName: { type: String, required: true, trim: true, maxlength: 16 },
  color: { type: String, required: true, match: /^#[0-9a-f]{6}$/i },
  sortOrder: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  active: { type: Boolean, required: true, default: true },
  cstoreFuelTypes: {
    type: [{
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 64,
      validate: {
        validator: code => Boolean(code) && code !== 'MID',
        message: 'Enter a CStore fuel type code. MID is reserved for the Regular/Premium split.',
      },
    }],
    default: undefined,
    validate: {
      validator: codes => new Set(codes).size === codes.length,
      message: 'CStore fuel type codes must be distinct.',
    },
  },
}, {
  timestamps: true,
  collation: { locale: 'en', strength: 2 },
});

fuelGradeSchema.index({ cstoreFuelTypes: 1 }, {
  unique: true,
  partialFilterExpression: { 'cstoreFuelTypes.0': { $exists: true } },
});

module.exports = mongoose.model('FuelGrade', fuelGradeSchema);
