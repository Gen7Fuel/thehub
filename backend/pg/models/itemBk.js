const { getPg } = require("../../config/pg");

const TABLE = "item_bk";

const upsertMany = async (rows) => {
  if (!rows.length) return 0;

  await getPg()(TABLE)
    .insert(rows)
    .onConflict(["site", "upc"])
    .merge();

  return rows.length;
};

const countByGrade = async () => {
  return getPg()(TABLE).select("grade").count("* as count").groupBy("grade").orderBy("grade");
};

const truncate = async () => {
  await getPg()(TABLE).truncate();
};

const EXCLUDED_CATEGORIES = [100, 101, 102, 103, 104, 105, 106, 107, 114, 115, 116, 117, 118, 119, 0, 998, 999];

const getRankedItemsForSite = async (siteId) => {
  const db = getPg();

  return db.with('ranked_items', (qb) => {
    qb.select(
      '*',
      db.raw(`
        ROW_NUMBER() OVER (
          PARTITION BY grade 
          ORDER BY 
            last_inv_date ASC NULLS FIRST,  -- 1. Oldest items first (The "Cycle")
            CASE 
              WHEN on_hand_qty <= 0 THEN 0 
              ELSE 1 
            END ASC,                       -- 2. Negatives/Zeros second
            ABS(on_hand_qty) DESC          -- 3. High discrepancies third
        ) as grade_rank
      `)
    )
      .from(TABLE)
      .where({
        site: siteId,
        active: true,
        allow_cycle_count: true
      })
      .whereNotIn('category_id', EXCLUDED_CATEGORIES);
  })
    .select('*')
    .from('ranked_items')
    .orderBy('grade_rank', 'asc');
};

module.exports = {
  TABLE,
  upsertMany,
  countByGrade,
  truncate,
  getRankedItemsForSite,
};

