const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SalesSummarySchema = new Schema({
  date: {
    type: Date,
    required: true
  },
  stationNumber: {
    type: String,
    required: true
  },
  fuel_sales: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  totals: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  credit_debit: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  house_account: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  cash: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  coupons: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  food_stamps: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
});

module.exports = mongoose.model('SalesSummary', SalesSummarySchema);