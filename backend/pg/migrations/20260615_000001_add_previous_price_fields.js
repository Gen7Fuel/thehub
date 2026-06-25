/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Add historical tracking fallback to audit logs
  await knex.schema.alterTable('fuel_price_logs', (table) => {
    table.decimal('old_price', 10, 3).nullable(); 
  });

  // 2. Add instant delta layer to current state table
  await knex.schema.alterTable('fuel_current_price', (table) => {
    table.decimal('old_price', 10, 3).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('fuel_price_logs', (table) => {
    table.dropColumn('old_price');
  });

  await knex.schema.alterTable('fuel_current_price', (table) => {
    table.dropColumn('old_price');
  });
};