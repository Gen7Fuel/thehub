const mongoose = require('mongoose');

const SelectTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the template
  description: { type: String }, // Optional description
  options: [
    {
      text: { type: String, required: true },
      email: { type: String },
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: who created it
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SelectTemplate', SelectTemplateSchema);