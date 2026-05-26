const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const { DateTime } = require('luxon');
const CycleCount = require('../models/CycleCount');
const Location = require('../models/Location');
const User = require('../models/User');
const { getCurrentInventory, getInventoryCategories, getBulkOnHandQtyCSO } = require('../services/sqlService');
const { updateCycleCountCSO } = require('../cron_jobs/cycleCountCron');
const ProductCategory = require('../models/ProductCategory');
const { getPg } = require("../config/pg");
const moment = require("moment-timezone");

const upload = multer({ storage: multer.memoryStorage() });

function hasCountValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

function isCountSideComplete(row, field) {
  if (!hasCountValue(row[field])) return false;
  if (row.pk_in_crt && !hasCountValue(row[`${field}_crt`])) return false;
  if (row.pk_in_crt && row.crt_in_case && !hasCountValue(row[`${field}_case`])) return false;
  return true;
}

function isCountComplete(row) {
  return isCountSideComplete(row, "foh") && isCountSideComplete(row, "boh");
}

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
      flaggedDisplayDate: todayDate,
      inventoryExists: true
    }).lean();

    // Regular items: those with displayDate set to today, but NOT flaggedDisplayDate
    const items = await CycleCount.find({
      site: site.toString().trim(),
      displayDate: todayDate,
      $or: [
        { flaggedDisplayDate: { $ne: todayDate } },
        { flaggedDisplayDate: { $exists: false } }
      ],
      inventoryExists: true
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
    const flaggedItemsRaw = await CycleCount.find({ site: site.toString().trim(), flagged: true, inventoryExists: true });
    const flaggedSelected = CycleCount.sortFlaggedItems(flaggedItemsRaw).slice(0, 5);
    const flaggedCount = flaggedSelected.length;

    const chunk = parseInt(chunkSize, 10);
    const dailyCount = Math.max(chunk - flaggedCount, 0); // number of items on today's list

    // Fetch all unflagged items for the site
    let allUnflagged = await CycleCount.find({
      site: site.toString().trim(),
      flagged: false,
      inventoryExists: true
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

    const allGTINs = [
      ...flaggedSelected.map(i => i.gtin),
      ...regularSelected.map(i => i.gtin)
    ];
    const uniqueGTINs = [...new Set(allGTINs)];
    const csoQtyMap = await getBulkOnHandQtyCSO(site, uniqueGTINs);

    const bulkOps = [];

    for (const item of [...flaggedSelected, ...regularSelected]) {
      const qty = csoQtyMap[item.gtin] ?? 0;

      bulkOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { onHandCSO: qty } }
        }
      });
    }

    if (bulkOps.length > 0) {
      await CycleCount.bulkWrite(bulkOps, { timestamps: false }); // prevents updatedAt change
    }


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

router.get('/daily-items-v2', async (req, res) => {
  try {
    const { site } = req.query;
    const db = getPg();
    console.log("Fetching daily items for site:", site);

    // 1. Get Site & Categories from Mongo
    const [location, mongoCategories] = await Promise.all([
      Location.findOne({ stationName: site }),
      ProductCategory.find({}).lean()
    ]);

    if (!location) return res.status(404).json({ message: "Location not found" });

    // Create a lookup: { "10": "Beverages" }
    const categoryMap = mongoCategories.reduce((acc, cat) => {
      acc[cat.Number] = cat.Name;
      return acc;
    }, {});

    // 2. Calculate local date
    const stationTimezone = location.timezone || "UTC";
    const localDateStr = moment().tz(stationTimezone).format("YYYY-MM-DD");

    // 3. Fetch Items from Postgres
    const items = await db("cycle_count_instance as i")
      .join("cycle_count_items as ci", "i.id", "ci.instance_id")
      .join("item_bk as ib", "ci.product_id", "ib.id")
      .where({
        "i.site_mongo_id": location._id.toString(),
        "i.date": localDateStr
      })
      .select(
        "ci.id as entryId",
        "ci.foh",
        "ci.boh",
        "ci.foh_crt",
        "ci.boh_crt",
        "ci.foh_case",
        "ci.boh_case",
        "ci.priority",
        "ib.id as productId",
        "ib.description as name",
        "ib.upc_barcode",
        "ib.image_url",
        "ib.category_id",
        "ib.pk_in_crt",
        "ib.crt_in_case",
        "ib.on_hand_qty as onHandCSO"
      )
      .orderBy("ci.priority", "desc");

    // 4. Attach Category Names
    const enrichedItems = items.map(item => ({
      ...item,
      categoryName: categoryMap[item.category_id] || `Uncategorized (${item.category_id})`
    }));

    res.json({ items: enrichedItems });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.get('/item-bk', async (req, res) => {
  try {
    const { site } = req.query;
    if (!site) {
      return res.status(400).json({ message: "Site parameter is required" });
    }

    const db = getPg();
    console.log("Admin Panel: Fetching item book for site name:", site);

    // 1. Get Site details and Mongo categories simultaneously
    const [location, mongoCategories] = await Promise.all([
      Location.findOne({ stationName: site }),
      ProductCategory.find({}).lean()
    ]);

    if (!location) {
      return res.status(404).json({ message: `Location '${site}' not found` });
    }

    // Convert the site's Mongo ObjectId to its string representation matching item_bk.site
    const siteMongoIdString = location._id.toString();

    // Create a lookup map: { 10: "Beverages" }
    const categoryMap = mongoCategories.reduce((acc, cat) => {
      acc[cat.Number] = cat.Name;
      return acc;
    }, {});

    // 2. Query Postgres item_bk for this specific site configuration
    const items = await db("item_bk")
      .where({ site: siteMongoIdString })
      .select(
        "id",
        "gtin",
        "upc",
        "upc_barcode",
        "description",
        "retail",
        "vendor_id",
        "vendor_name",
        "category_id",
        "department_id",
        "department",
        "price_group_id",
        "price_group",
        "promo_group_id",
        "promo_group",
        "active as is_active",
        "on_hand_qty",
        "pk_in_crt",
        "crt_in_case",
        "last_counted_at",
        "last_inv_date",
        "grade",
        "allow_cycle_count",
        "image_url"
      )
      .orderBy("description", "asc");

    // 3. Attach category names inline using our Mongo lookup map
    const enrichedItems = items.map(item => ({
      ...item,
      categoryName: categoryMap[item.category_id] || `Uncategorized (${item.category_id})`
    }));

    res.json({ items: enrichedItems });
  } catch (err) {
    console.error("Error in /api/cycle-count/item-bk:", err);
    res.status(500).send("Server Error");
  }
});

router.get('/groups', async (req, res) => {
  try {
    const db = getPg();

    // Fetch groups and count how many active values each has mapped
    const groups = await db('public.cycle_count_groups as g')
      .leftJoin('public.cycle_count_group_values as v', 'g.id', 'v.group_id')
      .select('g.id', 'g.name', 'g.filter_column', 'g.created_at')
      .count('v.id as values_count')
      .where('g.is_active', true)
      .groupBy('g.id', 'g.name', 'g.filter_column', 'g.created_at')
      .orderBy('g.created_at', 'desc');

    res.json(groups);
  } catch (err) {
    console.error("Error matching cycle count group lists:", err);
    res.status(500).send("Server Error");
  }
});

// 1. Get filterable columns directly from the DB schema definitions
router.get('/groups/filterable-columns', async (req, res) => {
  try {
    const db = getPg();
    // Exclude operational/large unique fields that aren't useful for grouping
    const excludedColumns = ['id', 'gtin', 'upc', 'upc_barcode', 'image_url', 'sync_date', 'last_inv_date', 'on_hand_qty', 'retail'];

    const columnsInfo = await db('information_schema.columns')
      .where({ table_schema: 'public', table_name: 'item_bk' })
      .select('column_name');

    const columns = columnsInfo
      .map(c => c.column_name)
      .filter(col => !excludedColumns.includes(col));

    res.json({ columns });
  } catch (err) {
    console.error("Error fetching schema columns:", err);
    res.status(500).send("Server Error");
  }
});

// 2. Fetch unique values for a chosen column safely and quickly
router.get('/groups/unique-values', async (req, res) => {
  const { column } = req.query;

  try {
    if (!column) {
      return res.status(400).json({ message: "Column parameter is required" });
    }

    const db = getPg();

    // 1. Build the base query checking for null values
    let query = db('public.item_bk')
      .distinct(column)
      .whereNotNull(column);

    // 2. Only add empty string exclusion if we aren't querying integer columns
    if (column !== 'category_id' && !column.endsWith('_id')) {
      query = query.where(column, '!=', '');
    }

    // 3. Execute with ordering and safety limit
    const uniqueRecords = await query
      .orderBy(column, 'asc')
      .limit(1000);

    // Standard raw string value map
    let values = uniqueRecords.map(r => String(r[column]));

    // 4. Special Mapping logic if category_id is targeted
    if (column === 'category_id') {
      // Assuming your mongo connection/model is accessible here
      // Pulling from your categories collection matching your preview setup
      const mongoCategories = await ProductCategory.find({}).lean();

      const categoryMap = mongoCategories.reduce((acc, cat) => {
        acc[cat.Number] = cat.Name;
        return acc;
      }, {});

      // Map array into a combination structure or array of metadata objects
      // To keep standard string formats clean but descriptive, we return a structured layout
      // Or you can return objects. Let's return objects if category_id, or strings otherwise.
      // To keep things uniform, let's map them to a uniform payload array:
      const processedValues = uniqueRecords.map(r => {
        const catId = String(r[column]);
        return {
          id: catId,
          displayName: categoryMap[catId] ? `${catId} - ${categoryMap[catId]}` : catId
        };
      });

      return res.json({ values: processedValues, isCategory: true });
    }

    // Standard string fallback for text-based columns
    const standardValues = values.map(val => ({ id: val, displayName: val }));
    res.json({ values: standardValues, isCategory: false });

  } catch (err) {
    console.error(`Error pulling unique values for column ${column || 'unknown'}:`, err);
    res.status(500).send("Server Error");
  }
});

// 4. On-Demand Preview Endpoint using high-speed database filters
router.get('/groups/preview-items', async (req, res) => {
  try {
    const { site, column, values } = req.query;

    if (!site || !column) {
      return res.status(400).json({ message: "Site and Target Column parameters are required" });
    }

    // Safely parse values array if provided as a comma-separated string or query array
    let parsedValues = [];
    if (values) {
      parsedValues = Array.isArray(values) ? values : String(values).split(',');
    }

    const db = getPg();

    // 1. Resolve Site details and Mongo categories concurrently
    const [location, mongoCategories] = await Promise.all([
      Location.findOne({ stationName: site }),
      ProductCategory.find({}).lean()
    ]);

    if (!location) {
      return res.status(404).json({ message: `Location '${site}' not found` });
    }

    const siteMongoIdString = location._id.toString();
    const categoryMap = mongoCategories.reduce((acc, cat) => {
      acc[cat.Number] = cat.Name;
      return acc;
    }, {});

    // 2. Build the base high-speed query state
    let baseQuery = db("public.item_bk").where({ site: siteMongoIdString });

    // Only apply value rules if the user has tokens selected
    if (parsedValues.length > 0) {
      baseQuery = baseQuery.whereIn(column, parsedValues);
    }

    // 3. Execute count query over the exact same filter criteria
    const countResult = await baseQuery.clone().count('id as total');
    const totalMatchingItems = parseInt(countResult[0]?.total || '0', 10);

    // 4. Fetch the payload bounded by the safety cap
    const items = await baseQuery
      .select(
        "id",
        "upc_barcode",
        "description",
        "category_id",
        "on_hand_qty",
        column // Dynamically include the chosen target filter column
      )
      .orderBy("description", "asc")
      .limit(200);

    // 5. Map category labels smoothly
    const enrichedItems = items.map(item => ({
      ...item,
      categoryName: categoryMap[item.category_id] || `Uncategorized (${item.category_id})`
    }));

    // Return both the items array and total calculation metrics
    res.json({
      items: enrichedItems,
      totalCount: totalMatchingItems
    });
  } catch (err) {
    console.error("Error generating live group item previews:", err);
    res.status(500).send("Server Error");
  }
});


router.get('/instances', async (req, res) => {
  try {
    const { site } = req.query;
    if (!site) {
      return res.status(400).json({ message: "Site parameter is required" });
    }

    // 1. Fetch site mapping from MongoDB to get _id and timezone
    const location = await Location.findOne({ stationName: site });
    if (!location) {
      return res.status(404).json({ message: `Location '${site}' not found` });
    }

    const siteMongoIdString = location._id.toString();
    const siteTimezone = location.timezone || 'UTC';

    // 2. Determine today's date in the target station's local timezone
    // Format matches 'YYYY-MM-DD' to safely string-compare if your text field uses standard layouts
    const stationTodayStr = DateTime.now().setZone(siteTimezone).toFormat('yyyy-MM-dd');

    const db = getPg();

    // 3. Query PostgreSQL for records >= today's date for this station
    // Adjust order by date ascending so closest upcoming events show first
    const instances = await db("public.cycle_count_instance")
      .where({ site_mongo_id: siteMongoIdString })
      .andWhere("date", ">=", stationTodayStr)
      .select(
        "id",
        "date",
        "day",
        "is_scheduled",
        "site_mongo_id",
        "scheduled_by",
        "group_id"
      )
      .orderBy("date", "asc");

    res.json({ instances });
  } catch (err) {
    console.error("Error in GET /api/cycle-count/instances:", err);
    res.status(500).send("Server Error");
  }
});

// 1. DATE DUPLICATION SOFT CHECK
router.get('/schedules/check-date', async (req, res) => {
  try {
    const { site, date } = req.query;
    if (!site || !date) {
      return res.status(400).json({ message: "Site and date string are required" });
    }

    const location = await Location.findOne({ stationName: site });
    if (!location) {
      return res.status(404).json({ message: "Location structure not found" });
    }

    const db = getPg();
    const existing = await db("public.cycle_count_instance")
      .where({
        site_mongo_id: location._id.toString(),
        date: date
      })
      .first();

    return res.json({ alreadyExists: !!existing });
  } catch (err) {
    console.error("Error in date validation check:", err);
    res.status(500).json({ message: "Server date verification breakdown" });
  }
});

// 2. FETCH ACTIVE GROUPS & EXPOSE EMBEDDED FILTER TOKENS
router.get('/groups/active-rules', async (req, res) => {
  try {
    const db = getPg();

    // Query active master groups
    const groups = await db("public.cycle_count_groups")
      .select("id", "name", "filter_column")
      .where("is_active", true)
      .orderBy("name", "asc");

    // Fetch related array conditions simultaneously
    const values = await db("public.cycle_count_group_values")
      .select("group_id", "value");

    // Group the array properties by master group mapping
    const structuredRules = groups.map(group => ({
      ...group,
      allowedValues: values
        .filter(v => v.group_id === group.id)
        .map(v => v.value)
    }));

    res.json({ groups: structuredRules });
  } catch (err) {
    console.error("Error fetching execution rule definitions:", err);
    res.status(500).json({ message: "Error mapping rules" });
  }
});

// GET LIGHTWEIGHT LIST OF PRODUCTS FOR SELECTION DIALOG (SCOPED BY STATION SITE)
router.get('/schedules/items/search', async (req, res) => {
  try {
    const { query, siteMongoId } = req.query; // Capture both lookup queries
    const db = getPg();

    if (!siteMongoId) {
      return res.status(400).json({ message: "Bad Request: Target siteMongoId contextual parameter tracker is required." });
    }

    // Initialize base query with absolute strict mapping to the specified station store entity context trace
    let sqlQuery = db("public.item_bk")
      .where({ site: String(siteMongoId) }) // <-- Lock database search strictly to this store site map
      .select("id", "upc_barcode", "description", "category_id", "on_hand_qty")
      .orderBy("on_hand_qty", "asc");

    // Server-Side optimized search filter condition branches
    if (query && query.trim().length >= 3) {
      const searchPattern = `%${query.trim()}%`;
      sqlQuery = sqlQuery.where(function () {
        this.where("description", "ILIKE", searchPattern)
          .orWhere("upc_barcode", "ILIKE", searchPattern)
          .orWhere(db.raw("CAST(category_id AS TEXT)"), "ILIKE", searchPattern);
      });

      // Limit search hits payload so network streams stay highly performant
      sqlQuery = sqlQuery.limit(100);
    } else {
      // Default initial view boundary payload limit
      sqlQuery = sqlQuery.limit(50);
    }

    const items = await sqlQuery;

    // Resolve Mongo categories to append strings
    const mongoCategories = await ProductCategory.find({}).lean();
    const categoryMap = mongoCategories.reduce((acc, cat) => {
      acc[cat.Number] = cat.Name;
      return acc;
    }, {});

    const sanitizedItems = items.map(item => ({
      id: item.id,
      upc: item.upc_barcode || 'N/A',
      description: item.description,
      on_hand_qty: Number(item.on_hand_qty || 0),
      categoryName: categoryMap[item.category_id] || `Category ${item.category_id}`
    }));

    return res.json(sanitizedItems);
  } catch (err) {
    console.error("Error executing lightweight catalog indexes fetch lookup:", err);
    return res.status(500).json({ message: "Server error querying target item book indices." });
  }
});


// FETCH AN INDIVIDUAL INSTANCE PROFILE WITH ENRICHED CHILD ITEMS MATRIX
router.get('/schedules/details/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Schedule Instance ID parameter is required" });
    }

    const db = getPg();
    const User = require("../models/User"); // Adjust path to your User model asset reference

    // 1. Fetch details safely (updated_by query bypass handled dynamically via your structural schema updates)
    // Note: We try to grab updated_by from pg if it exists, or select it safely down the line
    let instance;
    try {
      instance = await db("public.cycle_count_instance")
        .where({ id })
        .select("id", "date", "day", "is_scheduled", "site_mongo_id", "scheduled_by", "updated_by")
        .first();
    } catch (sqlErr) {
      // Fallback fallback mechanism block if the column structurally hasn't been migrated yet
      instance = await db("public.cycle_count_instance")
        .where({ id })
        .select("id", "date", "day", "is_scheduled", "site_mongo_id", "scheduled_by")
        .first();
      if (instance) instance.updated_by = null;
    }

    if (!instance) {
      return res.status(404).json({ message: `Schedule instance with ID ${id} not found` });
    }

    // 2. Resolve Station context, Mongo categories, and human User profiles concurrently
    const promises = [
      Location.findById(instance.site_mongo_id),
      ProductCategory.find({}).lean()
    ];

    // Push conditional user queries only if valid hexadecimal object links exist
    if (instance.scheduled_by && mongoose.Types.ObjectId.isValid(instance.scheduled_by)) {
      promises.push(User.findById(instance.scheduled_by).lean());
    } else {
      promises.push(Promise.resolve(null));
    }

    if (instance.updated_by && mongoose.Types.ObjectId.isValid(instance.updated_by)) {
      promises.push(User.findById(instance.updated_by).lean());
    } else {
      promises.push(Promise.resolve(null));
    }

    const [location, mongoCategories, scheduledByUser, updatedByUser] = await Promise.all(promises);

    if (!location) {
      return res.status(404).json({ message: "Assigned station context location records missing" });
    }

    const categoryMap = mongoCategories.reduce((acc, cat) => {
      acc[cat.Number] = cat.Name;
      return acc;
    }, {});

    // 3. Query PostgreSQL relational table with item_bk fields
    const items = await db("public.cycle_count_items as cci")
      .join("public.item_bk as ib", "cci.product_id", "ib.id")
      .where({ "cci.instance_id": id })
      .select(
        "ib.id as product_id",
        "cci.id as cycle_count_item_id",
        "cci.priority as priority",
        "ib.description",
        "ib.upc",
        "ib.upc_barcode",
        "ib.image_url",
        "ib.on_hand_qty",
        "ib.grade",
        "ib.category_id",
        "cci.count_completed",
        "cci.foh",
        "cci.boh"
      )
      .orderBy("ib.description", "asc");

    const enrichedItems = items.map(item => {
      const catId = item.category_id;
      return {
        ...item,
        categoryName: categoryMap[catId] || `Uncategorized (${catId})`
      };
    });

    // 4. Safely construct human readable names
    const scheduledByName = scheduledByUser
      ? `${scheduledByUser.firstName} ${scheduledByUser.lastName}`
      : (instance.scheduled_by || null);

    const updatedByName = updatedByUser
      ? `${updatedByUser.firstName} ${updatedByUser.lastName}`
      : (instance.updated_by || null);

    // 5. Send fully aggregated response
    res.json({
      instanceData: {
        id: instance.id,
        date: instance.date,
        day: instance.day,
        is_scheduled: !!instance.is_scheduled,
        site_mongo_id: instance.site_mongo_id,
        scheduled_by: scheduledByName,
        updated_by: updatedByName
      },
      stationTimezone: location.timezone || 'America/New_York',
      itemsData: enrichedItems
    });

  } catch (err) {
    console.error(`Error aggregating profile detail matrices for schedule instance ${req.params.id}:`, err);
    res.status(500).send("Server Error tracking schedule context elements");
  }
});

// 1. GET - Fetch an individual group and its selected values
router.get('/groups/:id', async (req, res) => {
  const db = getPg();
  const { id } = req.params;

  try {
    const group = await db('public.cycle_count_groups').where({ id }).andWhere('is_active', true).first();
    if (!group) {
      return res.status(404).json({ message: "Cycle count group not found" });
    }

    const assignedValues = await db('public.cycle_count_group_values')
      .where({ group_id: id })
      .select('value');

    // Return flattened array of value strings to make state population simple
    res.json({
      ...group,
      values: assignedValues.map(v => v.value)
    });
  } catch (err) {
    console.error("Failed to fetch cycle count group details:", err);
    res.status(500).json({ message: "Server error fetching group details" });
  }
});

// PUT ROUTE: APPEND MULTIPLE SELECTED ITEMS INTO AN INSTANCE
router.put('/schedules/details/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { productIds } = req.body; // Array of product IDs to add

    const userIdStr = req.user?._id || req.user?.firstName || "system_operator";

    if (!id || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Invalid payload params structural map." });
    }

    const db = getPg();

    // 1. STRICT VALIDATION: Check if any of these items are already in today's instance list
    // AND fetch their descriptions from the item_bk table
    const existingItems = await db("public.cycle_count_items as cci")
      .join("public.item_bk as bk", "cci.product_id", "bk.id") // Adjust 'bk.id' if your primary key name is different (e.g., bk.product_id)
      .where("cci.instance_id", id)
      .whereIn("cci.product_id", productIds)
      .select("cci.product_id", "bk.description", "bk.upc_barcode"); // Pull both ID and description

    if (existingItems.length > 0) {
      // Create a readable list of descriptions (e.g., "Apple iPhone 15, Sony Headphones")
      const duplicateDetails = existingItems.map(item => `${item.description} (${item.upc_barcode})`);

      return res.status(400).json({
        message: `Validation Error: The following products are already in today's list: ${duplicateDetails.join(', ')}`
      });
    }
    // 2. Double check current aggregate sizing safety threshold rules on the server side
    const currentItemsCount = await db("public.cycle_count_items")
      .where({ instance_id: id })
      .count("id as count")
      .first();

    const currentTotal = parseInt(currentItemsCount.count || "0", 10);

    // Check if configuration structural conditions apply
    const instance = await db("public.cycle_count_instance").where({ id }).select("is_scheduled").first();

    if (!instance) {
      return res.status(404).json({ message: "Cycle count instance not found." });
    }

    if (!instance.is_scheduled && (currentTotal + productIds.length) > 20) {
      return res.status(400).json({
        message: `Validation Error: This draft sequence cannot exceed 20 total items. Currently has ${currentTotal}.`
      });
    }

    // 3. Perform safe batch insert transactions
    await db.transaction(async (trx) => {
      const rowsToInsert = productIds.map(pid => ({
        instance_id: id,
        product_id: pid,
        count_completed: false,
        foh: null,
        boh: null,
        priority: true
      }));

      await trx("public.cycle_count_items").insert(rowsToInsert);

      // 4. Update the audit trail metadata on the parent instance 
      await trx("public.cycle_count_instance")
        .where({ id })
        .update({
          updated_by: String(userIdStr),
          updated_at: new Date() // Knex safely serializes native JS dates into PostgreSQL timestamptz
        });
    });

    return res.json({ success: true, message: `Successfully appended ${productIds.length} items.` });
  } catch (err) {
    console.error("Critical error appending item sets:", err);
    return res.status(500).json({ message: "Internal server error completing transaction sequence." });
  }
});

// 3. ATOMIC TRANSACTION: CREATE INSTANCE & INJECT CHILD RECORDS
router.post('/schedules/create', async (req, res) => {
  const db = getPg();
  try {
    const { site, date, day, groupId, filterColumn, filterValues } = req.body;
    const scheduledBy = req.user?._id || req.user?.firstName || "system_operator";

    if (!site || !date || !day || !groupId || !filterColumn || !filterValues) {
      return res.status(400).json({ message: "Missing required setup parameters" });
    }

    // Resolve site context to grab Mongo ID mapping target
    const location = await Location.findOne({ stationName: site });
    if (!location) {
      return res.status(404).json({ message: "Selected location context not recognized" });
    }
    const siteMongoIdString = location._id.toString();

    // Begin single transaction isolation sandbox
    const result = await db.transaction(async (trx) => {

      // Secondary absolute safety gate for date duplicates inside transaction block
      const duplicateGate = await trx("public.cycle_count_instance")
        .where({ site_mongo_id: siteMongoIdString, date })
        .first();

      if (duplicateGate) {
        throw new Error(`CONFLICT_DATE`);
      }

      // Step A: Insert master instance header row structure
      const [insertedInstance] = await trx("public.cycle_count_instance")
        .insert({
          date: date,
          day: day,
          is_scheduled: true,
          site_mongo_id: siteMongoIdString,
          scheduled_by: String(scheduledBy),
          group_id: parseInt(groupId, 10)
        })
        .returning(["id"]);

      const newInstanceId = insertedInstance.id;

      // Step B: Query ALL qualifying matching records inside public.item_bk
      const targetItemsToSchedule = await trx("public.item_bk")
        .where({ site: siteMongoIdString })
        .whereIn(filterColumn, filterValues)
        .select("id");

      if (targetItemsToSchedule.length === 0) {
        throw new Error("NO_ITEMS_FOUND");
      }

      // Step C: Chunk-insert array relations into public.cycle_count_items
      const childPayload = targetItemsToSchedule.map(item => ({
        instance_id: newInstanceId,
        product_id: item.id,
        foh: null,
        boh: null,
        count_completed: false,
        priority: false
      }));

      // Batch insert inside chunks to prevent parameter limits saturation
      const chunkSize = 1000;
      for (let i = 0; i < childPayload.length; i += chunkSize) {
        await trx("public.cycle_count_items")
          .insert(childPayload.slice(i, i + chunkSize));
      }

      return { instanceId: newInstanceId, totalAdded: childPayload.length };
    });

    res.json({
      success: true,
      message: `Schedule locked down. Tracked ${result.totalAdded} child entries successfully.`,
      instanceId: result.instanceId
    });

  } catch (err) {
    console.error("Critical error building schedule pipeline execution block:", err);
    if (err.message === 'CONFLICT_DATE') {
      return res.status(422).json({ message: "A schedule layout variant already locks down that precise date context." });
    }
    if (err.message === 'NO_ITEMS_FOUND') {
      return res.status(422).json({ message: "The configuration matched zero inventory records inside item_bk." });
    }
    res.status(500).json({ message: "Database failure creating schedule engine logs." });
  }
});

// 3. Save your group and your relational values atomically
router.post('/groups', async (req, res) => {
  const db = getPg();

  try {
    const { name, filter_column, values } = req.body;

    if (!name || !filter_column || !values || !values.length) {
      return res.status(400).json({ message: "Missing required tracking group payloads" });
    }

    // 1. Check for duplicate group name (Case-Insensitive)
    const existingGroup = await db('public.cycle_count_groups')
      .where('name', 'ilike', name.trim())
      .andWhere('is_active', true)
      .first();

    if (existingGroup) {
      return res.status(400).json({
        message: `A cycle count group named "${name}" already exists. Please choose a unique name.`
      });
    }

    // 2. Open transaction only after validation passes
    const trx = await db.transaction();

    try {
      // Insert Group Header
      const [group] = await trx('public.cycle_count_groups')
        .insert({ name: name.trim(), filter_column, is_active: true })
        .returning('*');

      // Insert Associated Value Conditions
      const valuesPayload = values.map((val) => ({
        group_id: group.id,
        value: String(val)
      }));

      await trx('public.cycle_count_group_values').insert(valuesPayload);
      await trx.commit();

      res.status(201).json({ message: "Group setup created successfully", groupId: group.id });
    } catch (txErr) {
      await trx.rollback();
      throw txErr; // Bubble up to main catch block
    }

  } catch (err) {
    console.error("Failed storing custom selection group:", err);
    res.status(500).json({ message: "Server error creating group" });
  }
});

router.post('/save-item-v2', async (req, res) => {
  try {
    const { entryId, field, value, breakdown } = req.body;
    const db = getPg();

    if (!entryId || !["foh", "boh"].includes(field)) {
      return res.status(400).json({ message: "entryId and a valid field are required." });
    }

    const existing = await db("cycle_count_items as ci")
      .join("item_bk as ib", "ci.product_id", "ib.id")
      .where("ci.id", entryId)
      .select(
        "ci.product_id", // ADDED: Need this to update item_bk directly
        "ci.foh",
        "ci.boh",
        "ci.foh_crt",
        "ci.boh_crt",
        "ci.foh_case",
        "ci.boh_case",
        "ib.site",       // ADDED: Needed to lookup location timezone parameters
        "ib.pk_in_crt",
        "ib.crt_in_case"
      )
      .first();

    if (!existing) {
      return res.status(404).json({ message: "Cycle count item not found." });
    }

    // Prepare the update object
    const updateData = {
      [field]: value, // Store loose pack count in 'foh' or 'boh'
      updated_at: new Date()
    };

    // If breakdown was provided (Tobacco items), map to extra columns
    if (breakdown) {
      // field is either 'foh' or 'boh'
      // columns are 'foh_crt', 'foh_case', etc.
      updateData[`${field}_crt`] = breakdown.cartons;
      updateData[`${field}_case`] = breakdown.cases;
      // Note: breakdown.packs is stored directly in the main loose pack column
    }

    // updateData.count_completed = isCountComplete({
    //   ...existing,
    //   ...updateData,
    // });

    // ==========================================================
    // DETERMINISTIC FLAG: BOTH FOH AND BOH MUST BE PRESENT
    // ==========================================================
    // Merge existing database state with incoming updates to verify both fields
    const finalFoh = updateData.foh !== undefined ? updateData.foh : existing.foh;
    const finalBoh = updateData.boh !== undefined ? updateData.boh : existing.boh;

    // Item count is complete ONLY when neither field is null or undefined
    updateData.count_completed = (finalFoh !== null && finalFoh !== undefined) &&
      (finalBoh !== null && finalBoh !== undefined);
    // ==========================================================

    // 1. Existing Transaction: Update inventory table records
    await db("cycle_count_items")
      .where({ id: entryId })
      .update(updateData);

    // ==========================================
    // NEW ADDITION: UPDATE LAST_COUNTED_AT DATE
    // ==========================================
    try {
      // 2. Query location parameters from MongoDB using your item site ID mapping
      const locationDoc = await Location.findById(existing.site, "timezone");

      // Fallback to absolute standard systems if timezone setup is missing
      const targetTimezone = locationDoc?.timezone || "America/New_York";

      // 3. Compute what date it is right now inside that station's legal timezone boundary
      const stationLocalDateStr = moment().tz(targetTimezone).format("YYYY-MM-DD");

      // 4. Update the Master Item Backup profile 
      await db("item_bk")
        .where({ id: existing.product_id })
        .update({
          last_counted_at: stationLocalDateStr
        });

      // console.log(`[TIMESTAMP LOG] Updated item_bk ID ${existing.product_id} with last_counted_at: ${stationLocalDateStr} (${targetTimezone})`);
    } catch (tzError) {
      // Wrapped in a sub-try/catch so that if Mongo/Moment fails, it does not throw a 500 error 
      // after the count itself was already saved successfully.
      console.error("Non-blocking error calculating station timezone date:", tzError);
    }
    // ==========================================

    res.json({ success: true });
  } catch (err) {
    console.error("Error saving Postgres count:", err);
    res.status(500).json({ message: "Failed to save item." });
  }
});


// 2. PUT - Update group name and assigned value rules (Column locked)
router.put('/groups/:id', async (req, res) => {
  const db = getPg();
  const { id } = req.params;
  const { name, values } = req.body;

  if (!name || !values || !values.length) {
    return res.status(400).json({ message: "Missing group name or tracking rule values" });
  }

  try {
    // 1. Verify group exists and is active before saving updates
    const activeCheck = await db('public.cycle_count_groups').where({ id }).first();
    if (!activeCheck || !activeCheck.is_active) {
      return res.status(404).json({ message: "Cannot update group rules. This template is inactive or has been deleted." });
    }
    // Check if the new name is taken by an entirely DIFFERENT group template
    const duplicateCheck = await db('public.cycle_count_groups')
      .where('name', 'ilike', name.trim())
      .andWhere('is_active', true)
      .andWhereNot({ id })
      .first();

    if (duplicateCheck) {
      return res.status(400).json({
        message: `Another group named "${name}" already exists. Please choose a unique name.`
      });
    }

    const trx = await db.transaction();
    try {
      // Update header details
      // Update header details
      await trx('public.cycle_count_groups')
        .where({ id })
        .update({ name: name.trim() });

      // Wipe old value definitions and replace them cleanly
      await trx('public.cycle_count_group_values').where({ group_id: id }).del();

      const newValuesPayload = values.map((val) => ({
        group_id: id,
        value: String(val)
      }));

      await trx('public.cycle_count_group_values').insert(newValuesPayload);
      await trx.commit();

      res.json({ message: "Cycle count group updated successfully" });
    } catch (txErr) {
      await trx.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error("Failed updating custom tracking group rules:", err);
    res.status(500).json({ message: "Server error saving group updates" });
  }
});

router.delete('/groups/:id', async (req, res) => {
  const db = getPg();
  const { id } = req.params;
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Check for active/pending future instances tied to this group filter
    const activeInstance = await db('public.cycle_count_instances')
      .where({ group_id: id })
      .andWhere('date', '>=', todayStr) // Protects active or un-started future instances
      .first();

    if (activeInstance) {
      return res.status(400).json({
        message: `This group cannot be removed because it is linked to an active or upcoming cycle count instance scheduled for ${activeInstance.date || 'today'}. Please close or cancel that instance first.`
      });
    }

    // 2. Soft-delete by setting the active flag to false
    const rowsUpdated = await db('public.cycle_count_groups')
      .where({ id })
      .update({ is_active: false });

    if (rowsUpdated === 0) {
      return res.status(404).json({ message: "Group template not found" });
    }

    res.json({ message: "Group template removed successfully" });
  } catch (err) {
    console.error("Failed soft-deleting cycle count group:", err);
    res.status(500).json({ message: "Server error removing group template" });
  }
});

// DELETE MULTIPLE ROUTE ITEMS FROM AN ACTIVE COUNT INSTANCE
router.delete('/schedules/details/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { productIds } = req.body; // Expecting an array of numbers: [102, 304, ...]

    // Fallback profile identifier strings from your custom authentication middleware layer
    const userIdStr = req.user?._id || req.user?.firstName || "system_operator";

    if (!id || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Instance ID and target productIds array are required." });
    }

    const db = getPg();

    // 1. Fetch structural core context variables
    const instance = await db("public.cycle_count_instance")
      .where({ id })
      .select("id", "date", "site_mongo_id")
      .first();

    if (!instance) {
      return res.status(404).json({ message: "Count instance record parameters not found." });
    }

    // 2. Resolve target location to isolate its timezone configurations
    const location = await Location.findById(instance.site_mongo_id);
    if (!location) {
      return res.status(404).json({ message: "Associated station location context trace missing." });
    }

    const stationTimezone = location.timezone || 'America/New_York';

    // 3. SECURE TIMEZONE CHECK: Verify that the current date in the station's timezone isn't the count date
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: stationTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const currentStationDateStr = formatter.format(new Date()); // Outputs 'YYYY-MM-DD'

    if (instance.date === currentStationDateStr) {
      return res.status(403).json({
        message: "Action Denied: Items cannot be deleted because this cycle count instance is currently live."
      });
    }

    // 4. Transaction execution: Remove sub-items and stamp attribution identity tracking logs
    await db.transaction(async (trx) => {
      // A. Delete items matching the instance context link registry mapping
      await trx("public.cycle_count_items")
        .where({ instance_id: id })
        .whereIn("product_id", productIds)
        .del();

      // B. Update auditing properties to reflect user changes
      await trx("public.cycle_count_instance")
        .where({ id })
        .update({
          updated_by: String(userIdStr),
          updated_at: new Date() // Updates parent tracking timestamp
        });
    });

    return res.status(200).json({
      success: true,
      message: "Selected items deleted successfully.",
      updated_by: String(userIdStr)
    });

  } catch (err) {
    console.error("Error executing safe delete batch mutation sequence:", err);
    return res.status(500).json({ message: "Internal server error dropping registry indexes." });
  }
});

/**
 * PUT /api/cycle-count/item-bk/mass-edit
 * Securely overwrites historical parameters for selected array collections.
 */
router.put('/item-bk/mass-edit', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    const db = getPg();

    // 1. Array Validation Guard
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid Payload Context: Target IDs array parsing failed."
      });
    }

    // 2. Extracted Values Field Guard
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No parameters isolated for configuration updates."
      });
    }

    // 3. Strict Param Whitelisting & Input Sanitization
    const targetFields = ['allow_cycle_count', 'grade', 'pk_in_crt', 'crt_in_case'];
    const sanitizedPayload = {};

    for (const field of targetFields) {
      if (updates[field] !== undefined) {
        let value = updates[field];

        // Formatting processing matrix per type
        if (field === 'allow_cycle_count') {
          sanitizedPayload[field] = Boolean(value);
        } else if (field === 'grade') {
          if (!['A', 'B', 'C'].includes(value)) {
            return res.status(400).json({ success: false, message: "Invalid value passed for grade matrix alignment." });
          }
          sanitizedPayload[field] = value;
        } else if (field === 'pk_in_crt' || field === 'crt_in_case') {
          sanitizedPayload[field] = value !== null ? parseInt(value, 10) : null;
          if (sanitizedPayload[field] !== null && isNaN(sanitizedPayload[field])) {
            return res.status(400).json({ success: false, message: `Logistics value for ${field} must evaluate cleanly to an integer.` });
          }
        }
      }
    }

    // Double check that we still have sanitized targets to alter after cleaning data
    if (Object.keys(sanitizedPayload).length === 0) {
      return res.status(400).json({ success: false, message: "No valid tracking parameters parsed for database changes." });
    }

    // 4. Database Transaction Write Execution
    // Standard Knex execution syntax query matrix:
    await db('item_bk')
      .whereIn('id', ids)
      .update(sanitizedPayload);

    /* 
    Alternative: If using native raw pg / postgres pool:
    const fieldsToSet = Object.keys(sanitizedPayload).map((key, index) => `"${key}" = $${index + 1}`).join(', ');
    const values = Object.values(sanitizedPayload);
    await db.query(`UPDATE item_bk SET ${fieldsToSet} WHERE id = ANY($${values.length + 1})`, [...values, ids]);
    */

    return res.status(200).json({
      success: true,
      message: `Successfully updated config variables across ${ids.length} selected row contexts.`,
      rowsAffected: ids.length
    });

  } catch (error) {
    console.error("Critical server failure writing bulk item records:", error);
    return res.status(500).json({
      success: false,
      message: "Internal system transaction processing exception occurred."
    });
  }
});

// router.post('/save-item-v2', async (req, res) => {
//   try {
//     const { entryId, field, value, site } = req.body; // entryId is ci.id from Postgres
//     const db = getPg();

//     if (!['foh', 'boh'].includes(field)) {
//       return res.status(400).json({ message: "Invalid field" });
//     }

//     // 1. Update the Postgres record
//     await db("cycle_count_items")
//       .where({ id: entryId })
//       .update({
//         [field]: value,
//         count_completed: true // Mark as interacted with
//       });

//     // 2. Emit Socket Event (using your existing pattern)
//     // We emit to the specific site so other tablets at the same store update
//     req.app.get("io").emit("cycle-count-field-updated", {
//       entryId,
//       field,
//       value,
//       site
//     });

//     res.json({ success: true });
//   } catch (err) {
//     console.error("Error saving Postgres count:", err);
//     res.status(500).json({ message: "Failed to save item." });
//   }
// });

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
          _id: e._id,
          name: e.name,
          upc_barcode: e.upc_barcode,
          totalQty: (e.foh ?? 0) + (e.boh ?? 0),
          foh: e.foh ?? 0,
          boh: e.boh ?? 0,
          onHandCSO: e.onHandCSO ?? null,
          unitPrice: e.unitPrice ?? null,
          comments: e.comments ?? [],
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

router.get("/daily-report", async (req, res) => {
  const { site, date } = req.query; // Expects site: "Rankin", date: "YYYY-MM-DD"
  const db = getPg();

  if (!site || !date) {
    return res.status(400).json({ success: false, message: "Missing required parameters: site and date." });
  }

  try {
    // 1. Resolve the text site name to its MongoDB ID string reference
    const locationDoc = await Location.findOne({ stationName: site }).lean();
    if (!locationDoc) {
      return res.status(404).json({ success: false, message: `Location profile not found for site: ${site}` });
    }
    const siteMongoIdStr = locationDoc._id.toString();

    // 2. Fetch the instance row from PostgreSQL
    const instance = await db("cycle_count_instance")
      .where({ site_mongo_id: siteMongoIdStr, date: date })
      .first();

    // console.log("Resolved instance for report query:", instance.id);

    // If no instance exists for that day, return an empty array gracefully
    if (!instance) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 3. Fetch all Mongo Product Categories upfront to avoid N+1 query performance hits
    const mongoCategories = await ProductCategory.find({}).lean();
    const categoryMap = new Map(mongoCategories.map(cat => [Number(cat.Number), cat.Name]));

    // 4. Query all items tied to this instance, including case/crate breakdowns & master product details
    const reportItems = await db("cycle_count_items as cci")
      .join("item_bk as ib", "cci.product_id", "ib.id")
      .where({
        "cci.instance_id": instance.id
        // "cci.count_completed": true // Added condition here
      })
      .select(
        "cci.id as itemId",
        "cci.product_id as productId",
        "ib.description as name",
        "ib.upc_barcode as upc_barcode",
        "ib.image_url",
        "ib.retail as unitPrice",
        "ib.pk_in_crt",
        "ib.category_id as categoryId",
        "ib.on_hand_qty as onHandCSO",
        "cci.foh",
        "cci.foh_crt",
        "cci.foh_case",
        "cci.boh",
        "cci.boh_crt",
        "cci.boh_case",
        "cci.count_completed",
        "cci.priority"
      );

    // console.log(`Fetched ${reportItems.length} items for report generation.`);

    // 5. Calculate total pieces and stitch the categoryName into the payload
    const parsedItems = reportItems.map(item => {
      const totalFoh = Number(item.foh || 0);
      const totalBoh = Number(item.boh || 0);
      const compositeTotalQty = totalFoh + totalBoh;
      const cleanCategoryId = item.categoryId ? Number(item.categoryId) : 0;

      return {
        _id: String(item.itemId),
        productId: item.productId,
        name: item.name,
        upc_barcode: item.upc_barcode,
        image_url: item.image_url,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
        onHandCSO: item.onHandCSO ? Number(item.onHandCSO) : 0,
        categoryId: cleanCategoryId,
        pk_in_crt: item.pk_in_crt ? Number(item.pk_in_crt) : 0,

        // Match Postgres categoryId with Mongo's "Number" field to get the string Name
        categoryName: categoryMap.get(cleanCategoryId) || "Unknown Category",

        // Loose counts
        foh: totalFoh,
        boh: totalBoh,

        // Case / Crate tracking metrics
        foh_crt: item.foh_crt,
        foh_case: item.foh_case,
        boh_crt: item.boh_crt,
        boh_case: item.boh_case,

        totalQty: compositeTotalQty,
        count_completed: item.count_completed,
        priority: item.priority,
        comments: []
      };
    });

    return res.status(200).json({
      success: true,
      instanceId: instance.id,
      date: instance.date,
      day: instance.day,
      data: parsedItems
    });

  } catch (error) {
    console.error("Error generating relational variance report query:", error);
    return res.status(500).json({ success: false, message: "Internal server registry error processing report data." });
  }
});

// GET: Fetch all notes for an instance with user profiles
router.get('/instance-notes/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const db = getPg();

    // 1. Fetch raw notes from PostgreSQL
    const notes = await db("cycle_count_instance_notes")
      .where({ instance_id: instanceId })
      .orderBy("created_at", "desc");

    if (notes.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 2. Extract and sanitize IDs to guarantee pure 24-character hex values
    const mongoUserIds = [
      ...new Set(
        notes.map(n => n.user_mongo_id ? n.user_mongo_id.replace(/^"|"$/g, '') : '')
      )
    ].filter(Boolean); // Filter out empty strings if any exist

    // 3. Resolve matching User metadata from MongoDB
    const users = await User.find({ _id: { $in: mongoUserIds } }, "firstName lastName");

    const userMap = users.reduce((acc, u) => {
      const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
      return {
        ...acc,
        [u._id.toString()]: fullName || "Unknown Operator"
      };
    }, {});

    const enrichedNotes = notes.map(note => {
      // Create a normalized lookup key to match what mongo returned
      const lookupKey = note.user_mongo_id ? note.user_mongo_id.replace(/^"|"$/g, '') : '';

      return {
        id: note.id,
        note: note.note,
        createdAt: note.created_at,
        userName: userMap[lookupKey] || "System Operator"
      };
    });

    res.json({ success: true, data: enrichedNotes });
  } catch (err) {
    console.error("Error fetching instance notes:", err);
    res.status(500).json({ message: "Failed to retrieve comment thread." });
  }
});

// POST: Add a note to a specific count instance thread
router.post('/instance-notes', async (req, res) => {
  try {
    const { instanceId, note } = req.body;
    const userMongoId = req.user?._id;
    const db = getPg();

    if (!instanceId || !note?.trim()) {
      return res.status(400).json({ message: "Instance ID and note content are required." });
    }

    // Convert cleanly to hex string, stripping out any accidental double quotes
    const cleanMongoId = userMongoId
      ? userMongoId.toString().replace(/^"|"$/g, '')
      : null;

    if (!cleanMongoId) {
      return res.status(401).json({ message: "Unauthorized: Missing user reference context." });
    }

    const [newNote] = await db("cycle_count_instance_notes")
      .insert({
        instance_id: instanceId,
        note: note.trim(),
        user_mongo_id: cleanMongoId, // Pure 24-character hex string
        created_at: new Date()
      })
      .returning("*");

    res.status(201).json({ success: true, data: newNote });
  } catch (err) {
    console.error("Error creating instance note:", err);
    res.status(500).json({ message: "Failed to post comment to thread." });
  }
});

// POST /api/cycle-count/:id/comments 
// add new comments from the reports side
router.post('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { initials, author, text } = req.body;

    if (!initials || !author || !text) {
      return res.status(400).json({ message: 'All comment fields are required.' });
    }

    const item = await CycleCount.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    item.comments.push({ initials, author, text });
    await item.save();

    res.json({ message: 'Comment added', comments: item.comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add comment.' });
  }
});

// GET /api/cycle-count/:id/comments 
// get all the comments for a particular cyclecount 
router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CycleCount.findById(id).lean();
    if (!item) return res.status(404).json({ message: 'Item not found.' });

    res.json({ comments: item.comments || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch comments.' });
  }
});


// router.get('/lookup', async (req, res) => {
//   const { upc_barcode, site } = req.query;
//   if (!upc_barcode || !site) return res.status(400).json({ error: "UPC barcode and site required" });
//   const item = await CycleCount.findOne({ upc_barcode, site });
//   if (!item) return res.status(404).json({ error: "Not found" });
//   res.json(item);
// });

router.get('/lookup', async (req, res) => {
  try {
    const { upc_barcode, site } = req.query;

    if (!upc_barcode || !site) {
      return res.status(400).json({ error: "UPC barcode and site required" });
    }

    // 1️⃣ Find CycleCount item
    const item = await CycleCount.findOne({ upc_barcode, site });

    if (!item) {
      return res.status(404).json({ error: "Not found" });
    }

    // 2️⃣ Resolve categoryName using categoryNumber
    let categoryName = null;

    if (item.categoryNumber != null) {
      const cat = await ProductCategory.findOne({ Number: item.categoryNumber });
      if (cat) categoryName = cat.Name;
    }

    // 3️⃣ Return extended response
    res.json({
      ...item.toObject(),
      category: categoryName,
    });

  } catch (err) {
    console.error("Lookup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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

//dummyroute
// router.get('/current-inventory', async (req, res) => {
//   try {
//     const { site, limit } = req.query;
//     if (!site) return res.status(400).json({ message: "site is required" });

//     const limitNum = limit ? parseInt(limit, 10) : null;

//     // ✅ Dummy UPCs
//     const upcs = [
//       "008660100108",
//       "010119039822",
//       "011111614246",
//       "011206000077",
//       "011250000047",
//       "011250000061",
//       "012035930610",
//       "012044038925",
//       "013700975394",
//       "013700976155"
//     ];

//     // ✅ Dummy categories
//     const categories = ["Vapes", "Cannabis", "Convinience", "tobacco"];

//     // ✅ Generate dummy inventory
//     const inventory = upcs.map((upc, idx) => ({
//       Item_Name: `Dummy Item ${idx + 1}`,
//       UPC: upc,
//       Category: categories[Math.floor(Math.random() * categories.length)],
//       "On Hand Qty": Math.floor(Math.random() * 100), // random 0-99
//     }));

//     // Apply limit if provided
//     const limitedInventory = limitNum ? inventory.slice(0, limitNum) : inventory;

//     // ✅ Dummy cycle counts (simulate Mongo lookup)
//     const enrichedInventory = limitedInventory.map(item => ({
//       ...item,
//       updatedAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000), // random last week
//       cycleCount: Math.floor(Math.random() * 50), // random 0-49
//     }));

//     res.json({ site, inventory: enrichedInventory });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to get current inventory." });
//   }
// });


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

// Example Express Route: /api/cycle-count/search
router.get('/search', async (req, res) => {
  try {
    const { site, q } = req.query;

    if (!site || !q) {
      return res.json([]);
    }

    // Use a case-insensitive regex for the name and an exact or prefix match for UPC
    const query = {
      site: site, // Must match the site format in your DB
      $or: [
        { upc_barcode: { $regex: `^${q}`, $options: 'i' } }, // Prefix match for UPC is faster
        { name: { $regex: q, $options: 'i' } }
      ]
    };

    const items = await CycleCount.find(query)
      .select('name upc_barcode gtin onHandCSO') // Only fetch needed fields
      .limit(10)
      .lean(); // Faster execution

    res.json(items);
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//dummy route
// router.get('/inventory-categories', async (req, res) => {
//   try {
//     const { site } = req.query;
//     if (!site) return res.status(400).json({ message: "site is required" });

//     // ✅ Dummy categories as objects
//     const categories = [
//       { Category: "Vapes" },
//       { Category: "Cannabis" },
//       { Category: "Convinience" },
//       { Category: "tobacco" },
//     ];

//     res.json({ categories });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Failed to get categories." });
//   }
// });



module.exports = router;
