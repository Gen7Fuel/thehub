const { getPg } = require("../../config/pg");

const TABLE = "cycle_count_schedule";

const getScheduleForDate = async (siteId, dateString, dayName) => {
  return getPg()(TABLE)
    .where({ site_mongo_id: siteId })
    .andWhere((builder) => {
      builder.where({ date: dateString }).orWhere({ day: dayName });
    })
    .first();
};

module.exports = { TABLE, getScheduleForDate };