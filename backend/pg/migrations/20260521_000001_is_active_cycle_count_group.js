exports.up = async function (knex) {
  await knex.schema.alterTable("cycle_count_groups", (table) => {
    // Add the active status column defaulting to true for existing rows
    table.boolean("is_active").notNullable().defaultTo(true);
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("cycle_count_groups", (table) => {
    // Drop the column on rollback
    table.dropColumn("is_active");
  });
};