const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'noreply@gen7fuel.com',
    pass: process.env.NOREPLY_PASS
  },
  tls: {
    ciphers: 'SSLv3'
  }
});

/**
 * Send email function
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content (optional)
 * @param {string} html - HTML content (optional)
 * @returns {Promise} - Promise resolving to email info
 */
async function sendEmail({ to, subject, text = '', html = '', cc = [], bcc=[], attachments = [] }) {
  try {
    // Verify connection configuration
    await transporter.verify();
    console.log('SMTP server is ready to take our messages');

    const mailOptions = {
      from: '"Gen7 Fuel" <noreply@gen7fuel.com>', // sender address
      to: to, // list of receivers (can be comma-separated)
      subject: subject, // Subject line
      text: text, // plain text body
      html: html, // html body
      cc: Array.isArray(cc) ? cc.join(', ') : cc, // CC recipients
      bcc: Array.isArray(bcc) ? bcc.join(', ') : bcc, // BCC recipients
      attachments,
    };

    // Send mail with defined transport object
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully');
    console.log('Message ID: %s', info.messageId);
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
    
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Send email to multiple recipients
 * @param {string[]} recipients - Array of recipient email addresses
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content (optional)
 * @param {string} html - HTML content (optional)
 * @returns {Promise} - Promise resolving to array of results
 */
async function sendBulkEmail({ recipients, subject, text = '', html = '' }) {
  try {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await sendEmail({
          to: recipient,
          subject,
          text,
          html
        });
        results.push({ email: recipient, ...result });
      } catch (error) {
        results.push({ 
          email: recipient, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error sending bulk emails:', error);
    throw new Error(`Failed to send bulk emails: ${error.message}`);
  }
}

module.exports = {
  sendEmail,
  sendBulkEmail
};