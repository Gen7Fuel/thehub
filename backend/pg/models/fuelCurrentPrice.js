const { getPg } = require("../../config/pg");

const TABLE = "fuel_current_price";

/**
 * Upserts the current price configuration for a specific station/grade pairing.
 * Updates the price and the updated_at time track on collision.
 * @param {Object} priceData - { site, grade, price }
 */
const upsertCurrentPrice = async (priceData) => {
  const db = getPg();
  const { site, grade, price } = priceData;

  const insertQuery = db(TABLE)
    .insert({
      site,
      grade,
      price,
      updated_at: db.fn.now()
    })
    .toQuery();

  // Handle conflicts seamlessly via native PG engine bindings 
  const upsertQuery = `${insertQuery} ON CONFLICT (site, grade) DO UPDATE SET price = EXCLUDED.price, updated_at = CURRENT_TIMESTAMP RETURNING *;`;

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