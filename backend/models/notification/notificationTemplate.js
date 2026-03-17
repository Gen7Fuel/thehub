const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., "New Feature Update"
  slug: { type: String, required: true, unique: true }, // e.g., "new-feature"
  description: String,
  // This array tells the Admin Panel what form fields to show
  fields: [{
    key: String,       // e.g., "feature_name"
    label: String,     // e.g., "Name of the Feature"
    fieldType: String, // e.g., "text", "textarea", "date", "url"
    required: { type: Boolean, default: false }
  }],
  type: { 
    type: String,
    enum: ['system', 'custom'],
    default: 'system'
  },
  // The raw HTML/Markdown with placeholders like {{feature_name}}
  contentLayout: { type: String, required: true }
}, { timestamps: true });

// module.exports = mongoose.models.NotificationTemplate || mongoose.model('NotificationTemplate', notificationTemplateSchema);

let NotificationTemplate;
try {
  NotificationTemplate = mongoose.model("NotificationTemplate");
} catch (error) {
  NotificationTemplate = mongoose.model("NotificationTemplate", notificationTemplateSchema);
}

module.exports = NotificationTemplate;