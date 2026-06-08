exports.up = async function (knex) {
  // 1. Create Fuel Price Logs Table
  await knex.schema.createTable("fuel_price_logs", (table) => {
    table.increments("id").primary();
    table.text("date").notNullable();
    table.text("day").notNullable();
    table.string("site", 24).notNullable(); // Accommodates 24-character alphanumeric MongoDB ObjectId strings
    
    // Grade constraint check using specified ENUM targets
    table.string("grade").notNullable();
    table.check(`grade IN ('Regular', 'Premium', 'Diesel', 'Dyed Diesel', 'Mid Grade')`, [], 'fuel_price_logs_grade_check');
    
    table.specificType("price", "double precision").notNullable(); // Double precision float for 3-digit decimal accuracy
    table.text("image_url").nullable(); // Verification receipt pathway
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
  });

  // 2. Create Fuel Current Price Table
  await knex.schema.createTable("fuel_current_price", (table) => {
    table.increments("id").primary();
    table.string("site", 24).notNullable();
    
    table.string("grade").notNullable();
    table.check(`grade IN ('Regular', 'Premium', 'Diesel', 'Dyed Diesel', 'Mid Grade')`, [], 'fuel_current_price_grade_check');
    
    table.specificType("price", "double precision").notNullable();
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Enforce a unique constraint on site + grade combinations to allow for reliable database-level upserts
    table.unique(["site", "grade"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("fuel_current_price");
  await knex.schema.dropTableIfExists("fuel_price_logs");
};