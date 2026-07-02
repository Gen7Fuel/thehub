/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.alterTable('cso_vendor_list', (table) => {
    // Adds the explicit unique constraint Postgres needs for ON CONFLICT
    table.unique('vendor_code'); 
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.alterTable('cso_vendor_list', (table) => {
    table.dropUnique('vendor_code');
  });
};