exports.up = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    // We cast to DATE to strip the time/timezone data
    table.date("last_inv_date").nullable().alter();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.timestamp("last_inv_date", { useTz: true }).nullable().alter();
  });
};