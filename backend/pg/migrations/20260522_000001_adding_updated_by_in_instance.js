exports.up = async function (knex) {
  await knex.schema.alterTable("cycle_count_instance", (table) => {
    // Add the updated_by column
    table.string("updated_by").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("cycle_count_instance", (table) => {
    // Drop the column on rollback
    table.dropColumn("updated_by");
  });
};