exports.up = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    // Standard nullable date column; defaults to NULL automatically if omitted
    table.date("last_counted_at").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.dropColumn("last_counted_at");
  });
};