const moment = require('moment-timezone');
const FuelOrder = require('../models/fuel/FuelOrder');
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const Location = require('../models/Location');


const DRY_RUN = false; // Set to TRUE to just see the log without saving

async function migrateOrders() {
  try {
    await connectDB();
    console.log(`--- 🚀 Starting Migration [Dry Run: ${DRY_RUN}] ---`);

    const orders = await FuelOrder.find({ station: { $exists: true } });

    for (const order of orders) {
      const station = await Location.findById(order.station).select('timezone').lean();
      const tz = station?.timezone || 'America/Toronto';

      // Capture original ISO for logging
      const oldISO = order.originalDeliveryDate.toISOString();

      // Fix Original Date: Take the date part and pin to local midnight
      const datePart = oldISO.split('T')[0]; 
      const newOriginal = moment.tz(datePart, tz).startOf('day').toDate();
      order.originalDeliveryDate = newOriginal;
      order.markModified('originalDeliveryDate');

      // Fix Estimated Date if it exists
      if (order.estimatedDeliveryDate) {
        const estDatePart = order.estimatedDeliveryDate.toISOString().split('T')[0];
        order.estimatedDeliveryDate = moment.tz(estDatePart, tz).startOf('day').toDate();
        order.markModified('estimatedDeliveryDate');
      }

      if (!DRY_RUN) {
        await order.save();
        console.log(`✅ PO ${order.poNumber}: ${oldISO} -> ${newOriginal.toISOString()}`);
      } else {
        console.log(`🔍 [DRY RUN] PO ${order.poNumber}: ${oldISO} -> ${newOriginal.toISOString()} (${tz})`);
      }
    }

    console.log('--- ✅ Done ---');
  } catch (err) {
    console.error('💥 Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

migrateOrders();