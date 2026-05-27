exports.up = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    // Standard nullable integer column; defaults to NULL automatically if omitted
    table.integer("on_hand_at_count").defaultTo(null).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.dropColumn("on_hand_at_count");
  });
};