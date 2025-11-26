const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { DateTime } = require('luxon');
const CycleCount = require('../models/CycleCount');
const Location = require('../models/Location');
const { getCurrentInventory, getInventoryCategories, getBulkOnHandQtyCSO } = require('../services/sqlService');


const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets["Data"];
    if (!sheet) return res.status(400).json({ message: 'Sheet named "Data" not found' });

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Skip the first row (title row)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0] || !row[1] || !row[2]) continue; // skip if required fields missing

      // Remove "Gen 7" and trim site name
      let siteName = String(row[0]).replace(/Gen ?7/gi, '').trim();

      const item = {
        site: siteName,
        upc: row[1],
        name: row[2],
        category: row[5] || "",
        grade: row[23] || "",
        gtin: row[24],
        upc_barcode: row[25],
        updatedAt: new Date("2025-09-18T00:00:00.000Z"),
        flagged: false
      };

      await CycleCount.create(item);
    }

    res.json({ message: 'Items uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to process file' });
  }
});

// GET /api/cycle-count/daily-items?site=SiteName&chunkSize=20
router.get('/daily-items', async (req, res) => {
  try {
    const { site, chunkSize = 20, userTimezone } = req.query;
    if (!site) return res.status(400).json({ message: "site is required" });

    // Get location object to determine the site's timezone
    const location = await Location.findOne({ stationName: site.toString().trim() });
    const siteTimezone = location?.timezone || 'UTC';

    // Compare user timezone with site timezone
    const shouldUpdateDisplayDate = userTimezone && userTimezone === siteTimezone;

    console.log(`Site: ${site}, Site Timezone: ${siteTimezone}, User Timezone: ${userTimezone}, Should Update: ${shouldUpdateDisplayDate}`);

    // Get today's date string in site's timezone
    const todayDate = DateTime.now().setZone(siteTimezone).toISODate(); // 'YYYY-MM-DD'

    // --- 1. Try to find today's items (fixed for the day) ---
    // Flagged items: those with both displayDate and flaggedDisplayDate set to today
    const flaggedItems = await CycleCount.find({
      site: site.toString().trim(),
      displayDate: todayDate,
      flaggedDisplayDate: todayDate
    }).lean();

    // Regular items: those with displayDate set to today, but NOT flaggedDisplayDate
    const items = await CycleCount.find({
      site: site.toString().trim(),
      displayDate: todayDate,
      $or: [
        { flaggedDisplayDate: { $ne: todayDate } },
        { flaggedDisplayDate: { $exists: false } }
      ]
    }).lean();

    console.log('flagged items len:', flaggedItems.length);
    console.log('items len:', items.length);
    // If we have a full set for today, return them
    if (flaggedItems.length + items.length === parseInt(chunkSize, 10)) {
      return res.json({ flaggedItems, items });
    }

    // --- 2. If not, run the selection algorithm to pick today's items ---

    // Get the start and end of today in the site's timezone, then convert to UTC
    const now = DateTime.now().setZone(siteTimezone);
    const todayStart = now.startOf('day').toUTC();
    const tomorrowStart = todayStart.plus({ days: 1 });

    // Fetch flagged items (top candidates)
    const flaggedItemsRaw = await CycleCount.find({ site: site.toString().trim(), flagged: true });
    const flaggedSelected = CycleCount.sortFlaggedItems(flaggedItemsRaw).slice(0, 5);
    const flaggedCount = flaggedSelected.length;

    const chunk = parseInt(chunkSize, 10);
    const dailyCount = Math.max(chunk - flaggedCount, 0); // number of items on today's list

    // Fetch all unflagged items for the site
    let allUnflagged = await CycleCount.find({
      site: site.toString().trim(),
      flagged: false
    });
    allUnflagged = CycleCount.sortItems(allUnflagged);

    // All unflagged items counted today (priority)
    const todayItemsUnflagged = allUnflagged.filter(i =>
      DateTime.fromJSDate(i.updatedAt).toUTC() >= todayStart &&
      DateTime.fromJSDate(i.updatedAt).toUTC() < tomorrowStart
    );

    // Calculate how many more items are needed
    const todayCount = todayItemsUnflagged.length;
    const moreNeeded = Math.max(dailyCount - todayCount, 0);

    // For the remainder, use the A/B/C algorithm, EXCLUDING today's items
    const grades = ["A", "B", "C"];
    const groupSize = 6;
    const groups = Math.floor(moreNeeded / groupSize);
    const remainder = moreNeeded % groupSize;

    const numA = 3 * groups + remainder;
    const numB = 2 * groups;
    const numC = 1 * groups;

    // Exclude today's items from the pool
    const notTodayByGrade = {};
    grades.forEach(grade => {
      notTodayByGrade[grade] = allUnflagged
        .filter(i => i.grade === grade && !(
          DateTime.fromJSDate(i.updatedAt).toUTC() >= todayStart &&
          DateTime.fromJSDate(i.updatedAt).toUTC() < tomorrowStart
        ));
    });

    let selectedA = CycleCount.sortItems(notTodayByGrade["A"]).slice(0, numA);
    let selectedB = CycleCount.sortItems(notTodayByGrade["B"]).slice(0, numB);
    let selectedC = CycleCount.sortItems(notTodayByGrade["C"]).slice(0, numC);

    // Combine today's items (all grades) and the A/B/C breakdown for the rest
    const regularSelected = [
      ...CycleCount.sortItems(todayItemsUnflagged), // all today's unflagged items first
      ...selectedA,
      ...selectedB,
      ...selectedC
    ].slice(0, dailyCount); // ensure we don't exceed dailyCount

    // // --- 3. Only update displayDate fields if user timezone matches site timezone ---
    // if (shouldUpdateDisplayDate) {
    //   console.log(`✅ Updating displayDate fields - User timezone matches site timezone (${siteTimezone})`);

    //   const flaggedIds = flaggedSelected.map(i => i._id);
    //   const regularIds = regularSelected.map(i => i._id);

    //   // Set displayDate for all, flaggedDisplayDate for flagged only
    //   if (flaggedIds.length > 0) {
    //     await CycleCount.updateMany(
    //       { _id: { $in: flaggedIds } },
    //       { $set: { displayDate: todayDate, flaggedDisplayDate: todayDate } }
    //     );
    //   }

    //   if (regularIds.length > 0) {
    //     await CycleCount.updateMany(
    //       { _id: { $in: regularIds } },
    //       { $set: { displayDate: todayDate }, $unset: { flaggedDisplayDate: "" } }
    //     );
    //   }
    // } else {
    //   console.log(`⏭️ Skipping displayDate update - User timezone (${userTimezone}) does not match site timezone (${siteTimezone})`);
    // }

    // // --- 4. Re-fetch today's items for response OR return selected items ---
    // let flaggedItemsFinal, itemsFinal;

    // if (shouldUpdateDisplayDate) {
    //   // If we updated the database, fetch the updated items
    //   flaggedItemsFinal = await CycleCount.find({
    //     site: site.toString().trim(),
    //     displayDate: todayDate,
    //     flaggedDisplayDate: todayDate
    //   }).lean();

    //   itemsFinal = await CycleCount.find({
    //     site: site.toString().trim(),
    //     displayDate: todayDate,
    //     $or: [
    //       { flaggedDisplayDate: { $ne: todayDate } },
    //       { flaggedDisplayDate: { $exists: false } }
    //     ]
    //   }).lean();
    // } else {
    //   // If we didn't update the database, return the selected items directly
    //   flaggedItemsFinal = flaggedSelected;
    //   itemsFinal = regularSelected;
    // }
    // --- 3. Only update displayDate fields if user timezone matches site timezone ---
    if (shouldUpdateDisplayDate) {
      console.log(`✅ Updating displayDate fields - User timezone matches site timezone (${siteTimezone})`);

      const flaggedIds = flaggedSelected.map(i => i._id);
      const regularIds = regularSelected.map(i => i._id);

      // Set displayDate for flagged items
      if (flaggedIds.length > 0) {
        await CycleCount.updateMany(
          { _id: { $in: flaggedIds } },
          { $set: { displayDate: todayDate, flaggedDisplayDate: todayDate } }
        );
      }

      // Set displayDate for regular items
      if (regularIds.length > 0) {
        await CycleCount.updateMany(
          { _id: { $in: regularIds } },
          { $set: { displayDate: todayDate }, $unset: { flaggedDisplayDate: "" } }
        );
      }
    } else {
      console.log(`⏭️ Skipping displayDate update - User timezone (${userTimezone}) does not match site timezone (${siteTimezone})`);
    }


    // if (shouldUpdateDisplayDate) {

    // ----------------------------------------------------
    // SQL CSO FETCH + BULKWRITE UPDATE
    // ----------------------------------------------------

    const allUPCs = [
      ...flaggedSelected.map(i => i.upc_barcode),
      ...regularSelected.map(i => i.upc_barcode)
    ];
    const uniqueUPCs = [...new Set(allUPCs)];
    console.log('Sending request for site:', site, 'and upcs:', uniqueUPCs);
    const csoQtyMap = await getBulkOnHandQtyCSO(site, uniqueUPCs);

    console.log('upcs updated now updating cyclecount table');
    const bulkOps = [];

    for (const item of [...flaggedSelected, ...regularSelected]) {
      const qty = csoQtyMap[item.upc_barcode] ?? 0;

      bulkOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { onHandCSO: qty } }
        }
      });
    }

    if (bulkOps.length > 0) {
      console.log(`⚡ Bulk updating ${bulkOps.length} CycleCount docs with onHandCSO`);
      await CycleCount.bulkWrite(bulkOps);
    }
    console.log('Bulk cyclecout update done');

    // } else {
    //   console.log("⏭️ Skipping SQL & CSO updates — Already selected today.");
    // }


    // --- 4. Re-fetch today's items for response OR return selected items ---
    let flaggedItemsFinal, itemsFinal;

    if (shouldUpdateDisplayDate) {
      // Fetch updated flagged items
      flaggedItemsFinal = await CycleCount.find({
        site: site.toString().trim(),
        displayDate: todayDate,
        flaggedDisplayDate: todayDate
      }).lean();

      // Fetch updated regular items
      itemsFinal = await CycleCount.find({
        site: site.toString().trim(),
        displayDate: todayDate,
        $or: [
          { flaggedDisplayDate: { $ne: todayDate } },
          { flaggedDisplayDate: { $exists: false } }
        ]
      }).lean();

    } else {
      // No displayDate update → return selected items directly
      flaggedItemsFinal = flaggedSelected;
      itemsFinal = regularSelected;
    }

    return res.json({
      flaggedItems: flaggedItemsFinal,
      items: itemsFinal,
      debug: {
        siteTimezone,
        userTimezone,
        shouldUpdateDisplayDate,
        todayDate
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get daily items" });
  }
});

router.post('/save-item', async (req, res) => {
  try {
    const { _id, field, value } = req.body;
    if (!_id || !field || value === undefined) {
      return res.status(400).json({ message: "Item ID, field, and value are required." });
    }
    if (!['foh', 'boh'].includes(field)) {
      return res.status(400).json({ message: "Field must be 'foh' or 'boh'." });
    }

    await CycleCount.findByIdAndUpdate(
      _id,
      {
        $set: {
          [field]: value === "" || value == null ? 0 : Number(value),
          flagged: false,
          updatedAt: new Date()
        }
      }
    );

    res.json({ message: "Item field saved successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save item field." });
  }
});

router.post('/save-counts', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items to update." });
    }

    for (const entry of items) {
      if (!entry._id) continue;

      const foh = entry.foh === "" || entry.foh == null ? 0 : Number(entry.foh);
      const boh = entry.boh === "" || entry.boh == null ? 0 : Number(entry.boh);

      await CycleCount.findByIdAndUpdate(
        entry._id,
        {
          $set: {
            foh,
            boh,
            flagged: false,
            updatedAt: new Date()
          }
        }
      );
    }

    req.app.get("io").emit("cycle-count-updated", { site: req.body.site });

    res.json({ message: "Counts saved successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save counts." });
  }
});

router.get('/counted-today', async (req, res) => {
  try {
    const { site } = req.query;
    if (!site) return res.status(400).json({ message: "site is required" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    console.log("CYCLE COUNT RANGE", today, "-->", tomorrow);

    const count = await CycleCount.countDocuments({
      site: site.toString().trim(),
      updatedAt: { $gte: today, $lt: tomorrow }
    });

    res.json({ site, countedToday: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get today's count." });
  }
});

// router.get('/daily-counts', async (req, res) => {
//   try {
//     const { site, startDate, endDate, timezone = 'UTC' } = req.query;
//     if (!site || !startDate || !endDate) {
//       return res.status(400).json({ message: "site, startDate, and endDate are required" });
//     }

//     const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
//     const end = DateTime.fromISO(endDate, { zone: timezone }).endOf('day');

//     // Get all entries in the date range
//     const entries = await CycleCount.find({
//       site: site.toString().trim(),
//       updatedAt: {
//         $gte: start.toJSDate(),
//         $lte: end.toJSDate()
//       }
//     });

//     // Count per day
//     const counts = {};
//     let cursor = start;
//     while (cursor <= end) {
//       const dayStart = cursor;
//       const dayEnd = cursor.plus({ days: 1 });
//       const dayKey = dayStart.toISODate();

//       counts[dayKey] = entries.filter(e => {
//         const updated = DateTime.fromJSDate(e.updatedAt).setZone(timezone);
//         return updated >= dayStart && updated < dayEnd;
//       }).length;

//       cursor = dayEnd;
//     }

//     // Convert counts to array for chart compatibility
//     const data = Object.entries(counts).map(([date, count]) => ({
//       date,
//       count
//     }));

//     res.json({ site, data });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to get daily counts." });
//   }
// });

router.get('/daily-counts', async (req, res) => {
  try {
    const { site, startDate, endDate, timezone = 'UTC' } = req.query;
    if (!site || !startDate || !endDate) {
      return res.status(400).json({ message: "site, startDate, and endDate are required" });
    }

    const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
    const end = DateTime.fromISO(endDate, { zone: timezone }).endOf('day');

    // Fetch all entries in the date range
    const entries = await CycleCount.find({
      site: site.toString().trim(),
      updatedAt: { $gte: start.toJSDate(), $lte: end.toJSDate() },
    });

    // Initialize per-day structure
    const dailyData = {};

    let cursor = start;
    while (cursor <= end) {
      const dayStart = cursor;
      const dayEnd = cursor.plus({ days: 1 });
      const dayKey = dayStart.toISODate();

      // Filter entries for this day
      const dayEntries = entries.filter(e => {
        const updated = DateTime.fromJSDate(e.updatedAt).setZone(timezone);
        return updated >= dayStart && updated < dayEnd;
      });

      dailyData[dayKey] = {
        count: dayEntries.length,
        items: dayEntries.map(e => ({
          name: e.name,
          upc_barcode: e.upc_barcode,
          totalQty: (e.foh ?? 0) + (e.boh ?? 0),
        })),
      };

      cursor = dayEnd;
    }

    // Convert to array for frontend compatibility
    const data = Object.entries(dailyData).map(([date, { count, items }]) => ({
      date,
      count,
      items,
    }));
    // const specificDate = "2025-11-14"; // replace with your date
    // const itemsForDate = dailyData[specificDate]?.items || [];
    // itemsForDate.forEach(item => {
    //   console.log(item.name, item.upc_barcode, item.totalQty);
    // });


    res.json({ site, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get daily counts." });
  }
});

router.get('/lookup', async (req, res) => {
  const { upc_barcode, site } = req.query;
  if (!upc_barcode || !site) return res.status(400).json({ error: "UPC barcode and site required" });
  const item = await CycleCount.findOne({ upc_barcode, site });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

// router.get('/current-inventory', async (req, res) => {
//   try {
//     const { site, limit } = req.query;  // ✅ Accept limit parameter
//     if (!site) return res.status(400).json({ message: "site is required" });

//     const limitNum = limit ? parseInt(limit, 10) : null;
//     const inventory = await getCurrentInventory(site, limitNum);  // ✅ Pass limit
//     res.json({ site, inventory });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to get current inventory." });
//   }
// });
router.get('/current-inventory', async (req, res) => {
  try {
    const { site, limit } = req.query;
    if (!site) return res.status(400).json({ message: "site is required" });

    const limitNum = limit ? parseInt(limit, 10) : null;

    // 1️⃣ Get inventory from SQL
    const inventory = await getCurrentInventory(site, limitNum); // inventory is array of objects with UPC

    // 2️⃣ Extract all UPCs from SQL inventory
    const upcs = inventory.map(item => item.UPC);

    // 3️⃣ Query MongoDB for cycle-counts matching these UPCs + site
    // Assuming you have a Mongo collection called "CycleCount"
    const cycleCounts = await CycleCount.find({
      site,
      upc_barcode: { $in: upcs }
    }).select({ upc_barcode: 1, updatedAt: 1, foh: 1, boh: 1 }).lean();

    // 4️⃣ Create a map for fast lookup
    const cycleMap = new Map();
    cycleCounts.forEach(c => {
      cycleMap.set(c.upc_barcode, { updatedAt: c.updatedAt, foh: c.foh || 0, boh: c.boh || 0 });
    });

    // 5️⃣ Merge updatedAt and cycleCount into inventory
    const enrichedInventory = inventory.map(item => {
      const cycle = cycleMap.get(item.UPC);
      return {
        ...item,
        updatedAt: cycle?.updatedAt || null,
        cycleCount: cycle ? (cycle.foh + cycle.boh) : null
      };
    });

    res.json({ site, inventory: enrichedInventory });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get current inventory." });
  }
});


router.get('/inventory-categories', async (req, res) => {
  try {
    const { site } = req.query;
    if (!site) return res.status(400).json({ message: "site is required" });

    const categories = await getInventoryCategories(site);
    res.json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get categories." });
  }
});

module.exports = router;