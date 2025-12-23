import { openDB } from "idb";

const DB_NAME = "dashboardDB";
const VERSION = 1;

export const STORES = {
  SALES: "dashboard_sales",
  FUEL: "dashboard_fuel",
  TRANS: "dashboard_transactions",
  TIME_PERIOD_TRANS: "dashboard_time_period_transactions",
  TENDER_TRANS: "dashboard_tender_transactions",
  BISTRO_WOW_SALES: "dashboard_bistro_wow_sales",
  TOP_10_BISTRO: "dashboard_top_10_bistro",
};

export const getDashboardDB = async () => {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    },
  });
};

// ✅ Save data for a store and site
export const saveDashboardData = async (store: string, site: string, data: any) => {
  const db = await getDashboardDB();
  await db.put(store, data, site); // use site as the key
};


// ✅ Fetch stored data for a store and site
export const getDashboardData = async (store: string, site: string) => {
  const db = await getDashboardDB();
  return await db.get(store, site);
};


// ✅ Clear database on logout
export const clearDashboardDB = async () => {
  try {
    await indexedDB.deleteDatabase(DB_NAME);
    console.log("🧹 Dashboard IndexedDB cleared");
  } catch (err) {
    console.error("❌ Failed to clear dashboard IndexedDB:", err);
  }
};