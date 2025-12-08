// const mongoose = require('mongoose');
const { getCategoriesFromSQL } = require("../services/sqlService");
const CycleCount = require('../models/CycleCount');
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("../config/db");


// -------------- CYCLECOUNT UPDATE FUNCTION ----------------
/**
 * Update all "Not Found" category items in cyclecount using SQL data
 */
async function updateNotFoundCategories() {
  try {
    // 1. Get all GTINs from cyclecount where category is "Not Found"
    await connectDB(); // connect to Mongo
    const items = await CycleCount.find({ category: 'Not Found' }, { gtin: 1 });
    if (!items.length) {
      console.log('No items with "Not Found" category.');
      return;
    }

    const gtins = items.map(i => i.gtin);

    // 2. Get category mapping from SQL
    const categoryMap = await getCategoriesFromSQL(gtins);

    // 3. Prepare bulk update operations
    const bulkOps = items.map(item => {
      const newCategory = categoryMap[item.gtin];
      if (newCategory) {
        return {
          updateOne: {
            filter: { _id: item._id },
            update: { $set: { category: newCategory } }
          }
        };
      }
    }).filter(Boolean);

    // 4. Execute bulk update
    if (bulkOps.length) {
      const result = await CycleCount.bulkWrite(bulkOps);
      console.log(`Updated ${result.modifiedCount} categories in cyclecount.`);
    } else {
      console.log('No matching categories found in SQL.');
    }
    await mongoose.connection.close();
  } catch {
    console.error("Error during mapping category:", err);
    await mongoose.connection.close();
  }
}

// ---------------- RUN ----------------
updateNotFoundCategories().catch(console.error);
