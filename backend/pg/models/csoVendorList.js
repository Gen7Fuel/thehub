const { getPg } = require("../../config/pg");

const TABLE = "cso_vendor_list";

/**
 * Upserts a batch of vendors into Postgres using an ON CONFLICT clause on vendor_code.
 * @param {Array<Object>} vendors - Array of vendor objects mapped to snake_case schema fields
 */
const upsertVendorsBatch = async (vendors) => {
  const db = getPg();
  if (!vendors || vendors.length === 0) return [];

  // Generate the base knex insert query string
  const insertQuery = db(TABLE)
    .insert(vendors)
    .toQuery();

  // Handle conflicts natively on the vendor_code unique field
  const upsertQuery = `
    ${insertQuery} 
    ON CONFLICT (vendor_code) DO UPDATE SET 
      vendor_name = EXCLUDED.vendor_name,
      fuel = EXCLUDED.fuel,
      expenses = EXCLUDED.expenses,
      merchandise = EXCLUDED.merchandise,
      lottery = EXCLUDED.lottery,
      items_qty = EXCLUDED.items_qty,
      edi_compatible = EXCLUDED.edi_compatible,
      wholesaler = EXCLUDED.wholesaler,
      updated_at = CURRENT_TIMESTAMP 
    RETURNING *;
  `;

  const result = await db.raw(upsertQuery);
  return result.rows;
};

/**
 * Retrieves all stored local vendors for use on the frontend dropdown menus
 */
const getAllVendors = async () => {
  return getPg()(TABLE).select("*").orderBy("vendor_name", "asc");
};

module.exports = { TABLE, upsertVendorsBatch, getAllVendors };