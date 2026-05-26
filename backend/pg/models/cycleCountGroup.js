const { getPg } = require("../../config/pg");

const TABLE = "cycle_count_groups";
const VALUES_TABLE = "cycle_count_group_values";

const getAllGroups = async () => {
  return getPg()(TABLE)
    .select(`${TABLE}.*`, getPg().raw('json_agg(??.value) as values', [VALUES_TABLE]))
    .leftJoin(VALUES_TABLE, `${TABLE}.id`, `${VALUES_TABLE}.group_id`)
    .groupBy(`${TABLE}.id`);
};

const getById = async (id) => {
  const group = await getPg()(TABLE).where({ id }).first();
  if (!group) return null;
  
  const values = await getPg()(VALUES_TABLE).where({ group_id: id }).select("value");
  group.values = values.map(v => v.value);
  return group;
};

module.exports = { TABLE, getAllGroups, getById };