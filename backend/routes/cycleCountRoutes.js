const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { DateTime } = require('luxon');
const CycleCount = require('../models/CycleCount');

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
    const { site, chunkSize = 20, timezone = 'UTC' } = req.query;
    if (!site) return res.status(400).json({ message: "site is required" });

    // const today = new Date();
    // today.setHours(0, 0, 0, 0);
    // const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Get the start and end of today in the user's timezone, then convert to UTC
    const now = DateTime.now().setZone(timezone);
    const todayStart = now.startOf('day').toUTC();
    console.log("TODAY START (UTC):", todayStart.toISO());
    const tomorrowStart = todayStart.plus({ days: 1 });
    console.log("TOMORROW START (UTC):", tomorrowStart.toISO());

    // 1. Fetch flagged items (top)
    const flaggedItemsRaw = await CycleCount.find({ site: site.toString().trim(), flagged: true });
    const flaggedItems = CycleCount.sortFlaggedItems(flaggedItemsRaw).slice(0, 5);
    const flaggedCount = flaggedItems.length;

    const chunk = parseInt(chunkSize, 10);
    const dailyCount = Math.max(chunk - flaggedCount, 0); // number of items on today's list

    // 2. Fetch all unflagged items for the site
    let allUnflagged = await CycleCount.find({
      site: site.toString().trim(),
      flagged: false
    });
    allUnflagged = CycleCount.sortItems(allUnflagged);

    // 3. All unflagged items counted today (priority)
    // const todayItems = allUnflagged.filter(i => i.updatedAt >= today && i.updatedAt < tomorrow); // NEED TO CHECK UTC
    const todayItems = allUnflagged.filter(i =>
      DateTime.fromJSDate(i.updatedAt).toUTC() >= todayStart &&
      DateTime.fromJSDate(i.updatedAt).toUTC() < tomorrowStart
    );

    // 4. Calculate how many more items are needed
    const todayCount = todayItems.length;
    const moreNeeded = Math.max(dailyCount - todayCount, 0);

    // 5. For the remainder, use the A/B/C algorithm, EXCLUDING today's items
    const grades = ["A", "B", "C"];
    const groupSize = 6;
    const groups = Math.floor(moreNeeded / groupSize);
    const remainder = moreNeeded % groupSize;

    const numA = 3 * groups + remainder;
    const numB = 2 * groups;
    const numC = 1 * groups;

    // Exclude today's items from the pool
    const notTodayByGrade = {};
    // grades.forEach(grade => {
    //   notTodayByGrade[grade] = allUnflagged
    //     .filter(i => i.grade === grade && !(i.updatedAt >= today && i.updatedAt < tomorrow));
    // });
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

    // 6. Combine today's items (all grades) and the A/B/C breakdown for the rest
    const result = [
      ...CycleCount.sortItems(todayItems), // all today's unflagged items first
      ...selectedA,
      ...selectedB,
      ...selectedC
    ].slice(0, dailyCount); // ensure we don't exceed dailyCount

    res.json({
      flaggedItems,
      items: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get daily items" });
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

router.get('/daily-counts', async (req, res) => {
  try {
    const { site, startDate, endDate, timezone = 'UTC' } = req.query;
    if (!site || !startDate || !endDate) {
      return res.status(400).json({ message: "site, startDate, and endDate are required" });
    }

    const start = DateTime.fromISO(startDate, { zone: timezone }).startOf('day');
    const end = DateTime.fromISO(endDate, { zone: timezone }).endOf('day');

    // Get all entries in the date range
    const entries = await CycleCount.find({
      site: site.toString().trim(),
      updatedAt: {
        $gte: start.toJSDate(),
        $lte: end.toJSDate()
      }
    });

    // Count per day
    const counts = {};
    let cursor = start;
    while (cursor <= end) {
      const dayStart = cursor;
      const dayEnd = cursor.plus({ days: 1 });
      const dayKey = dayStart.toISODate();

      counts[dayKey] = entries.filter(e => {
        const updated = DateTime.fromJSDate(e.updatedAt).setZone(timezone);
        return updated >= dayStart && updated < dayEnd;
      }).length;

      cursor = dayEnd;
    }

    // Convert counts to array for chart compatibility
    const data = Object.entries(counts).map(([date, count]) => ({
      date,
      count
    }));

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

module.exports = router;