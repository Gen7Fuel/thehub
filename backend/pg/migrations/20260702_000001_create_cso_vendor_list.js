/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  await knex.schema.createTable('cso_vendor_list', (table) => {
    table.increments('id').primary(); // Recommended auto-incrementing ID for Postgres
    table.string('vendor_code', 255).nullable();
    table.string('vendor_name', 255).nullable();
    table.string('fuel', 255).nullable();
    table.string('expenses', 255).nullable();
    table.string('merchandise', 255).nullable();
    table.string('lottery', 255).nullable();
    table.string('items_qty', 255).nullable();
    table.string('edi_compatible', 255).nullable();
    table.string('wholesaler', 255).nullable();
    
    // Optional: Standard tracking column to know when data synced from SQL Server
    table.timestamps(true, true); 
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('cso_vendor_list');
};