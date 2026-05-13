exports.up = async function (knex) {
  await knex.schema.alterTable("cycle_count_items", (table) => {
    // Adding the priority boolean, defaulting to false
    table.boolean("priority").defaultTo(false).notNullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("cycle_count_items", (table) => {
    table.dropColumn("priority");
  });
};