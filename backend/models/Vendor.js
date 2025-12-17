const mongoose = require('mongoose');

/**
 * StationSupplySchema
 * Represents a supply item that a vendor provides to a specific station.
 * Each supply includes a name, VIN, UPC, and size.
 */
const StationSupplySchema = new mongoose.Schema({
  name: { type: String, required: true },   // Name of the supply item
  vin: { type: String, required: true },    // Vendor Item Number
  upc: { type: String, required: true },    // Universal Product Code
  size: { type: String, required: true },   // Size or packaging information
}, { _id: false });

/**
 * VendorSchema
 * Represents a vendor/supplier in the system.
 * Stores vendor details, category, location, supplies, and order preferences.
 */
const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },   // Vendor name
  category: {
    type: String,
    // enum: ['Cannabis', 'Vape', 'Convenience', 'Tobacco', 'Native Crafts', 'Other'], // Allowed categories
    // required: true
  },
  location: { type: String, required: true }, // Associated station/location
  station_supplies: [StationSupplySchema],    // Supplies this vendor provides to stations
  email_order: { type: Boolean, default: false }, // Whether orders are placed by email
  email: { type: String },                        // Vendor's email address
  order_placement_method: {                       // Method used to place orders
    type: String,
    enum: ['Email', 'Template', 'Web Portal', 'Telephone'],
    default: 'Email'
  },
  notes: { type: String },                        // Admin/vendor notes
  vendor_order_frequency: { type: Number },       // How often orders are placed (in weeks)
  leadTime: { type: Number, default: null },     // Average lead time in days (Placed -> Delivered)
  lastPlacedOrder: { type: Date },                // Date of the last order placed
}, { timestamps: true });                         // Adds createdAt and updatedAt fields

VendorSchema.index(
  { name: 1, location: 1 }, 
  { unique: true }
);
// Create and export the Vendor model
const Vendor = mongoose.model('Vendor', VendorSchema);

module.exports = Vendor;