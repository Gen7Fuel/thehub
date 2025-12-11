// const mongoose = require('mongoose');
const { getCategoriesFromSQL } = require("../services/sqlService");
const CycleCount = require('../models/CycleCount');
const ProductCategory = require('../models/ProductCategory');
const OrderReconciliation = require('../models/OrderRec');
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

// const mongoose = require("mongoose");
// const ProductCategory = require("../models/ProductCategory");
// const { getCategoryNumbersFromSQL } = require("../services/sqlService"); 
// const connectDB = require("../config/db"); // your mongo connection function

// async function resetAndPopulateProductCategories() {
//   try {
//     // 1. Connect to MongoDB
//     await connectDB();
//     console.log("Connected to MongoDB");

//     // 2. Wipe off existing ProductCategory documents
//     await ProductCategory.deleteMany({});
//     console.log("Cleared ProductCategory collection.");

//     // 3. Fetch category data from SQL
//     const sqlResult = await getCategoryNumbersFromSQL();

//     if (!sqlResult || !sqlResult.recordset) {
//       console.error("No SQL data returned.");
//       return;
//     }

//     console.log(`Fetched ${sqlResult.recordset.length} category rows from SQL.`);

//     // 4. Clean data: remove null/invalid values
//     const cleaned = sqlResult.recordset
//       .filter(row => row["Category Name"] && row["Cat #"] != null)
//       .map(row => ({
//         Name: row["Category Name"].trim(),
//         Number: Number(row["Cat #"]),
//         CycleCountVariance: 1,
//         OrderRecVariance: 1
//       }));

//     console.log(`Valid cleaned categories: ${cleaned.length}`);

//     if (cleaned.length === 0) {
//       console.log("No valid category data to insert.");
//       return;
//     }

//     // 5. Insert in bulk
//     await ProductCategory.insertMany(cleaned);
//     console.log("ProductCategory repopulated successfully!");

//     // 6. Close Mongo connection
//     await mongoose.connection.close();
//     console.log("MongoDB connection closed.");
//   } catch (err) {
//     console.error("Error:", err);
//     await mongoose.connection.close();
//   }
// }

const BATCH_SIZE = 2000;
// const BULK_WRITE_CHUNK = 500;

async function fillMissingCategoryNumbers() {
  try {
    // await connectDB();
    console.log("Connected to MongoDB");

    const normalize = str => str ? str.replace(/\s+/g, ' ').trim().toLowerCase() : '';

    // 1. Load ProductCategory map: normalized name -> Number
    const productCategories = await ProductCategory.find({});
    const categoryNameMap = {};
    productCategories.forEach(pc => {
      if (pc.Name && pc.Number != null) {
        categoryNameMap[normalize(pc.Name)] = pc.Number;
      }
    });
    // console.log("Loaded ProductCategory mapping:", Object.keys(categoryNameMap));

    // 2. Fetch CycleCount documents missing categoryNumber
    const missingDocs = await CycleCount.find({ categoryNumber: { $exists: false } });
    console.log(`Found ${missingDocs.length} CycleCount docs missing categoryNumber`);

    // 3. Process each document individually
    for (const doc of missingDocs) {
      const normalizedName = normalize(doc.category);
      const number = categoryNameMap[normalizedName];

      if (number != null) {
        doc.categoryNumber = number;
        await doc.save({ timestamps: false });
        console.log(`Updated GTIN: ${doc.gtin}, category: '${doc.category}' -> categoryNumber: ${number}`);
      } else {
        console.log(`Could not map GTIN: ${doc.gtin}, category: '${doc.category}'`);
      }
    }

    console.log("Done updating missing categoryNumbers.");
    // await mongoose.connection.close();
  } catch (err) {
    console.error("Error:", err);
    // await mongoose.connection.close();
  }
}

async function updateCycleCountCategories() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const normalize = str => str ? str.replace(/\s+/g, ' ').trim().toLowerCase() : '';

    // 1. Load ProductCategory map: normalized name -> Number
    const productCategories = await ProductCategory.find({});
    const categoryNameMap = {};
    const validNumbers = new Set();
    productCategories.forEach(pc => {
      if (pc.Name && pc.Number != null) {
        const key = normalize(pc.Name);
        categoryNameMap[key] = pc.Number;
        validNumbers.add(pc.Number);
      }
    });
    // console.log("Loaded ProductCategory mapping:", Object.keys(categoryNameMap));

    // 2. Fetch unique GTINs
    const gtins = await CycleCount.distinct("gtin");
    console.log(`Found ${gtins.length} unique GTINs.`);

    // 3. Fetch SQL category numbers in batches
    const categoryMap = {}; // gtin -> categoryNumber
    for (let i = 0; i < gtins.length; i += BATCH_SIZE) {
      const batch = gtins.slice(i, i + BATCH_SIZE);
      const result = await getCategoriesFromSQL(batch);
      Object.assign(categoryMap, result);
      console.log(`Processed batch ${i / BATCH_SIZE + 1}`);
    }

    const ops = [];
    const unresolvedGTINs = [];

    // 4. Update docs with valid SQL results
    for (const [gtin, categoryNumber] of Object.entries(categoryMap)) {
      if (validNumbers.has(Number(categoryNumber))) {
        ops.push({
          updateMany: {
            filter: { gtin },
            update: { $set: { categoryNumber: Number(categoryNumber) } }
          }
        });
      } else {
        unresolvedGTINs.push(gtin);
      }
    }

    if (ops.length) {
      const result = await CycleCount.bulkWrite(ops, { timestamps: false });
      console.log("CycleCount updated via SQL:", result.modifiedCount);
    } else {
      console.log("No updates performed via SQL.");
    }

    // 5. Fallback for unresolved GTINs using Mongo only
    if (unresolvedGTINs.length) {
      console.log(`Fallback for ${unresolvedGTINs.length} GTINs not resolved via SQL`);
      const missingDocs = await CycleCount.find({ gtin: { $in: unresolvedGTINs } });

      for (const doc of missingDocs) {
        const normalizedName = normalize(doc.category);
        const number = categoryNameMap[normalizedName];

        if (number != null) {
          doc.categoryNumber = number;
          await doc.save({ timestamps: false });
          console.log(`Updated via fallback - GTIN: ${doc.gtin}, category: '${doc.category}' -> categoryNumber: ${number}`);
        } else {
          console.log(`Could not map GTIN: ${doc.gtin}, category: '${doc.category}'`);
        }
      }
    }

    console.log("Done updating CycleCount categories.");
    await fillMissingCategoryNumbers();

    // Remove old 'category' field from documents with valid categoryNumber
    await CycleCount.updateMany(
      { categoryNumber: { $exists: true, $ne: null } },
      { $unset: { category: "" } },
      { timestamps: false }
    );

    console.log("Removed 'category' field from documents with valid 'categoryNumber'.");

    // Remove category.name from order rec categories where number exists in ProductCategory
    await OrderReconciliation.updateMany(
      {}, // all documents
      { $unset: { "categories.$[cat].name": "" } },
      {
        arrayFilters: [
          { "cat.number": { $in: Array.from(validNumbers).map(String) } }
        ],
        timestamps: false
      }
    );

    console.log("Removed 'name' from order reconciliation categories where number exists in ProductCategory.");

    await mongoose.connection.close();

  } catch (err) {
    console.error("Error:", err);
    await mongoose.connection.close();
  }
}

// Run the function
updateCycleCountCategories().catch(console.error);


// Run the function
// fillMissingCategoryNumbers().catch(console.error);



// mapProductCategories().catch(console.error);