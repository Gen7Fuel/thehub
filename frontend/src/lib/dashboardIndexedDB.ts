import { openDB } from "idb";

const DB_NAME = "dashboardDB";
const VERSION = 1;

export const STORES = {
  SALES: "dashboard_sales",
  FUEL: "dashboard_fuel",
  TRANS: "dashboard_transactions",
};

export const getDashboardDB = async () => {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORES.SALES)) {
        db.createObjectStore(STORES.SALES);
      }
      if (!db.objectStoreNames.contains(STORES.FUEL)) {
        db.createObjectStore(STORES.FUEL);
      }
      if (!db.objectStoreNames.contains(STORES.TRANS)) {
        db.createObjectStore(STORES.TRANS);
      }
    },
  });
};

// ✅ Save data for a store (sales/fuel/trans)
export const saveDashboardData = async (store: string, data: any) => {
  const db = await getDashboardDB();
  await db.put(store, data, "data"); // single record
};

// ✅ Fetch stored data
export const getDashboardData = async (store: string) => {
  const db = await getDashboardDB();
  return await db.get(store, "data");
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