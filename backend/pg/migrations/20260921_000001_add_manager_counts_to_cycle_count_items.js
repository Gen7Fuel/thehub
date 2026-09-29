/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const managerCols = [
    'manager_foh',
    'manager_boh',
    'manager_foh_crt',
    'manager_boh_crt',
    'manager_foh_case',
    'manager_boh_case',
  ];

  // Helper to safely add or modify columns to allow NULL without default 0
  const syncTableColumns = async (tableName) => {
    for (const col of managerCols) {
      const exists = await knex.schema.hasColumn(tableName, col);

      if (!exists) {
        await knex.schema.alterTable(tableName, (table) => {
          table.integer(col).nullable();
        });
      } else {
        // If column exists from previous run, drop default '0' and alter to nullable
        await knex.schema.alterTable(tableName, (table) => {
          table.integer(col).nullable().defaultTo(null).alter();
        });
      }
    }
  };

  // 1. Process live table
  await syncTableColumns('cycle_count_items');

  // 2. Process archive table
  await syncTableColumns('cycle_count_items_archive');

  // 3. Clear out any existing 0 defaults created by the initial run, setting them to NULL
  await knex('cycle_count_items')
    .whereIn('manager_foh', [0])
    .update({ manager_foh: null });

  await knex('cycle_count_items')
    .whereIn('manager_boh', [0])
    .update({ manager_boh: null });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  const managerCols = [
    'manager_foh',
    'manager_boh',
    'manager_foh_crt',
    'manager_boh_crt',
    'manager_foh_case',
    'manager_boh_case',
  ];

  const removeTableColumns = async (tableName) => {
    for (const col of managerCols) {
      const exists = await knex.schema.hasColumn(tableName, col);
      if (exists) {
        await knex.schema.alterTable(tableName, (table) => {
          table.dropColumn(col);
        });
      }
    }
  };

  await removeTableColumns('cycle_count_items');
  await removeTableColumns('cycle_count_items_archive');
};