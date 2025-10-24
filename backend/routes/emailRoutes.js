const express = require('express');
const router = express.Router();
const { emailQueue } = require('../queues/emailQueue');
// const { sendEmail, sendBulkEmail } = require('../utils/emailService');

// Send single email
router.post('/send-email', async (req, res) => {
  try {
    const { to, subject, text, html, cc } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'Recipient and subject are required' });
    }

    // const result = await sendEmail({ to, subject, text, html, cc });
    // res.json(result);
    const job = await emailQueue.add("sendOrderrecEmail", { to, subject, text, html, cc });

    res.json({
      message: "Email queued successfully",
      jobId: job.id,
      jobName: "sendOrderrecEmail"
    });
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