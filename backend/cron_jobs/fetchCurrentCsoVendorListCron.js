const { getLatestCsoVendorsList } = require("../services/sqlService");
const { upsertVendorsBatch } = require("../pg/models/csoVendorList");

/**
 * Core ETL service runner that orchestrates syncing SQL Server vendors down to Postgres
 */
async function syncCsoVendors() {
  console.log("--- Starting CSO Vendor List Sync Protocol ---");

  try {
    // 1. Fetch live source data from SQL Server
    const sqlVendors = await getLatestCsoVendorsList();
    console.log(`Fetched ${sqlVendors ? sqlVendors.length : 0} records from SQL Server.`);

    // ==========================================
    // 🛡️ CRITICAL ETL SAFETY GATE
    // ==========================================
    if (!sqlVendors || sqlVendors.length === 0) {
      console.error("🚨 [CRITICAL ALERT] SQL Server returned 0 vendor records! Aborting pipeline execution to protect existing records.");
      return;
    }

    // 2. Transform the payload arrays into clean Postgres schema fields
    const formattedVendors = sqlVendors
      .filter(v => v.VendorCode && v.VendorCode.trim() !== "") // Safeguard against null target lines
      .map(v => ({
        vendor_code: String(v.VendorCode).trim(),
        vendor_name: v.VendorName ? String(v.VendorName).trim() : null,
        fuel: v.Fuel ? String(v.Fuel).trim() : null,
        expenses: v.Expenses ? String(v.Expenses).trim() : null,
        merchandise: v.Merchandise ? String(v.Merchandise).trim() : null,
        lottery: v.Lottery ? String(v.Lottery).trim() : null,
        items_qty: v["Items QTY"] ? String(v["Items QTY"]).trim() : null, // Mapped accurately from spaced text
        edi_compatible: v["EDI Compatible"] ? String(v["EDI Compatible"]).trim() : null,
        wholesaler: v.Wholesaler ? String(v.Wholesaler).trim() : null
      }));

    console.log(`Processing upserts for ${formattedVendors.length} validated vendor records...`);

    // 3. Batch insert/update straight to your table
    const result = await upsertVendorsBatch(formattedVendors);
    console.log(`🎉 Vendor sync completed successfully! Updated/Inserted rows: ${result.length}`);
    
    return result;
  } catch (error) {
    console.error("❌ Critical Failure inside syncCsoVendors engine:", error);
    throw error;
  }
}

module.exports = { syncCsoVendors };