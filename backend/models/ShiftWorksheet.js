const mongoose = require('mongoose');

const ShiftWorksheetSchema = new mongoose.Schema(
  {
    report_number: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: () => new Date(),
    },
    shift: {
      type: String,
      required: true,
      enum: ['AM', 'PM'],
    },
    shift_lead: {
      type: String,
      default: '',
    },
    till_location: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    short: {
      type: Boolean,
      default: false,
    },
    over_short_amount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    float_returned_to_bag: {
      type: Number,
      default: 0,
    },
    void_txn: {
      type: Number,
      default: 0,
    },
    abandoned_change: {
      type: Number,
      default: 0,
    },
    unsettled_prepay: {
      type: Number,
      default: 0,
    },
    shift_report_cash: {
      type: Number,
      default: 0,
    },
    drops: {
      type: [
        {
          time: {
            type: String,
            default: '00:00:00Z',
          },
          amount: {
            type: Number,
            default: 0,
          },
          initials: {
            type: String,
            default: '',
          }
        },
      ],
      default: [],
    },
    opening_float: {
      bill: {
        five: { type: Number, default: 0 },
        ten: { type: Number, default: 0 },
        twenty: { type: Number, default: 0 },
        fifty: { type: Number, default: 0 },
        hundred: { type: Number, default: 0 },
      },
      change: {
        one: { type: Number, default: 0 },
        two: { type: Number, default: 0 },
        quarter: { type: Number, default: 0 },
        dime: { type: Number, default: 0 },
        nickel: { type: Number, default: 0 },
      },
    },
    closing_float: {
      bill: {
        five: { type: Number, default: 0 },
        ten: { type: Number, default: 0 },
        twenty: { type: Number, default: 0 },
        fifty: { type: Number, default: 0 },
        hundred: { type: Number, default: 0 },
      },
      change: {
        one: { type: Number, default: 0 },
        two: { type: Number, default: 0 },
        quarter: { type: Number, default: 0 },
        dime: { type: Number, default: 0 },
        nickel: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Ensure the report_number is unique
ShiftWorksheetSchema.index({ report_number: 1, shift: 1 }, { unique: true });

module.exports = mongoose.model('ShiftWorksheet', ShiftWorksheetSchema);