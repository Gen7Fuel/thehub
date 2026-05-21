exports.up = async function (knex) {
  // 1. Completely drop the unnecessary schedule table
  await knex.schema.dropTableIfExists("cycle_count_schedule");

  // 2. Add group_id to cycle_count_instances as a nullable foreign key
  await knex.schema.alterTable("cycle_count_instance", (table) => {
    table.integer("group_id").nullable();

    table.foreign("group_id")
      .references("id")
      .inTable("public.cycle_count_groups")
      .onDelete("SET NULL"); // Keeps instance records safe if a group is flagged/removed
  });
};

exports.down = async function (knex) {
  // 1. Rollback changes on cycle_count_instances
  await knex.schema.alterTable("cycle_count_instance", (table) => {
    table.dropForeign(["group_id"]);
    table.dropColumn("group_id");
  });

  // 2. Re-create the cycle_count_schedule table if rolling back
  await knex.schema.createTable("cycle_count_schedule", (table) => {
    table.increments("id").primary();
    table.text("date").nullable();
    table.text("day").nullable();
    table.text("site_mongo_id").notNullable();
    table.integer("group_id").notNullable();

    table.foreign("group_id", "cycle_count_schedule_group_id_foreign")
      .references("id")
      .inTable("public.cycle_count_groups");
  });
};