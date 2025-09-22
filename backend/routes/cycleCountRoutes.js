const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
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
      let siteName = String(row[0]).replace(/Gen 7/gi, '').trim();

      const item = {
        site: siteName,
        upc: row[1],
        name: row[2],
        category: row[5] || "",
        grade: row[23] || "",
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
    const { site, chunkSize = 20 } = req.query;
    if (!site) return res.status(400).json({ message: "site is required" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // 1. Fetch flagged items (top)
    const flaggedItemsRaw = await CycleCount.find({ site: site.toString().trim(), flagged: true });
    const flaggedItems = CycleCount.sortItems(flaggedItemsRaw).slice(0, 5);
    const flaggedCount = flaggedItems.length;

    const chunk = parseInt(chunkSize, 10);
    const dailyCount = Math.max(chunk - flaggedCount, 0);

    // 2. Fetch all unflagged items for the site
    const allUnflagged = await CycleCount.find({
      site: site.toString().trim(),
      flagged: false
    });

    // 3. All unflagged items counted today (priority)
    const todayItems = allUnflagged.filter(i => i.updatedAt >= today && i.updatedAt < tomorrow);

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
    grades.forEach(grade => {
      notTodayByGrade[grade] = allUnflagged
        .filter(i => i.grade === grade && !(i.updatedAt >= today && i.updatedAt < tomorrow));
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

// router.get('/daily-items', async (req, res) => {
//   try {
//     const { site, chunkSize = 20 } = req.query;
//     if (!site) return res.status(400).json({ message: "site is required" });

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

//     // Get all unflagged items for the site
//     const allItems = await CycleCount.find({
//       site: site.toString().trim(),
//       flagged: false
//     });

//     // Split by grade
//     const grades = ["A", "B", "C"];
//     const itemsByGrade = {};
//     grades.forEach(grade => {
//       itemsByGrade[grade] = allItems.filter(i => i.grade === grade);
//     });

//     // Get today's items by grade
//     const todayItemsByGrade = {};
//     grades.forEach(grade => {
//       todayItemsByGrade[grade] = itemsByGrade[grade].filter(i => i.updatedAt >= today && i.updatedAt < tomorrow);
//     });

//     // Calculate how many of each grade are needed
//     const groupSize = 6;
//     const chunk = parseInt(chunkSize, 10);
//     const groups = Math.floor(chunk / groupSize);
//     const remainder = chunk % groupSize;

//     const numA = 3 * groups + remainder;
//     const numB = 2 * groups;
//     const numC = 1 * groups;

//     // Start with today's items
//     let selectedA = CycleCount.sortItems(todayItemsByGrade["A"]).slice(0, numA);
//     let selectedB = CycleCount.sortItems(todayItemsByGrade["B"]).slice(0, numB);
//     let selectedC = CycleCount.sortItems(todayItemsByGrade["C"]).slice(0, numC);

//     // Fill up with oldest items if not enough for today
//     if (selectedA.length < numA) {
//       const needed = numA - selectedA.length;
//       const notTodayA = CycleCount.sortItems(itemsByGrade["A"].filter(i => !(i.updatedAt >= today && i.updatedAt < tomorrow) && !selectedA.some(a => a._id.equals(i._id))));
//       selectedA = [...selectedA, ...notTodayA.slice(0, needed)];
//     }
//     if (selectedB.length < numB) {
//       const needed = numB - selectedB.length;
//       const notTodayB = CycleCount.sortItems(itemsByGrade["B"].filter(i => !(i.updatedAt >= today && i.updatedAt < tomorrow) && !selectedB.some(b => b._id.equals(i._id))));
//       selectedB = [...selectedB, ...notTodayB.slice(0, needed)];
//     }
//     if (selectedC.length < numC) {
//       const needed = numC - selectedC.length;
//       const notTodayC = CycleCount.sortItems(itemsByGrade["C"].filter(i => !(i.updatedAt >= today && i.updatedAt < tomorrow) && !selectedC.some(c => c._id.equals(i._id))));
//       selectedC = [...selectedC, ...notTodayC.slice(0, needed)];
//     }

//     // Fetch flagged items for the site
//     const flaggedItemsRaw = await CycleCount.find({ site: site.toString().trim(), flagged: true });
//     const flaggedItems = CycleCount.sortItems(flaggedItemsRaw).slice(0, 5);

//     const flaggedCount = flaggedItems.length;
//     const dailyCount = Math.max(chunk - flaggedCount, 0);

//     const result = [...selectedA, ...selectedB, ...selectedC];
 

//     res.json({
//       flaggedItems,
//       items: result
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to get daily items" });
//   }
// });

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

module.exports = router;