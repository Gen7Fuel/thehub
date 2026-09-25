require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { getPg } = require('../config/pg');
const Location = require('../models/Location');
const Event = require('../models/Event');
const User = require('../models/User');

const SYSTEM_USER_ID = new mongoose.Types.ObjectId("000000000000000000000000");
const SYSTEM_USER_DEFAULT = {
  id: SYSTEM_USER_ID,
  firstName: 'System',
  lastName: 'Generated',
  email: 'system@gen7fuel.com',
};

async function migrateHistoricalScheduledCountsToEvents() {
  const db = getPg();
  console.log('--- 🛠️ Starting Migration: Backfilling Historical Scheduled Counts to Events ---');

  try {
    // 1. Fetch all scheduled cycle count instances from PostgreSQL including scheduled_by
    const scheduledInstances = await db('cycle_count_instance as cci')
      .leftJoin('cycle_count_groups as ccg', 'cci.group_id', 'ccg.id')
      .where('cci.is_scheduled', true)
      .select(
        'cci.id as instance_id',
        'cci.date',
        'cci.day',
        'cci.site_mongo_id',
        'cci.scheduled_by',
        'cci.group_id',
        'ccg.name as group_name'
      );

    console.log(`🔍 Found ${scheduledInstances.length} scheduled cycle count instances in PostgreSQL.`);

    if (scheduledInstances.length === 0) {
      console.log('--- ℹ️ No scheduled instances found to migrate. ---');
      return;
    }

    // 2. Fetch all Locations from MongoDB to create a lookup map (Mongo ID -> Site Name)
    const locations = await Location.find({}).select('_id site stationName legalName');
    const locationMap = new Map();

    locations.forEach(loc => {
      const siteName = loc.site || loc.stationName || loc.legalName;
      locationMap.set(loc._id.toString(), siteName);
    });

    // 3. User Lookup Cache to optimize MongoDB queries across loop iterations
    const userCache = new Map();

    let createdCount = 0;
    let skippedCount = 0;

    // 4. Process each instance
    for (const instance of scheduledInstances) {
      const siteName = locationMap.get(instance.site_mongo_id);

      if (!siteName) {
        console.warn(`⚠️ [SKIP] Could not resolve site name for site_mongo_id: ${instance.site_mongo_id} (Instance ID: ${instance.instance_id})`);
        skippedCount++;
        continue;
      }

      // Query child items count for this instance
      const itemCountResult = await db('cycle_count_items')
        .where({ instance_id: instance.instance_id })
        .count('id as total');

      const itemCount = parseInt(itemCountResult[0]?.total || 0, 10);

      // Determine group name (Handles EOM negative inventory or standard group names)
      let groupName = instance.group_name;
      if (!groupName) {
        groupName = instance.group_id ? `Group #${instance.group_id}` : 'Negative Inventory';
      }

      // Build Event title and description strictly matching app standards
      const eventTitle = `Count Scheduled - ${groupName}`;
      const eventDescription = `Cycle Count Scheduled for ${instance.date} and ${groupName} (~${itemCount} items)`;

      // 5. Idempotency Check: Prevent duplicate event insertion for the same site, date, and title
      const existingEvent = await Event.findOne({
        site: siteName,
        date: String(instance.date),
        title: eventTitle,
      });

      if (existingEvent) {
        console.log(`⏩ [SKIP] Event already exists for site: "${siteName}", date: ${instance.date}, title: "${eventTitle}"`);
        skippedCount++;
        continue;
      }

      // 6. Resolve user details for createdBy (scheduled_by -> Mongo User collection lookup)
      let creatorInfo = SYSTEM_USER_DEFAULT;
      const scheduledByRaw = instance.scheduled_by ? String(instance.scheduled_by).trim() : null;

      if (scheduledByRaw) {
        if (userCache.has(scheduledByRaw)) {
          creatorInfo = userCache.get(scheduledByRaw);
        } else if (mongoose.Types.ObjectId.isValid(scheduledByRaw)) {
          try {
            const userDoc = await User.findById(scheduledByRaw).select('_id firstName lastName email');
            if (userDoc) {
              creatorInfo = {
                id: userDoc._id,
                firstName: userDoc.firstName || '',
                lastName: userDoc.lastName || '',
                email: userDoc.email || '',
              };
            }
          } catch (userErr) {
            console.warn(`⚠️ Failed to fetch user ${scheduledByRaw}, defaulting to System user:`, userErr.message);
          }
          userCache.set(scheduledByRaw, creatorInfo);
        }
      }

      // 7. Create Event record
      await Event.create({
        site: siteName,
        title: eventTitle,
        description: eventDescription,
        date: String(instance.date),
        type: 'system',
        createdBy: creatorInfo,
      });

      console.log(`✅ [CREATED] Event for site: "${siteName}", date: ${instance.date}, group: "${groupName}", user: "${creatorInfo.firstName} ${creatorInfo.lastName}" (~${itemCount} items)`);
      createdCount++;
    }

    console.log(`\n--- 📊 Migration Summary ---`);
    console.log(`   Total Processed: ${scheduledInstances.length}`);
    console.log(`   Events Created:  ${createdCount}`);
    console.log(`   Events Skipped:  ${skippedCount}`);

  } catch (err) {
    console.error('❌ Critical Failure during event migration:', err);
    throw err;
  }
}

async function run() {
  let hadError = false;
  try {
    await connectDB();
    console.log('🔌 Connected to MongoDB');

    await migrateHistoricalScheduledCountsToEvents();

    console.log('--- ✅ Manual Migration Completed Successfully ---');
  } catch (err) {
    hadError = true;
    console.error('❌ Migration failed:', err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = { run, migrateHistoricalScheduledCountsToEvents };