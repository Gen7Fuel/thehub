exports.up = async function (knex) {
  await knex.schema.alterTable("cycle_count_instance", (table) => {
    // Add the scheduled_by column
    table.string("scheduled_by").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("cycle_count_instance", (table) => {
    // Drop the column on rollback
    table.dropColumn("scheduled_by");
  });
};