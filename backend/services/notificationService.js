const Notification = require("../models/notification/notification");
const NotificationTemplate = require("../models/notification/notificationTemplate");
const User = require("../models/User");
const { emailQueue } = require("../queues/emailQueue");
require('dotenv').config();

/**
 * Core Service to push notifications using Slugs and Templates
 */
async function pushNotification({
  io,
  senderId = null, // Optional: Who is sending this notification (Admin/User ID)
  recipientEmails,
  bccEmails = [], // Optional BCC list
  slug,          // Template slug (e.g., 'issue-raised')
  fieldValues,   // Object containing values for the template fields
  subject,       // The title to show in the Hub/Email subject
  type = 'system'
}) {
  // Filter(Boolean) removes nulls/undefined; Set removes duplicates
  // Normalize all lists
  const cleanToCC = (recipientEmails || []).map(e => e?.toLowerCase().trim()).filter(Boolean);
  const cleanBCC = (bccEmails || []).map(e => e?.toLowerCase().trim()).filter(Boolean);

  // Combine ALL for the Hub Database & Socket (Total Audience)
  const allUniqueEmails = Array.from(new Set([...cleanToCC, ...cleanBCC]));

  if (allUniqueEmails.length === 0) {
    console.warn("No recipients provided. Aborting.");
    return null;
  }
  try {
    // 1. Fetch the Template from DB
    const template = await NotificationTemplate.findOne({ slug });
    if (!template) {
      throw new Error(`Notification template with slug "${slug}" not found.`);
    }

    // 2. Find Users based on emails
    const recipients = await User.find({ email: { $in: allUniqueEmails } }).select('_id email');
    const recipientIds = recipients.map(u => u._id);

    if (recipientIds.length === 0) {
      console.warn("No valid users found for provided emails. Skipping DB save.");
    }

    // 2. Save to DB & Trigger Socket
    let newNotification = null;
    if (recipientIds.length > 0) {
      newNotification = await Notification.create({
        templateId: template._id,
        senderId,
        recipientIds,
        subject,
        fieldValues,
        notificationType: type,
        status: 'sent'
      });

      // 4. Trigger Real-time Socket (Smart Popup)
      // 4. Trigger Real-time Socket (Smart Popup)
      if (io && newNotification) {
        recipientIds.forEach(id => {
          // Send the actual notification object instead of just a ping
          io.to(id.toString()).emit("new-notification", {
            notification: newNotification
          });
        });
      }
    }

    // 5. Queue the Lightweight "Call to Action" Email
    const alertHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; background-color: #f4f7f9;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-top: 6px solid #1976d2;">
          <div style="padding: 30px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 20px;">🔔</div>
            <h2 style="color: #333; margin: 0 0 10px 0;">New Hub Notification</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5;">
              A new update is available on the Hub: <br>
              <strong style="color: #1976d2;">${subject}</strong>
            </p>
            <div style="margin-top: 30px;">
              <a href="https://app.gen7fuel.com/notification" 
                 style="background-color: #1976d2; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                 View Details in Notification Center
              </a>
            </div>
          </div>
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
             <p style="margin: 0; color: #999; font-size: 12px;">This is an automated security alert from Gen7 Fuel Hub.</p>
          </div>
        </div>
      </div>
    `;

    // Push to the existing BullMQ emailQueue
    await emailQueue.add("sendUpdateEmail", {
      to: cleanToCC[0] || cleanBCC[0], // Primary recipient
      cc: cleanToCC.slice(1),          // Public CCs
      bcc: cleanBCC,                   // 🧩 Mass BCC list
      subject: `Hub Update: ${subject}`,
      html: alertHtml,
      text: `New Hub Notification: ${subject}. Login at https://app.gen7fuel.com/notification to view.`
    });

    return newNotification;

  } catch (error) {
    console.error("Notification Service Error:", error);
    throw error;
  }
}

module.exports = { pushNotification };