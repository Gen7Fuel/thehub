/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  for (const tableName of ['cycle_count_instance', 'cycle_count_instance_archive']) {
    if (await knex.schema.hasColumn(tableName, 'count_finalized')) continue;

    await knex.schema.alterTable(tableName, (table) => {
      table.boolean('count_finalized').notNullable().defaultTo(false);
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  for (const tableName of ['cycle_count_instance', 'cycle_count_instance_archive']) {
    if (!(await knex.schema.hasColumn(tableName, 'count_finalized'))) continue;

    await knex.schema.alterTable(tableName, (table) => {
      table.dropColumn('count_finalized');
    });
  }
};
