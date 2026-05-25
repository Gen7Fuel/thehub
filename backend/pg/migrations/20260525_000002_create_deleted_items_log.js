exports.up = async function (knex) {
  await knex.schema.createTable("deleted_items_log", (table) => {
    table.increments("id").primary();
    table.text("upc").notNullable();
    table.text("upc_barcode").nullable();
    table.text("description").nullable();
    table.text("gtin").nullable();
    table.text("site").notNullable(); // Stores the MongoDB Location ID
    table.date("removed_at").defaultTo(knex.fn.now()).notNullable(); // Captures the exact historical date
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("deleted_items_log");
};