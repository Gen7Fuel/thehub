exports.up = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    // Default to true so everything is eligible until an admin says otherwise
    table.boolean("allow_cycle_count").notNullable().defaultTo(true);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.dropColumn("allow_cycle_count");
  });
};