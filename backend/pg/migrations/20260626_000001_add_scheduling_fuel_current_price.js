/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('fuel_current_price', (table) => {
    table.boolean('is_scheduled').defaultTo(false).notNullable();
    table.timestamp('scheduled_date_time').nullable();
    table.decimal('scheduled_price', 10, 3).nullable(); // Per-grade price column
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('fuel_current_price', (table) => {
    table.dropColumn('is_scheduled');
    table.dropColumn('scheduled_date_time');
    table.dropColumn('scheduled_price');
  });
};