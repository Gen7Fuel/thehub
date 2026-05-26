const { getPg } = require("../../config/pg");

const TABLE = "cycle_count_instance_notes";

const addNote = async (instanceId, note, userMongoId) => {
  return getPg()(TABLE).insert({
    instance_id: instanceId,
    note,
    user_mongo_id: userMongoId
  }).returning("*");
};

module.exports = { TABLE, addNote };