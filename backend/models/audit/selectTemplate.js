const mongoose = require('mongoose');

const SelectTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Name of the template
  description: { type: String }, // Optional description
  options: [
    {
      text: { type: String, required: true },
      email: { type: String }, // default TO (comma-separated for multiple)
      cc: { type: String }, // default CC (comma-separated for multiple)
      siteOverrides: [
        {
          site: { type: String, required: true },
          to: { type: String }, // comma-separated; blank = inherit default `email`
          cc: { type: String }, // comma-separated; blank = inherit default `cc`
          _id: false,
        }
      ],
    }
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: who created it
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SelectTemplate', SelectTemplateSchema);