const express = require('express');
const router = express.Router();
const { emailQueue } = require('../queues/emailQueue');
const { pushNotification } = require('../services/notificationService');
// const { sendEmail, sendBulkEmail } = require('../utils/emailService');

// Send single email
// router.post('/send-email', async (req, res) => {
//   try {
//     const { to, subject, text, html, cc } = req.body;

//     if (!to || !subject) {
//       return res.status(400).json({ error: 'Recipient and subject are required' });
//     }

//     // const result = await sendEmail({ to, subject, text, html, cc });
//     // res.json(result);
//     const job = await emailQueue.add("sendOrderrecEmail", { to, subject, text, html, cc });

//     res.json({
//       message: "Email queued successfully",
//       jobId: job.id,
//       jobName: "sendOrderrecEmail"
//     });
//   } catch (error) {
//     console.error('Error in send-email route:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

router.post('/send-orderec-email', async (req, res) => {
  try {
    const {
      to,
      cc,
      subject,
      slug,          // New: 'order-rec-uploaded' or 'order-rec-completed'
      fieldValues,   // New: { site, vendorName, filename, orderRecId }
      type = 'system'
    } = req.body;

    // 1. Validation
    if (!to || !subject) {
      return res.status(400).json({ error: 'Recipient and subject are required' });
    }

    const io = req.app.get("io");
    const recipientEmails = Array.isArray(to) ? to : [to];
    const ccEmails = Array.isArray(cc) ? cc : (cc ? [cc] : []);
    const allRecipients = [...recipientEmails, ...ccEmails];

    // 2. Logic Branch: Use Template Service OR Fallback to raw Queue
    if (slug) {
      // Use the new Hub Notification System (DB + Socket + Email)
      const notification = await pushNotification({
        io,
        recipientEmails: allRecipients,
        slug,
        fieldValues,
        subject,
        type
      });

      return res.json({
        message: "Notification pushed and email queued successfully",
        notificationId: notification._id
      });
    } else {
      // Fallback: Just send a raw email via the queue (for legacy calls)
      const { text, html } = req.body;
      const job = await emailQueue.add("sendRawEmail", {
        to,
        subject,
        text,
        html,
        cc
      });

      return res.json({
        message: "Raw email queued successfully",
        jobId: job.id
      });
    }
  } catch (error) {
    console.error('Error in send-email route:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send bulk emails
router.post('/send-bulk-email', async (req, res) => {
  try {
    const { recipients, subject, text, html } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients array is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const results = await sendBulkEmail({ recipients, subject, text, html });
    res.json(results);
  } catch (error) {
    console.error('Error in send-bulk-email route:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;