const express = require('express');
const router = express.Router();
const WriteOff = require('../models/WriteOff');
const Location = require('../models/Location');
const { getBulkOnHandQtyCSO } = require('../services/sqlService');
const { emailQueue } = require('../queues/emailQueue');

// Helper function to generate email HTML content
function generateEmailHTML(site, woMongoId, ateMongoId) {
  const isBoth = woMongoId && ateMongoId;
  const headerTitle = isBoth ? "New WO & ATE Lists" : (woMongoId ? "Write-Off List" : "ATE Review List");
  const bannerColor = "#283593";

  // Dynamic style based on count
  // If only one button, make it block/full-width. If two, keep them inline-block.
  const buttonStyle = isBoth
    ? "display: inline-block; width: 85%;"
    : "display: block; width: 95%;";

  let linksHTML = '';

  if (woMongoId) {
    linksHTML += `
      <td align="center" style="padding: 10px; width: ${isBoth ? '50%' : '100%'};">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: 500;">Standard Write-Off</p>
        <a href="https://app.gen7fuel.com/write-off/${woMongoId}" 
           style="background-color: #333333; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; ${buttonStyle} font-size: 15px; text-align: center;">
           📂 View WO List
        </a>
      </td>`;
  }

  if (ateMongoId) {
    linksHTML += `
      <td align="center" style="padding: 10px; width: ${isBoth ? '50%' : '100%'};">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: 500;">About to Expire</p>
        <a href="https://app.gen7fuel.com/write-off/${ateMongoId}" 
           style="background-color: #3f51b5; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; ${buttonStyle} font-size: 15px; text-align: center;">
           📅 View ATE List
        </a>
      </td>`;
  }

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f2f5; padding: 30px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        
        <div style="background-color: ${bannerColor}; color: #ffffff; text-align: center; padding: 25px;">
          <h2 style="margin: 0; font-size: 22px; letter-spacing: 0.5px;">${headerTitle}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 15px;">Site: ${site}</p>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #444; line-height: 1.6;">
            Hello Store Team,<br><br>
            A new list has been generated. Please use the link(s) below to process the item(s).
          </p>

          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 25px; background-color: #f8f9fa; border-radius: 8px; padding: 15px;">
            <tr>
              ${linksHTML}
            </tr>
          </table>

          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-size: 12px; color: #888; text-align: center; line-height: 1.4;">
              This is an automated message from the Gen7Fuel Hub. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateFinalizedEmailHTML(site, listNumber, hubLink, csoLink) {
  const bannerColor = "#1b5e20"; // Dark Green to signify Completion/Finalization

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f2f5; padding: 30px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
        
        <div style="background-color: ${bannerColor}; color: #ffffff; text-align: center; padding: 25px;">
          <h2 style="margin: 0; font-size: 20px; letter-spacing: 0.5px;">Write-Off Finalized</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">List: ${listNumber} | Site: ${site}</p>
        </div>

        <div style="padding: 30px;">
          <p style="font-size: 15px; color: #444; line-height: 1.6;">
            Hello Team,<br><br>
            The Station Manager has finalized the Write-Off request for <strong>${site}</strong>. 
            Please review the details in the Hub and accept the corresponding ticket in CStoreOffice.
          </p>

          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 25px; background-color: #f8f9fa; border-radius: 8px; padding: 15px;">
            <tr>
              <td align="center" style="padding: 10px; width: 50%;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Review Details</p>
                <a href="${hubLink}" 
                   style="background-color: #333333; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 90%; font-size: 14px; text-align: center;">
                   📂 View in Hub
                </a>
              </td>
              <td align="center" style="padding: 10px; width: 50%;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Inventory System</p>
                <a href="${csoLink}" 
                   style="background-color: #2e7d32; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 90%; font-size: 14px; text-align: center;">
                   ✅ Accept in CSO
                </a>
              </td>
            </tr>
          </table>

          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-size: 12px; color: #888; text-align: center; line-height: 1.4;">
              This is an automated message from the Gen7Fuel Hub. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// GET /api/write-off/list?site=RANKIN
router.get('/list', async (req, res) => {
  const { site, listType } = req.query; // Accept listType (WO or ATE)

  if (!site) return res.status(400).json({ error: "Site is required" });

  try {
    const query = { site };
    if (listType) query.listType = listType;

    const lists = await WriteOff.find(query)
      .select('listNumber status submittedBy items createdAt listType')
      .lean();

    const statusPriority = { 'Incomplete': 1, 'Partial': 2, 'Complete': 3 };

    const sortedLists = lists.sort((a, b) => {
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sortedLists);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/write-off/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await WriteOff.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "Error fetching record details" });
  }
});

// Create a new write-off list
router.post('/', async (req, res) => {
  const { site, submittedBy, items, timestamp } = req.body;
  const siteCode = site?.toUpperCase() || 'NA';

  try {
    // 1. Extract unique GTINs for bulk lookup
    const gtins = [...new Set(items.map(i => i.gtin).filter(Boolean))];

    // 2. Fetch Bulk Stock Levels from SQL
    const stockMap = await getBulkOnHandQtyCSO(site, gtins);

    // 3. Attach the fresh stock levels to each item
    const processedItems = items.map(item => {
      // If item has a GTIN and exists in SQL results, use that. 
      // Otherwise, fallback to what the frontend sent or 0.
      const freshQty = item.gtin && stockMap[item.gtin] !== undefined
        ? stockMap[item.gtin]
        : (item.onHandAtWriteOff || 0);

      return {
        ...item,
        onHandAtWriteOff: freshQty
      };
    });

    // 4. Split items into two categories
    const standardItems = processedItems.filter(i => i.reason !== 'About to Expire');
    const ateItems = processedItems.filter(i => i.reason === 'About to Expire');

    const createdLists = [];
    let woMongoId = null;
    let ateMongoId = null;

    // 5. Save Standard Write-Off List
    if (standardItems.length > 0) {
      const woList = new WriteOff({
        listNumber: `WO-${siteCode}-${timestamp}`,
        listType: 'WO',
        site,
        submittedBy,
        items: standardItems,
        status: 'Incomplete',
        submitted: false
      });
      const savedWO = await woList.save();
      woMongoId = savedWO._id; // Capture the MongoDB Object ID
      createdLists.push(woList.listNumber);
    }

    // 6. Save About to Expire List
    if (ateItems.length > 0) {
      const ateList = new WriteOff({
        listNumber: `ATE-${siteCode}-${timestamp}`,
        listType: 'ATE',
        site,
        submittedBy,
        items: ateItems,
        status: 'Incomplete',
        submitted: false
      });
      const savedATE = await ateList.save();
      ateMongoId = savedATE._id; // Capture the MongoDB Object ID
      createdLists.push(ateList.listNumber);
    }

    // --- EMAIL QUEUE PLACEHOLDER ---
    // Logic for adding to email queue will go here later
    // here need seperate email templates if the list has write off items then only it will be sent to the category teams
    // else no email to category team and manager email if both then 2 links if one the one link
    // --------------------------------

    const location = await Location.findOne({ stationName: site });
    const storeEmail = location?.email;

    if (!storeEmail) {
      console.error(`No email found for site: ${site}. Email skipped.`);
    } else {
      const siteInitials = siteCode;

      // RECIPIENTS CONFIG
      const emailRecipients = {
        store: storeEmail,
        primaryCC: ["daksh@gen7fuel.com", "grayson@gen7fuel.com"],
        categoryTeam: ["daksh@gen7fuel.com", "vasu@gen7fuel.com", "Pablo@gen7fuel.com", 
                    "Saeid@gen7fuel.com", "zyannic@bosservicesltd.com", "grayson@gen7fuel.com"]
      };
      // SCENARIO 1: Both Lists Generated
      if (woMongoId && ateMongoId) {
        // Email 1: Mixed format to Store (No CC)
        await emailQueue.add("sendWriteOffEmail", {
          to: emailRecipients.store,
          subject: `Inventory Lists Created: ${site}`,
          html: generateEmailHTML(site, woMongoId, ateMongoId), // Use Mongo IDs for links
          cc: emailRecipients.primaryCC
        });

        // Email 2: ATE only to Category Team (Multiple CCs)
        await emailQueue.add("sendWriteOffEmail", {
          to: "grayson@gen7fuel.com",
          subject: `ATE Review Required: ${site}`,
          html: generateEmailHTML(site, null, ateMongoId), // Only ATE link
          cc: emailRecipients.categoryTeam.filter(e => e !== "grayson@gen7fuel.com")
        });
      }
      // SCENARIO 2: Only ATE List
      else if (ateMongoId) {
        await emailQueue.add("sendWriteOffEmail", {
          to: emailRecipients.store,
          subject: `ATE Review Required: ${site}`,
          html: generateEmailHTML(site, null, ateMongoId),
          cc: emailRecipients.categoryTeam
        });
      }
      // SCENARIO 3: Only WO List
      else if (woMongoId) {
        await emailQueue.add("sendWriteOffEmail", {
          to: emailRecipients.store,
          subject: `Write-Off List Generated: ${site} (${siteInitials})`,
          html: generateEmailHTML(site, woMongoId, null),
          cc: emailRecipients.primaryCC
        });
      }
    }

    res.status(201).json({
      success: true,
      lists: createdLists
    });

  } catch (err) {
    console.error("Creation Error:", err);
    res.status(500).json({ error: "Server failed to process write-off lists" });
  }
});

// PATCH /api/write-off/:id/items/:itemId/details
router.patch('/:id/items/:itemId/details', async (req, res) => {
  const { qty, reason, markdownAction } = req.body; // Add markdownAction here

  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    const item = list.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Update common fields
    item.qty = qty;
    item.isEdited = true;

    // Conditionally update based on List Type
    if (list.listType === 'ATE') {
      item.markdownAction = markdownAction;
    } else {
      item.reason = reason;
    }

    await list.save();
    res.json(list);
  } catch (err) {
    console.error("Patch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/write-off/:id/items/:itemId
router.patch('/:id/items/:itemId', async (req, res) => {
  const { completed } = req.body;

  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    // Find index instead of using .id() helper to be safer with string vs ObjectId
    const itemIndex = list.items.findIndex(i => i._id.toString() === req.params.itemId);

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in this list" });
    }

    // Update the item
    list.items[itemIndex].completed = completed;

    // Recalculate Master Status
    const totalItems = list.items.length;
    const completedCount = list.items.filter(i => i.completed).length;

    if (completedCount === 0) {
      list.status = 'Incomplete';
    } else if (completedCount === totalItems) {
      list.status = 'Complete';
    } else {
      list.status = 'Partial';
    }

    // Mark as modified (Mongoose sometimes needs this for subdocument arrays)
    list.markModified('items');

    const updatedList = await list.save();
    res.json(updatedList);

  } catch (err) {
    console.error("PATCH ERROR:", err); // Look at your terminal for this!
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// PATCH /api/write-off/:id/finalize
router.patch('/:id/finalize', async (req, res) => {
  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    if (list.submitted) {
      return res.status(400).json({ error: "This list has already been submitted." });
    }

    // 1. Mark as submitted and ensure status is Complete
    list.submitted = true;
    list.status = 'Complete';

    // 2. Save the document
    const finalizedList = await list.save();

    // 2. Fetch Location for CSO Link
    // 2. Fetch Location for CSO Code
    const location = await Location.findOne({ stationName: list.site });
    const csoCode = location?.csoCode || '0';

    // 3. Format the Date for CSO Link (MM/DD/YYYY)
    // We use the list's createdAt date
    const dateObj = new Date(list.createdAt);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });

    // 4. Construct Links
    const csoLink = `https://03.cstoreoffice.com/daily-store-spoilage.php?Station=${csoCode}&date_form=${formattedDate}`;
    const hubLink = `https://app.gen7fuel.com/write-off/${list._id}`;

    // 3. Email Queue Logic
    const emailRecipients = {
      primaryTo: "grayson@gen7fuel.com", // Primary CC from previous logic becomes the 'To'
      categoryTeam: ["daksh@gen7fuel.com", "vasu@gen7fuel.com", "Pablo@gen7fuel.com", 
                    "Saeid@gen7fuel.com", "zyannic@bosservicesltd.com"]
    };

    await emailQueue.add("sendWriteOffEmail", {
      to: emailRecipients.primaryTo,
      subject: `Finalized: Write-Off List - ${list.site} (${list.listNumber})`,
      html: generateFinalizedEmailHTML(list.site, list.listNumber, hubLink, csoLink),
      cc: emailRecipients.categoryTeam
    });

    console.log(`List ${list.listNumber} finalized by ${req.user.email}`);
    res.json(finalizedList);
  } catch (err) {
    console.error("Finalize Error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/items/:itemId/comments', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { initials, author, text } = req.body;
    console.log("Adding comment to WriteOff:", id, itemId, initials, author, text);
    // Validation
    if (!initials || !author || !text) {
      return res.status(400).json({ message: 'All comment fields (initials, author, text) are required.' });
    }

    // 1. Find the parent WriteOff list
    const list = await WriteOff.findById(id);
    if (!list) return res.status(404).json({ message: 'Write-off list not found.' });

    // 2. Find the specific item within that list
    const item = list.items.id(itemId);
    if (!item) return res.status(404).json({ message: 'Item not found in this list.' });

    if (!item.comments) {
      item.comments = [];
    }
    // 3. Push the comment to the ITEM'S comment array
    item.comments.push({
      initials,
      author,
      text,
      createdAt: new Date()
    });

    // 4. Save the parent document
    await list.save();

    // 5. Return the full updated list so frontend state stays in sync
    res.json(list);
  } catch (err) {
    console.error("Comment Error:", err);
    res.status(500).json({ message: 'Failed to add comment.' });
  }
});


module.exports = router;