exports.up = async function (knex) {
  // 1. Groups
  await knex.schema.createTable("cycle_count_groups", (table) => {
    table.increments("id").primary();
    table.text("name").notNullable();
    table.text("filter_column").notNullable(); 
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });

  // 2. Group Values
  await knex.schema.createTable("cycle_count_group_values", (table) => {
    table.increments("id").primary();
    table.integer("group_id").unsigned().notNullable()
      .references("id").inTable("cycle_count_groups").onDelete("CASCADE");
    table.text("value").notNullable();
  });

  // 3. Schedule
  await knex.schema.createTable("cycle_count_schedule", (table) => {
    table.increments("id").primary();
    table.text("date").nullable(); 
    table.text("day").nullable(); 
    table.text("site_mongo_id").notNullable();
    table.integer("group_id").unsigned().notNullable()
      .references("id").inTable("cycle_count_groups");
  });

  // 4. Instance
  await knex.schema.createTable("cycle_count_instance", (table) => {
    table.increments("id").primary();
    table.text("date").notNullable(); // YYYY-MM-DD
    table.text("day").notNullable();
    table.boolean("is_scheduled").defaultTo(false);
    table.text("site_mongo_id").notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.unique(["date", "site_mongo_id"]);
  });

  // 5. Items
  await knex.schema.createTable("cycle_count_items", (table) => {
    table.increments("id").primary();
    table.integer("instance_id").unsigned().notNullable()
      .references("id").inTable("cycle_count_instance").onDelete("CASCADE");
    table.integer("product_id").unsigned().notNullable()
      .references("id").inTable("item_bk");
    table.integer("foh").defaultTo(0);
    table.integer("boh").defaultTo(0);
    table.boolean("count_completed").defaultTo(false);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.unique(["instance_id", "product_id"]);
  });

  // 6. Instance Notes (The Thread)
  await knex.schema.createTable("cycle_count_instance_notes", (table) => {
    table.increments("id").primary();
    table.integer("instance_id").unsigned().notNullable()
      .references("id").inTable("cycle_count_instance").onDelete("CASCADE");
    table.text("note").notNullable();
    table.text("user_mongo_id").notNullable(); // Reference to your Mongo User
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("cycle_count_instance_notes");
  await knex.schema.dropTableIfExists("cycle_count_items");
  await knex.schema.dropTableIfExists("cycle_count_instance");
  await knex.schema.dropTableIfExists("cycle_count_schedule");
  await knex.schema.dropTableIfExists("cycle_count_group_values");
  await knex.schema.dropTableIfExists("cycle_count_groups");
};