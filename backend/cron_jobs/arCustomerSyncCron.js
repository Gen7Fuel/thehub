const cron = require("node-cron");
const { getArCustomersFromSQL } = require("../services/sqlService");
const { syncArCustomers } = require("../utils/arCustomerSync");
// Scraper retained for fallback reference; SQL Server is now the source of truth.
// const { downloadCsoCustomerExport } = require("../utils/csoArCustomerScrapper");
// const { parseCsoCustomers } = require("../utils/arCustomerSync");

const TIMEZONE = "America/Toronto";
const MIN_RETAINED_RATIO = 0.5;

async function runArCustomerSync() {
  console.log("🤖 [AR Customer Sync] Loading AR customer master from SQL Server...");
  const customers = await getArCustomersFromSQL();

  if (customers.length === 0) {
    throw new Error("SQL AR customer table contained no valid customer rows");
  }

  const ArCustomer = require("../models/ArCustomer");
  const existingCount = await ArCustomer.countDocuments();
  if (existingCount > 0 && customers.length < existingCount * MIN_RETAINED_RATIO) {
    throw new Error(
      `SQL AR customer table has ${customers.length} customers vs ${existingCount} in Hub; refusing to prune`,
    );
  }

  const result = await syncArCustomers(customers);
  console.log(
    `🎉 [AR Customer Sync] ${result.created} created, ${result.updated} updated, ${result.deleted} deleted.`,
  );
  return result;
}

// Daily at 6:00 AM Eastern — syncs directly from the SQL Server source of truth.
cron.schedule("0 6 * * *", async () => {
  try {
    await runArCustomerSync();
  } catch (err) {
    console.error("❌ AR customer sync failed:", err);
  }
}, { timezone: TIMEZONE });

module.exports = { runArCustomerSync };
