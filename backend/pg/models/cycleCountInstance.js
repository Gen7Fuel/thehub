const { getPg } = require("../../config/pg");

const TABLE = "cycle_count_instance";
const ITEMS_TABLE = "cycle_count_items";
const NOTES_TABLE = "cycle_count_instance_notes";

const createInstance = async (data, itemRows) => {
  return getPg().transaction(async (trx) => {
    const [instance] = await trx(TABLE).insert(data).returning("*");
    
    if (itemRows && itemRows.length > 0) {
      const preparedItems = itemRows.map(item => ({
        ...item,
        instance_id: instance.id
      }));
      await trx(ITEMS_TABLE).insert(preparedItems);
    }
    
    return instance;
  });
};

const getFullInstance = async (instanceId) => {
  const instance = await getPg()(TABLE).where({ id: instanceId }).first();
  if (!instance) return null;

  const items = await getPg()(ITEMS_TABLE)
    .join("item_bk", `${ITEMS_TABLE}.product_id`, "item_bk.id")
    .where({ instance_id: instanceId })
    .select(`${ITEMS_TABLE}.*`, "item_bk.upc", "item_bk.description", "item_bk.gtin");

  const notes = await getPg()(NOTES_TABLE)
    .where({ instance_id: instanceId })
    .orderBy("created_at", "asc");

  return { ...instance, items, notes };
};

module.exports = { TABLE, createInstance, getFullInstance };