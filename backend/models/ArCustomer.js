const mongoose = require('mongoose')

const ArCustomerSchema = new mongoose.Schema({
  customerId:  { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  creditLimit: { type: Number, default: null },
  phone:       { type: String, default: '' },
  email:       { type: String, default: '' },
  notes:       { type: String, default: '' },
}, { timestamps: true })

module.exports = mongoose.model('ArCustomer', ArCustomerSchema)
