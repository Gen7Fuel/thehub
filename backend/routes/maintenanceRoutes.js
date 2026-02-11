const express = require('express');
const router = express.Router();
const Maintenance = require('../models/Maintenance');
const User = require('../models/User');
const { emailQueue } = require('../queues/emailQueue');

function generateMaintenanceEmailHTML(maintenance) {
  const start = new Date(maintenance.scheduleStart).toLocaleString();
  const end = new Date(maintenance.scheduleClose).toLocaleString();

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f9; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden;">
        <div style="background-color: #1a237e; color: #ffffff; text-align: center; padding: 25px;">
          <h1 style="margin: 0; font-size: 24px;">🛠️ System Maintenance Notice</h1>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Please be advised that <strong>Gen7Fuel Hub</strong> will undergo scheduled maintenance for <strong>${maintenance.name}</strong>.
          </p>

          <div style="background-color: #f8f9fa; border-left: 4px solid #1a237e; padding: 20px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 5px 0; font-weight: bold; color: #555; width: 100px;">📅 Starts:</td>
                <td style="padding: 5px 0; color: #000;">${start}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-weight: bold; color: #555;">🏁 Ends:</td>
                <td style="padding: 5px 0; color: #000;">${end} (Estimated)</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 15px; color: #d32f2f; font-weight: bold;">
            ⚠️ IMPORTANT: Action Required
          </p>
          <ul style="font-size: 14px; color: #555; line-height: 1.5;">
            <li>The site will <strong>not accept new data</strong> during this window.</li>
            <li>Please <strong>save all work-in-progress</strong> at least 5 minutes before the start time.</li>
            <li>All unsaved work will be lost when the system goes offline.</li>
          </ul>

          <div style="margin-top: 25px; padding: 15px; background-color: #fff3e0; border-radius: 8px; border: 1px solid #ffe0b2;">
            <p style="margin: 0; font-size: 14px; color: #e65100;">
              <strong>Description:</strong> ${maintenance.description}
            </p>
          </div>

          <p style="color: #777; font-size: 12px; margin-top: 30px; text-align: center; border-top: 1px solid #eee; pt: 20px;">
            This is an automated operational message. Thank you for your patience.
          </p>
        </div>
      </div>
    </div>
  `;
}

// Cancellation Email Template
function generateCancellationEmailHTML(maintenance) {
  // Format the dates for the user's clarity
  const start = new Date(maintenance.scheduleStart).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const end = new Date(maintenance.scheduleClose).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f9; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border-top: 8px solid #d32f2f; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="padding: 30px; text-align: center;">
          <h1 style="color: #d32f2f; margin: 0; font-size: 22px;">Notice: Maintenance Cancelled</h1>
          
          <p style="font-size: 16px; color: #333; margin-top: 20px;">
            The maintenance window for <strong>${maintenance.name}</strong> has been cancelled.
          </p>

          <div style="margin: 20px auto; padding: 15px; background-color: #f8f9fa; border: 1px dashed #dee2e6; border-radius: 8px; width: 85%; text-align: left;">
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: bold; text-transform: uppercase;">Original Schedule Detail:</p>
            <p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>📅 Start:</strong> ${start}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #444;"><strong>🏁 End:</strong> ${end}</p>
          </div>
          
          <div style="margin: 25px 0; padding: 20px; background-color: #fdecea; border-radius: 8px; display: inline-block; width: 85%;">
            <p style="margin: 0; color: #b71c1c; font-weight: bold; font-size: 16px;">
              ✅ The system will remain ONLINE.
            </p>
          </div>

          <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 20px;">
            No action is required. You may continue to use the <strong>Gen7Fuel Hub</strong> as usual. We apologize for any inconvenience caused by this change in schedule.
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            This is an automated operational update from the Gen7Fuel Systems Team.
          </p>
        </div>
      </div>
    </div>
  `;
}

// 1. POST: Create a new maintenance schedule
router.post('/', async (req, res) => {
  try {
    const maintenance = new Maintenance({
      ...req.body,
      createdBy: req.user.id,
      // Default to scheduled unless explicitly told otherwise
      status: req.body.status || 'scheduled'
    });

    const saved = await maintenance.save();
    const io = req.app.get("io");
    if (io) io.emit("maintenanceUpdated");
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: "Failed to create schedule", error: err.message });
  }
});

// 2. GET ALL: List all records
router.get('/', async (req, res) => {
  try {
    const records = await Maintenance.find()
      .populate('createdBy', 'firstName lastName')
      .populate('startedBy', 'firstName lastName') // Added this for the list view logs
      .populate('closedBy', 'firstName lastName')
      .sort({ scheduleStart: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching schedules" });
  }
});

// 3. GET SINGLE: Get specific maintenance details
router.get('/:id', async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('startedBy', 'firstName lastName')
      .populate('closedBy', 'firstName lastName');

    if (!record) return res.status(404).json({ message: "Record not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Trigger manual email notification
router.post('/:id/notify', async (req, res) => {
  try {
    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) return res.status(404).json({ message: "Schedule not found" });

    // 1. Fetch all active user emails
    // const users = await User.find({ is_active: true }, 'email');
    // const emailList = users.map(u => u.email);
    const bccEmailList = ['vasu@gen7fuel.com'] // Example email list
    const ccEmailList = ['vasu@gen7fuel.com'] // Example email list

    // 2. Prepare Email Content (Template helper below)
    const emailHtml = generateMaintenanceEmailHTML(maintenance);

    // 3. Add to BullMQ (matches your existing syntax)
    await emailQueue.add("sendMaintenanceAlert", {
      to: "daksh@gen7fuel.com", // Or a primary contact
      cc: ccEmailList,
      bcc: bccEmailList, // Better to use BCC for mass mail so users don't see each other
      subject: `🛠️ Scheduled System Maintenance: ${maintenance.name}`,
      html: emailHtml,
    });

    // 4. Update the maintenance record
    maintenance.notificationSent = true;
    await maintenance.save();

    res.json({ message: `Notification queued for ${emailList.length} users.` });
  } catch (err) {
    res.status(500).json({ message: "Failed to queue emails", error: err.message });
  }
});

// POST: Cancel maintenance and notify users
router.post('/:id/cancel', async (req, res) => {
  try {
    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) return res.status(404).json({ message: "Record not found" });

    maintenance.status = 'cancelled';
    await maintenance.save();

    // If notifications were previously sent, we MUST notify them of the cancellation
    if (maintenance.notificationSent) {
      const users = await User.find({ is_active: true }, 'email');
      // const emailList = users.map(u => u.email);
      const bccEmailList = ['vasu@gen7fuel.com'] // Example email list
      const ccEmailList = ['vasu@gen7fuel.com'] // Example email list

      await emailQueue.add("sendMaintenanceAlert", {
        to: "daksh@gen7fuel.com",
        cc: ccEmailList,
        bcc: bccEmailList,
        subject: `🚫 CANCELLED: System Maintenance - ${maintenance.name}`,
        html: generateCancellationEmailHTML(maintenance),
      });
    }
    const io = req.app.get("io");
    if (io) io.emit("maintenanceUpdated");

    res.json({ message: "Maintenance cancelled successfully." });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



// 4. PUT: Update/Edit schedule or change status (Start/End)
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Logic for tracking who starts/ends the maintenance
    if (updateData.status === 'ongoing') {
      updateData.actualStart = new Date();
      updateData.startedBy = req.user.id;
    } else if (updateData.status === 'completed' || updateData.status === 'cancelled') {
      updateData.actualEnd = new Date();
      updateData.closedBy = req.user.id;
    }

    const updated = await Maintenance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Record not found" });
    const io = req.app.get("io");
    if (io) io.emit("maintenanceUpdated");
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: "Update failed", error: err.message });
  }
});

// 5. DELETE: Remove a schedule
router.delete('/:id', async (req, res) => {
  try {
    const record = await Maintenance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    // Industrial safety: don't delete if it's active
    if (record.status === 'ongoing') {
      return res.status(400).json({ message: "Cannot delete an active maintenance session." });
    }

    await record.deleteOne();
    res.json({ message: "Maintenance record deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;