const mongoose = require('mongoose');

const StationSupplySchema = new mongoose.Schema({
  name: { type: String, required: true },
  vin: { type: String, required: true },
  upc: { type: String, required: true },
  size: { type: String, required: true },
}, { _id: false });

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['Cannabis', 'Vape', 'Convenience', 'Tobacco', 'Native Crafts', 'Other'],
    required: true
  },
  location: { type: String, required: true },
  station_supplies: [StationSupplySchema],
  email_order: { type: Boolean, default: false }, // 1. Email Order
  email: { type: String },                        // 2. Email
  order_placement_method: {                       // 3. Order Placement Method
    type: String,
    enum: ['Email', 'Template', 'Web Portal', 'Telephone'],
    default: 'Email'
  },
  vendor_order_frequency: { type: Number },       // 4. Vendor Order Frequency (weeks)
  last_order_date: { type: Date },                // 5. Last Order Date
}, { timestamps: true });

const Vendor = mongoose.model('Vendor', VendorSchema);

module.exports = Vendor;