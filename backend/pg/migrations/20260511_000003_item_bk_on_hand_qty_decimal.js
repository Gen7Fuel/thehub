exports.up = async function up(knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.decimal("on_hand_qty", 14, 4).nullable().alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.integer("on_hand_qty").nullable().alter();
  });
};

