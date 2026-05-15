exports.up = async function (knex) {
  await knex.schema.alterTable("cycle_count_items", (table) => {
    // Adding the priority boolean, defaulting to false
    table.integer("foh_crt").defaultTo(null).nullable();
    table.integer("boh_crt").defaultTo(null).nullable();
    table.integer("foh_case").defaultTo(null).nullable();
    table.integer("boh_case").defaultTo(null).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("cycle_count_items", (table) => {
    table.dropColumn("foh_crt");
    table.dropColumn("boh_crt");
    table.dropColumn("foh_case");
    table.dropColumn("boh_case");
  });
};