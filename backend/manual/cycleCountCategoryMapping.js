// const mongoose = require('mongoose');
const { getCategoryNumbersFromSQL } = require("../services/sqlService");
const CycleCount = require('../models/CycleCount');
const ProductCategory = require('../models/ProductCategory');
const mongoose = require("mongoose");
// const dotenv = require("dotenv");
const connectDB = require("../config/db");


// -------------- CYCLECOUNT UPDATE FUNCTION ----------------
/**
 * Update all "Not Found" category items in cyclecount using SQL data
 */
// async function updateNotFoundCategories() {
//   try {
//     // 1. Get all GTINs from cyclecount where category is "Not Found"
//     await connectDB(); // connect to Mongo
//     const items = await CycleCount.find({ category: 'Not Found' }, { gtin: 1 });
//     if (!items.length) {
//       console.log('No items with "Not Found" category.');
//       return;
//     }

//     const gtins = items.map(i => i.gtin);

//     // 2. Get category mapping from SQL
//     const categoryMap = await getCategoriesFromSQL(gtins);

//     // 3. Prepare bulk update operations
//     const bulkOps = items.map(item => {
//       const newCategory = categoryMap[item.gtin];
//       if (newCategory) {
//         return {
//           updateOne: {
//             filter: { _id: item._id },
//             update: { $set: { category: newCategory } }
//           }
//         };
//       }
//     }).filter(Boolean);

//     // 4. Execute bulk update
//     if (bulkOps.length) {
//       const result = await CycleCount.bulkWrite(bulkOps);
//       console.log(`Updated ${result.modifiedCount} categories in cyclecount.`);
//     } else {
//       console.log('No matching categories found in SQL.');
//     }
//     await mongoose.connection.close();
//   } catch {
//     console.error("Error during mapping category:", err);
//     await mongoose.connection.close();
//   }
// }

// // ---------------- RUN ----------------
// updateNotFoundCategories().catch(console.error);

async function mapProductCategories() {
  try {
    await connectDB(); // connect to Mongo
    // 1. Get unique category names from cyclecount
    const uniqueCategories = await CycleCount.distinct('category', {
      category: { $nin: ['Not Found', null, ''] }
    });

    if (!uniqueCategories.length) {
      console.log("No valid category names found in cyclecount.");
      return;
    }

    console.log("Found unique categories:", uniqueCategories.length);

    // 2. Query SQL for category numbers
    const categoryMap = await getCategoryNumbersFromSQL(uniqueCategories);

    // 3. Prepare bulk insert/update operations
    const bulkOps = Object.entries(categoryMap).map(([name, number]) => ({
      updateOne: {
        filter: { Name: name, Number: number },
        update: {
          $setOnInsert: {
            Name: name,
            Number: number,
            CycleCountVariance: 0,
            OrderRecVariance: 0
          }
        },
        upsert: true
      }
    }));

    if (!bulkOps.length) {
      console.log("No categories found in SQL matching cyclecount.");
      return;
    }

    const result = await ProductCategory.bulkWrite(bulkOps);
    console.log(`ProductCategory updated. Inserted: ${result.upsertedCount}`);
    await mongoose.connection.close();
  } catch(err) {
    console.error("Error during mapping category:", err);
    await mongoose.connection.close();
  }
}

mapProductCategories().catch(console.error);