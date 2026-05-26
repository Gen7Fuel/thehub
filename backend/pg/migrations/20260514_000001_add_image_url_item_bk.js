exports.up = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.text("image_url").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("item_bk", (table) => {
    table.dropColumn("image_url");
  });
};