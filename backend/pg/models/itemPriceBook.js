const { getPg } = require("../../config/pg");

const TABLE = "item_price_book";

const upsertByMongoItemId = async (mongoItemId, patch) => {
  const db = getPg();
  const row = {
    mongo_item_id: String(mongoItemId),
    ...patch,
    updated_at: db.fn.now(),
  };

  // Postgres ON CONFLICT upsert
  const result = await db(TABLE)
    .insert(row)
    .onConflict("mongo_item_id")
    .merge(row)
    .returning("*");

  return result[0] || null;
};

const findByMongoItemId = async (mongoItemId) => {
  const db = getPg();
  return db(TABLE).where({ mongo_item_id: String(mongoItemId) }).first();
};

module.exports = {
  TABLE,
  upsertByMongoItemId,
  findByMongoItemId,
};

