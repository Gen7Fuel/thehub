const { getPg } = require("../../config/pg");

const TABLE = "fuel_current_price";

/**
 * Upserts the current price configuration for a specific station/grade pairing.
 * Updates the price and the updated_at time track on collision.
 * @param {Object} priceData - { site, grade, price, last_updated_by }
 */
const upsertCurrentPrice = async (priceData) => {
  const db = getPg();
  const { site, grade, price, last_updated_by } = priceData;

  const insertQuery = db(TABLE)
    .insert({
      site,
      grade,
      price,
      last_updated_by: last_updated_by || null,
      updated_at: db.fn.now()
    })
    .toQuery();

  // Handle conflicts seamlessly via native PG engine bindings, matching incoming parameters
  const upsertQuery = `${insertQuery} ON CONFLICT (site, grade) DO UPDATE SET price = EXCLUDED.price, last_updated_by = EXCLUDED.last_updated_by, updated_at = CURRENT_TIMESTAMP RETURNING *;`;

  const result = await db.raw(upsertQuery);
  return result.rows[0];
};

/**
 * Fetches active prices configuration map across the network
 */
const getCurrentPrices = async () => {
  return getPg()(TABLE).select("*");
};

/**
 * Acquires all variant fuel prices specific to a location
 * @param {string} siteMongoId 
 */
const getCurrentPricesBySite = async (siteMongoId) => {
  return getPg()(TABLE).where({ site: siteMongoId });
};

module.exports = { TABLE, upsertCurrentPrice, getCurrentPrices, getCurrentPricesBySite };