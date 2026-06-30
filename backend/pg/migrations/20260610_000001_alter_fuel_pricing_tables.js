/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. Alter public.fuel_price_logs table
  await knex.schema.alterTable('fuel_price_logs', (table) => {
    table.text('infonet_image_url').nullable();
    table.string('posted_by', 255).nullable();
    table.string('received_by', 255).nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).nullable();
  });

  // 2. Alter public.fuel_current_price table
  await knex.schema.alterTable('fuel_current_price', (table) => {
    table.string('last_updated_by', 255).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  // Rollback steps to remove fields safely if needed
  await knex.schema.alterTable('fuel_price_logs', (table) => {
    table.dropColumn('infonet_image_url');
    table.dropColumn('posted_by');
    table.dropColumn('received_by');
    table.dropColumn('updated_at');
  });

  await knex.schema.alterTable('fuel_current_price', (table) => {
    table.dropColumn('last_updated_by');
  });
};