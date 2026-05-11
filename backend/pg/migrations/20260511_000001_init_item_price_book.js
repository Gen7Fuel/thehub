/**
 * Initial Postgres schema for table-formatted data.
 * We keep Mongo document IDs as strings for cross-db linking.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("item_price_book", (table) => {
    table.increments("id").primary();

    // Cross-db linkage: Mongo _id stored as string
    table.text("mongo_item_id").notNullable().unique();

    // Example normalized fields (expand later as cycle count evolves)
    table.text("sku").nullable();
    table.text("name").nullable();

    table.decimal("price", 12, 4).nullable();
    table.text("currency").nullable();

    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("item_price_book");
};

