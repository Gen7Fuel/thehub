const express = require('express');
const router = express.Router();
const WriteOff = require('../models/WriteOff');
const WriteOffCart = require('../models/WriteOffCart');
const User = require('../models/User');
const Location = require('../models/Location');
const { getBulkOnHandQtyCSO } = require('../services/sqlService');
const { emailQueue } = require('../queues/emailQueue');
const { pushNotification } = require('../services/notificationService');
const { writeOffAutomationQueue } = require("../queues/writeOffAutomationQueue");
const { getPg } = require("../config/pg");
const moment = require("moment-timezone");

// GET /api/write-off/list?site=RANKIN
router.get('/work-list', async (req, res) => {
  try {
    if (!req.query.site) return res.status(400).json({ error: 'Site is required' });
    const workList = await WriteOffCart.findOne({ site: req.query.site }).lean();
    const location = await Location.findOne({ $or: [{ stationName: req.query.site }, { site: req.query.site }] }).select('timezone').lean();
    res.json({ ...(workList || { site: req.query.site, items: [] }), siteTimezone: location?.timezone || 'America/Toronto' });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching write-off work list' });
  }
});

router.post('/work-list', async (req, res) => {
  try {
    const { site, item } = req.body;
    if (!site || !item) return res.status(400).json({ error: 'Site and item are required' });
    const workList = await WriteOffCart.findOneAndUpdate(
      { site },
      { $push: { items: item } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(workList);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/work-list/:itemId', async (req, res) => {
  try {
    const { site, ...updates } = req.body;
    if (!site) return res.status(400).json({ error: 'Site is required' });
    const allowed = ['gtin', 'upc_barcode', 'name', 'qty', 'onHandAtWriteOff', 'reason', 'isManualEntry', 'expiryDate', 'markdownAction'];
    const itemUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
    const workList = await WriteOffCart.findOneAndUpdate(
      { site, 'items._id': req.params.itemId },
      { $set: Object.fromEntries(Object.entries(itemUpdates).map(([key, value]) => [`items.$.${key}`, value])) },
      { new: true, runValidators: true }
    );
    if (!workList) return res.status(404).json({ error: 'Work-list item not found' });
    res.json(workList);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/work-list/:itemId', async (req, res) => {
  try {
    if (!req.query.site) return res.status(400).json({ error: 'Site is required' });
    const workList = await WriteOffCart.findOneAndUpdate(
      { site: req.query.site },
      { $pull: { items: { _id: req.params.itemId } } },
      { new: true }
    );
    if (!workList) return res.status(404).json({ error: 'Work list not found' });
    res.json(workList);
  } catch (error) {
    res.status(500).json({ error: 'Error removing work-list item' });
  }
});

router.delete('/work-list', async (req, res) => {
  try {
    if (!req.query.site) return res.status(400).json({ error: 'Site is required' });
    const workList = await WriteOffCart.findOneAndUpdate({ site: req.query.site }, { $set: { items: [] } }, { new: true });
    res.json(workList || { site: req.query.site, items: [] });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing write-off work list' });
  }
});

router.get('/list', async (req, res) => {
  const { site, listType, from, to } = req.query; // Accept listType (WO or ATE)

  if (!site) return res.status(400).json({ error: "Site is required" });

  try {
    const query = { site };
    if (listType) query.listType = listType;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) query.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const lists = await WriteOff.find(query)
      .select('listNumber status submittedBy submitted items createdAt listType')
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

    const values = [...new Set((record.items || []).flatMap((item) => [item.upc_barcode, item.gtin].filter(Boolean).map(String)))];
    const recordLocation = await Location.findOne({ $or: [{ stationName: record.site }, { site: record.site }] }).select('_id');
    const itemBookSite = recordLocation?._id?.toString() || String(record.site);
    const rows = values.length ? await getPg()('item_bk')
      .select('site', 'upc', 'upc_barcode', 'gtin', 'description', 'image_url')
      .where('site', itemBookSite)
      .where((query) => query.whereIn('upc', values).orWhereIn('upc_barcode', values).orWhereIn('gtin', values)) : [];
    const byValue = new Map();
    rows.forEach((row) => [row.upc, row.upc_barcode, row.gtin].filter(Boolean).forEach((value) => byValue.set(String(value), row)));
    const items = record.items.map((item) => {
      const book = byValue.get(String(item.upc_barcode)) || byValue.get(String(item.gtin));
      return { ...item.toObject(), image_url: book?.image_url || null, itemBookName: book?.description || null, itemBookGtin: book?.gtin || null };
    });
    res.json({ ...record.toObject(), items });
  } catch (error) {
    console.error('Error enriching write-off item details:', error);
    res.status(500).json({ error: "Error fetching record details" });
  }
});

router.post('/', async (req, res) => {
  const { site, submittedBy, items, timestamp } = req.body;
  const siteCode = site?.toUpperCase() || 'NA';

  try {
    // 1. Extract unique GTINs for bulk lookup (exclude "Bistro" string)
    const gtins = [...new Set(
      items
        .filter(i => i.upc_barcode !== "Bistro" && i.gtin)
        .map(i => i.gtin)
    )];

    // 2. Fetch Bulk Stock Levels from SQL
    const stockMap = await getBulkOnHandQtyCSO(site, gtins);

    // 3. Attach fresh stock levels
    const processedItems = items.map(item => {
      const freshQty = item.gtin && stockMap[item.gtin] !== undefined
        ? stockMap[item.gtin]
        : (item.onHandAtWriteOff || 0);

      return {
        ...item,
        onHandAtWriteOff: freshQty
      };
    });

    // 4. Split items into THREE categories
    // Logic: Bistro items go to BT list, others split by "About to Expire"
    const bistroItems = processedItems.filter(i => i.upc_barcode === 'Bistro');
    const nonBistroItems = processedItems.filter(i => i.upc_barcode !== 'Bistro');

    const standardItems = nonBistroItems.filter(i => i.reason !== 'About to Expire');
    const ateItems = nonBistroItems.filter(i => i.reason === 'About to Expire');

    const createdLists = [];
    let woMongoId = null;
    let ateMongoId = null;
    let btMongoId = null;

    // 5. Save Standard Write-Off List (WO)
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
      woMongoId = savedWO._id;
      createdLists.push(woList.listNumber);
    }

    // 6. Save About to Expire List (ATE)
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
      ateMongoId = savedATE._id;
      createdLists.push(ateList.listNumber);
    }

    // 7. Save Bistro List (BT)
    if (bistroItems.length > 0) {
      const btList = new WriteOff({
        listNumber: `BT-${siteCode}-${timestamp}`,
        listType: 'BT',
        site,
        submittedBy,
        items: bistroItems,
        status: 'Incomplete',
        submitted: false
      });
      const savedBT = await btList.save();
      btMongoId = savedBT._id;
      createdLists.push(btList.listNumber);
    }

    // The work list is only a draft. Clear it after all requested write-off
    // documents have been saved successfully so a failed submission does not
    // destroy the user's draft.
    await WriteOffCart.findOneAndUpdate(
      { site },
      { $set: { items: [] } }
    );

    // 8. Fetch Location for Manager Emails
    const location = await Location.findOne({ site });

    // 🧩 Logic: Fallback to store email if manager list is empty
    let storeTo = "grayson@gen7fuel.com"; // Absolute fallback
    let storeCC = ["daksh@gen7fuel.com"];

    if (location?.managerEmails && location.managerEmails.length > 0) {
      storeTo = location.managerEmails[0];
      if (location.managerEmails.length > 1) {
        storeCC = [...storeCC, ...location.managerEmails.slice(1)];
      }
    } else if (location?.email) {
      storeTo = location.email;
    }

    const categoryUsers = await User.find({ is_active: true })
      .populate("role", "role_name name")
      .select("email role");
    const categoryEmails = categoryUsers
      .filter((user) => /inventory\s*team/i.test(user.role?.role_name || user.role?.name || ""))
      .map((user) => user.email)
      .filter(Boolean);

    const emailRecipients = {
      primaryCC: ["daksh@gen7fuel.com", "grayson@gen7fuel.com"],
      categoryTeam: categoryEmails
    };
    // --- NOTIFICATION TRIGGER LOGIC ---
    const io = req.app.get("io");

    const ids = [
      { id: woMongoId, label: "Standard Write-Off", btn: "📂 View WO List", color: "#333333", sub: "Warehouse" },
      { id: ateMongoId, label: "About to Expire", btn: "📅 View ATE List", color: "#3f51b5", sub: "Expiry Review" },
      { id: btMongoId, label: "Bistro Write-Off", btn: "🍔 View Bistro List", color: "#e67e22", sub: "Bistro Workflow" }
    ].filter(item => item.id);

    const headerTitle = ids.length > 1 ? "Multiple Inventory Write Off Lists Generated" : ids[0]?.label || "Inventory List";
    const bannerColor = "#283593";

    // Generate the table cells for buttons
    let linksHTML = '';
    ids.forEach((item, index) => {
      // If it's the 3rd item in a set of 3, make it full width
      const isFullWidth = ids.length === 3 && index === 2;
      const width = isFullWidth ? '100%' : (ids.length === 1 ? '100%' : '50%');

      linksHTML += `
      <td align="center" style="padding: 10px; width: ${width}; display: ${isFullWidth ? 'block' : 'table-cell'};">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: 500;">${item.label}</p>
        <a href="https://app.gen7fuel.com/write-off/${item.id}" 
           style="background-color: ${item.color}; color: #ffffff; padding: 14px 10px; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; font-size: 14px; text-align: center;">
           ${item.btn}
        </a>
      </td>`;

      // Add a table row break if we have 2 items and more are coming
      if (index === 1 && ids.length === 3) {
        linksHTML += '</tr><tr>';
      }
    });

    // TRIGGER FOR STORE (Standard, ATE, and/or BT)
    if (woMongoId || ateMongoId || btMongoId) {
      // const { slug, fieldValues } = getNotificationData(woMongoId, ateMongoId, btMongoId);
      const slug = `write-off-generated`;
      const fieldValues = {
        site: site,
        bannerColor: bannerColor,
        headerTitle: headerTitle,
        linksHTML: linksHTML,
      };
      await pushNotification({
        io,
        recipientEmails: [storeTo, ...storeCC, ...emailRecipients.primaryCC],
        slug: slug,
        subject: `Inventory Lists Generated: ${site}`,
        fieldValues
      });
    }

    // TRIGGER FOR CATEGORY TEAM (ATE and BT ONLY - WO is filtered out)
    if (ateMongoId || btMongoId) {
      // const { slug, fieldValues } = getNotificationData(null, ateMongoId, btMongoId);
      const slug = `write-off-generated`;
      const fieldValues = {
        site: site,
        bannerColor: bannerColor,
        headerTitle: headerTitle,
        linksHTML: linksHTML,
      };
      const catSubject = (ateMongoId && btMongoId)
        ? `Bistro & ATE Review Required: ${site}`
        : (ateMongoId ? `ATE Review Required: ${site}` : `Bistro Approval Required: ${site}`);

      await pushNotification({
        io,
        recipientEmails: emailRecipients.categoryTeam,
        slug: slug,
        subject: catSubject,
        fieldValues
      });
    }

    res.status(201).json({ success: true, lists: createdLists });

  } catch (err) {
    console.error("Creation Error:", err);
    res.status(500).json({ error: "Server failed to process write-off lists" });
  }
});

// PATCH /api/write-off/:id/items/:itemId/details
router.patch('/:id/items/:itemId/upc', async (req, res) => {
  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list || list.listType !== 'WO') return res.status(404).json({ error: 'Write-off list not found' });
    if (!list.submitted) return res.status(400).json({ error: 'The list has not been submitted.' });
    const item = list.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.found !== false) return res.status(400).json({ error: 'Only missing items can be updated.' });
    const upc = String(req.body.upc_barcode || '').trim();
    if (!upc) return res.status(400).json({ error: 'A UPC is required.' });
    item.upc_barcode = upc;
    await list.save();
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
// router.patch('/:id/finalize', async (req, res) => {
//   try {
//     const list = await WriteOff.findById(req.params.id);
//     if (!list) return res.status(404).json({ error: "List not found" });

//     if (list.submitted) {
//       return res.status(400).json({ error: "This list has already been submitted." });
//     }

//     const isBT = list.listType === 'BT';

//     // 1. Mark as submitted
//     list.submitted = true;
//     list.status = 'Complete';
//     const finalizedList = await list.save();

//     // 2. Fetch Location for CSO Link (Only if not Bistro)
//     let csoLink = "";
//     if (!isBT) {
//       const location = await Location.findOne({ site: list.site });
//       const csoCode = location?.csoCode || '0';
//       const dateObj = new Date(list.createdAt);
//       const formattedDate = dateObj.toLocaleDateString('en-US', {
//         month: '2-digit', day: '2-digit', year: 'numeric'
//       });
//       csoLink = `https://03.cstoreoffice.com/daily-store-spoilage.php?Station=${csoCode}&date_form=${formattedDate}`;
//     }

//     const hubLink = `https://app.gen7fuel.com/write-off/${list._id}`;


//     // 3. Notification Config
//     const emailRecipients = {
//       primaryTo: "grayson@gen7fuel.com",
//       categoryTeam: ["daksh@gen7fuel.com", "karthikeyan@gen7fuel.com", "vasu@gen7fuel.com", "Saeid@gen7fuel.com", "zyannic@bosservicesltd.com", "tejasvini@gen7fuel.com"]
//     };

//     const subject = isBT
//       ? `Approved by Station Manager: Bistro Items - ${list.site} (${list.listNumber})`
//       : `Finalized: Write-Off List - ${list.site} (${list.listNumber})`;

//     // const isBT = listType === 'BT';
//     const bannerColor = isBT ? "#e67e22" : "#1b5e20"; // Orange for Bistro, Green for WO
//     const headerTitle = isBT ? "Bistro Write-Off Approved" : "Write-Off Finalized";

//     // Text content based on type
//     const mainMessage = isBT
//       ? `The Station Manager has <strong>approved</strong> the Bistro Write-Off request for <strong>${list.site}</strong>. Please review the items in the Hub.`
//       : `The Station Manager has finalized the Write-Off request for <strong>${list.site}</strong>. Please review the details in the Hub and accept the corresponding ticket in CStoreOffice.`;

//     // Dynamic Button Layout
//     let buttonsHTML = '';
//     if (csoLink) {
//       // TWO BUTTONS (For WO)
//       buttonsHTML = `
//       <td align="center" style="padding: 10px; width: 50%;">
//         <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Review Details</p>
//         <a href="${hubLink}" style="background-color: #333333; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 90%; font-size: 14px; text-align: center;">📂 View in Hub</a>
//       </td>
//       <td align="center" style="padding: 10px; width: 50%;">
//         <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Inventory System</p>
//         <a href="${csoLink}" style="background-color: #2e7d32; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 90%; font-size: 14px; text-align: center;">✅ Accept in CSO</a>
//       </td>`;
//     } else {
//       // ONE BUTTON (For BT)
//       buttonsHTML = `
//       <td align="center" style="padding: 10px; width: 100%;">
//         <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Review Details</p>
//         <a href="${hubLink}" style="background-color: #e67e22; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 95%; font-size: 14px; text-align: center;">📂 View Approved Bistro List</a>
//       </td>`;
//     }

//     // 4. Trigger Hub Notification & Email Queue
//     await pushNotification({
//       io: req.app.get("io"),
//       recipientEmails: [emailRecipients.primaryTo, ...emailRecipients.categoryTeam],
//       slug: "write-off-finalized",
//       subject: subject,
//       fieldValues: {
//         site: list.site,
//         listNumber: list.listNumber,
//         bannerColor: bannerColor,
//         headerTitle: headerTitle,
//         mainMessage: mainMessage,
//         buttonsHTML: buttonsHTML,
//       }
//     });

//     res.json(finalizedList);
//   } catch (err) {
//     console.error("Finalize Error:", err);
//     res.status(500).json({ error: err.message });
//   }
// });
router.patch('/:id/resubmit-missing', async (req, res) => {
  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list || list.listType !== 'WO') return res.status(404).json({ error: 'Write-off list not found' });
    if (!list.submitted) return res.status(400).json({ error: 'The list has not been submitted.' });
    const missingItems = (list.items || []).filter((item) => item.found === false);
    if (!missingItems.length) return res.status(400).json({ error: 'There are no missing items to resubmit.' });
    const location = await Location.findOne({ site: list.site });
    const localMoment = moment(list.createdAt).tz(location?.timezone || 'America/Toronto');
    list.submittedAt = new Date();
    list.csoSubmissionStatus = 'pending';
    await list.save();
    await writeOffAutomationQueue.add('sync-write-off-missing', {
      writeOffId: list._id, targetStationCsoCode: '31750',
      formattedDate: localMoment.format('MM/DD/YYYY'), formattedTime: localMoment.format('HH:mm:ss'),
      listNumber: list.listNumber, items: missingItems.map((item) => item.toObject()), missingOnly: true,
    }, { jobId: `write-off-missing-${list._id}-${Date.now()}` });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id/finalize", async (req, res) => {
  try {
    const list = await WriteOff.findById(req.params.id);
    if (!list) return res.status(404).json({ error: "List not found" });

    if (list.submitted) {
      return res.status(400).json({ error: "This list has already been submitted." });
    }

    const isBT = list.listType === "BT";
    const isWO = list.listType === "WO";

    // 1. Mark as submitted
    list.submitted = true;
    list.status = "Complete";
    // const finalizedList = await list.save();
    const finalizedList = [];

    // 2. Fetch Location and Calculate Timezone-specific Timestamps
    let csoLink = "";
    let formattedDate = "";
    let formattedTime = "";
    let targetStationCsoCode = "0";

    const location = await Location.findOne({ site: list.site });

    if (location) {
      targetStationCsoCode = location.csoCode || "0";
      // targetStationCsoCode = '31750'; // Hardcoded for testing purposes
      const stationTimezone = location.timezone || "America/Toronto";

      // Convert UTC createdAt date to the station's exact local timezone
      const localMoment = moment(list.createdAt).tz(stationTimezone);
      formattedDate = localMoment.format("MM/DD/YYYY");
      formattedTime = localMoment.format("HH:mm:ss");
    } else {
      const defaultMoment = moment(list.createdAt).tz("America/Toronto");
      formattedDate = defaultMoment.format("MM/DD/YYYY");
      formattedTime = defaultMoment.format("HH:mm:ss");
    }

    if (!isBT) {
      csoLink = `https://03.cstoreoffice.com/daily-store-spoilage.php?Station=${targetStationCsoCode}&date_form=${formattedDate}`;
    }

    // 3. Trigger Automation (Only for 'WO' lists)
    if (isWO) {
      list.submittedAt = new Date();
      list.csoSubmissionStatus = "pending";
      await list.save();
      await writeOffAutomationQueue.add("sync-write-off", {
        writeOffId: list._id,
        targetStationCsoCode,
        formattedDate,
        formattedTime,
        listNumber: list.listNumber,
        items: (list.items || []).map((item) => item.toObject()),
      }, {
        jobId: `write-off-${list._id}`,
      });
      console.log(`📥 Queued CStore write-off automation for ${list.listNumber}`);
    }

    // 4. Notification & Email Configuration
    const hubLink = `https://app.gen7fuel.com/write-off/${list._id}`;
    
    const categoryUsers = await User.find({ is_active: true })
      .populate("role", "role_name name")
      .select("email role");
    const categoryEmails = categoryUsers
      .filter((user) => /inventory\s*team/i.test(user.role?.role_name || user.role?.name || ""))
      .map((user) => user.email)
      .filter(Boolean);

    const emailRecipients = {
      primaryTo: ["grayson@gen7fuel.com", "daksh@gen7fuel.com"],
      categoryTeam: categoryEmails
    };

    const subject = isBT
      ? `Approved by Station Manager: Bistro Items - ${list.site} (${list.listNumber})`
      : `Finalized: Write-Off List - ${list.site} (${list.listNumber})`;

    const bannerColor = isBT ? "#e67e22" : "#1b5e20";
    const headerTitle = isBT ? "Bistro Write-Off Approved" : "Write-Off Finalized";

    const mainMessage = isBT
      ? `The Station Manager has <strong>approved</strong> the Bistro Write-Off request for <strong>${list.site}</strong>. Please review the items in the Hub.`
      : `The Station Manager has finalized the Write-Off request for <strong>${list.site}</strong>. Please review the details in the Hub and accept the corresponding ticket in CStoreOffice.`;

    let buttonsHTML = "";
    if (csoLink) {
      buttonsHTML = `
      <td align="center" style="padding: 10px; width: 50%;">
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Review Details</p>
        <a href="${hubLink}" style="background-color: #333333; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 90%; font-size: 14px; text-align: center;">📂 View in Hub</a>
      </td>
      <td align="center" style="padding: 10px; width: 50%;">
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Inventory System</p>
        <a href="${csoLink}" style="background-color: #2e7d32; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 90%; font-size: 14px; text-align: center;">✅ Accept in CSO</a>
      </td>`;
    } else {
      buttonsHTML = `
      <td align="center" style="padding: 10px; width: 100%;">
        <p style="margin: 0 0 10px 0; font-size: 12px; color: #666; font-weight: bold; text-transform: uppercase;">Review Details</p>
        <a href="${hubLink}" style="background-color: #e67e22; color: #ffffff; padding: 14px 0; text-decoration: none; font-weight: 600; border-radius: 6px; display: block; width: 95%; font-size: 14px; text-align: center;">📂 View Approved Bistro List</a>
      </td>`;
    }

    await pushNotification({
      io: req.app.get("io"),
      recipientEmails: [emailRecipients.primaryTo, ...emailRecipients.categoryTeam],
      slug: "write-off-finalized",
      subject: subject,
      fieldValues: {
        site: list.site,
        listNumber: list.listNumber,
        bannerColor: bannerColor,
        headerTitle: headerTitle,
        mainMessage: mainMessage,
        buttonsHTML: buttonsHTML,
      },
    });

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
