/**
 * item_bk
 * Postgres table for the new Cycle Count "item backup"/price book style data.
 * - Source of truth: Azure SQL query (flattened join)
 * - Cross-db linkage: site is stored as Mongo Location _id (string)
 * - Grade is stored from Mongo CycleCount (fallback "B")
 */

exports.up = async function up(knex) {
  await knex.schema.createTable("item_bk", (table) => {
    table.increments("id").primary();

    table.text("gtin").nullable();
    table.text("upc").notNullable();
    table.text("upc_barcode").nullable();

    // Mongo Location _id string
    table.text("site").notNullable();

    table.text("description").nullable();
    table.text("retail").nullable();

    table.text("vendor_id").nullable();
    table.text("vendor_name").nullable();

    table.integer("category_id").nullable();
    table.text("department_id").nullable();
    table.text("department").nullable();

    table.text("price_group_id").nullable();
    table.text("price_group").nullable();
    table.text("promo_group_id").nullable();
    table.text("promo_group").nullable();

    table.boolean("active").notNullable().defaultTo(true);

    table.integer("on_hand_qty").nullable();
    table.integer("pk_in_crt").nullable();
    table.integer("crt_in_case").nullable();

    table.timestamp("last_inv_date", { useTz: true }).nullable();

    table.text("grade").nullable().defaultTo("B");
    table.timestamp("sync_date", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(["site", "upc"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("item_bk");
};

