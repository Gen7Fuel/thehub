const mongoose = require("mongoose");
const dotenv = require("dotenv");
const CycleCount = require("./models/CycleCount");
const { getUPC_barcode } = require("./services/sqlService");
const connectDB = require("./config/db");

dotenv.config();

async function backfillUPC() {
  try {
    await connectDB(); // connect to Mongo

    const docs = await CycleCount.find({});
    console.log(`Found ${docs.length} cycle count records.`);

    for (const doc of docs) {
      if (!doc.upc || !doc.upc_barcode) {
        console.log(`Processing GTIN: ${doc.gtin} at site: ${doc.site}`);

        const itembook = await getUPC_barcode(doc.gtin);
        if (Array.isArray(itembook) && itembook.length > 0) {
          const upc = itembook[0].UPC || doc.upc;
          const upc_barcode = itembook[0].UPC_A_12_digits || doc.upc_barcode;

          doc.upc = upc;
          doc.upc_barcode = upc_barcode;
          doc.updatedAt = new Date();

          await doc.save();
        } else {
          console.log(`No SQL record found for GTIN ${doc.gtin}`);
        }
      }
    }

    console.log("Backfill complete.");
    await mongoose.connection.close();
  } catch (err) {
    console.error("Error during backfill:", err);
    await mongoose.connection.close();
  }
}

backfillUPC();