const { getPg } = require("../../config/pg");

const TABLE = "item_bk";

const upsertMany = async (rows) => {
  if (!rows.length) return 0;

  await getPg()(TABLE)
    .insert(rows)
    .onConflict(["site", "upc"])
    .merge();

  return rows.length;
};

const countByGrade = async () => {
  return getPg()(TABLE).select("grade").count("* as count").groupBy("grade").orderBy("grade");
};

const truncate = async () => {
  await getPg()(TABLE).truncate();
};

module.exports = {
  TABLE,
  upsertMany,
  countByGrade,
  truncate,
};

