const connectDB = require("../config/db");
const mongoose = require("mongoose");
const { getPg } = require("../config/pg");

async function updateTobaccoMultipliers() {
  const db = getPg();
  console.log("--- Updating Tobacco Pack/Carton Multipliers ---");

  try {
    // 1. Logic for 20 PK items (10 pks/crt, 50 crt/case)
    const update20pk = await db("item_bk")
      .whereIn("category_id", [100, 101, 102, 103, 104, 105, 106, 107])
      .andWhere("description", "like", "%20%")
      .andWhere("description", "like", "%PK%")
      .update({
        pk_in_crt: 10,
        crt_in_case: 50
      });

    console.log(`Updated ${update20pk} items with 20PK logic.`);

    // 2. Logic for 25 PK items (8 pks/crt, 50 crt/case)
    const update25pk = await db("item_bk")
      .whereIn("category_id", [100, 101, 102, 103, 104, 105, 106, 107])
      .andWhere("description", "like", "%25%")
      .andWhere("description", "like", "%PK%")
      .update({
        pk_in_crt: 8,
        crt_in_case: 50
      });

    console.log(`Updated ${update25pk} items with 25PK logic.`);

    // 3. Fallback: Reset non-tobacco or unknown items to 1/1 to prevent math errors
    // (Optional: only if you want to be strictly safe)
    
  } catch (err) {
    console.error("Error updating tobacco multipliers:", err);
    throw err;
  }
}

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await updateTobaccoMultipliers();
  } catch (err) {
    hadError = true;
    console.error("Sync failed:", err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log("Mongo disconnected.");
    } catch (e) {}
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();
