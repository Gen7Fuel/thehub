exports.up = async function (knex) {
  // 1. Create Instance Archive Table
  await knex.schema.createTable("cycle_count_instance_archive", (table) => {
    table.integer("id").primary(); // Retain the origin sequential integer footprint safely
    table.text("date").notNullable();
    table.text("day").notNullable();
    table.boolean("is_scheduled").defaultTo(false).nullable();
    table.text("site_mongo_id").notNullable();
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    table.string("scheduled_by", 255).nullable();
    table.integer("group_id").nullable();
    table.string("updated_by", 255).nullable();
  });

  // 2. Create Items Archive Table
  await knex.schema.createTable("cycle_count_items_archive", (table) => {
    table.integer("id").primary(); // Retain the original item unique key
    table.integer("instance_id").notNullable();
    table.integer("product_id").notNullable();
    table.integer("foh").defaultTo(0).nullable();
    table.integer("boh").defaultTo(0).nullable();
    table.boolean("count_completed").defaultTo(false).nullable();
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());
    table.boolean("priority").defaultTo(false).notNullable();
    table.integer("foh_crt").nullable();
    table.integer("boh_crt").nullable();
    table.integer("foh_case").nullable();
    table.integer("boh_case").nullable();

    // Index the tracking relation link for rapid lookup inside history threads
    table.index("instance_id");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("cycle_count_items_archive");
  await knex.schema.dropTableIfExists("cycle_count_instance_archive");
};