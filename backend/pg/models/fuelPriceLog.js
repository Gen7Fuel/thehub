const { getPg } = require("../../config/pg");

const TABLE = "fuel_price_logs";

/**
 * Appends a new price alteration record to historical tracks.
 * No updates or deletions allowed.
 * @param {Object} logData - { date, day, site, grade, price, image_url }
 */
const createLog = async (logData) => {
  return getPg()(TABLE)
    .insert({
      date: logData.date,
      day: logData.day,
      site: logData.site,
      grade: logData.grade,
      price: logData.price,
      image_url: logData.image_url || null
    })
    .returning("*");
};

/**
 * Fetches all historical pricing log details
 */
const getAllLogs = async () => {
  return getPg()(TABLE).select("*").orderBy("created_at", "desc");
};

/**
 * Retrieves logs for a specific station site
 * @param {string} siteMongoId
 */
const getLogsBySite = async (siteMongoId) => {
  return getPg()(TABLE)
    .where({ site: siteMongoId })
    .orderBy("created_at", "desc");
};

module.exports = { TABLE, createLog, getAllLogs, getLogsBySite };