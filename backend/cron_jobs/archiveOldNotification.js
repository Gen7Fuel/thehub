const Notification = require('../models/notification/notification'); // Adjust path as needed
const cron = require('node-cron');

async function cleanUpNotifications() {
  console.log('--- Starting Notification Cleanup Job ---');
  
  const now = new Date();
  const eightDaysAgo = new Date(now.getTime() - (8 * 24 * 60 * 60 * 1000));
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  try {
    // 1. DELETE: Anything older than 30 days
    const deleteResult = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo }
    });
    console.log(`Deleted ${deleteResult.deletedCount} notifications older than 30 days.`);

    // 2. ARCHIVE: Between 8 and 30 days old, if fully read
    // We fetch these to perform the length comparison logic
    const candidates = await Notification.find({
      status: 'sent',
      createdAt: { $gte: thirtyDaysAgo, $lt: eightDaysAgo }
    });

    let archiveCount = 0;

    for (const notif of candidates) {
      const totalRecipients = notif.recipientIds.length;
      const readCount = notif.readReceipts.length;

      if (readCount >= totalRecipients && totalRecipients > 0) {
        notif.status = 'archived';
        await notif.save();
        archiveCount++;
      }
    }

    console.log(`Archived ${archiveCount} fully-read notifications (8-30 days old).`);
    console.log('--- Cleanup Job Finished ---');
  } catch (err) {
    console.error('Error during notification cleanup:', err);
  }
}

// Schedule for Sunday at 00:00 (Midnight)
cron.schedule('0 0 * * 0', () => {
  cleanUpNotifications();
});


module.exports = cleanUpNotifications;