import { openDB } from 'idb';

const DB_NAME = 'orderRecDB';
const ORDER_STORE = 'orderRecs';
const PENDING_STORE = 'pendingActions';

export const getDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      // Store for order rec documents
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        const orderStore = db.createObjectStore(ORDER_STORE, { keyPath: 'id' });
        orderStore.createIndex('id', 'id', { unique: true });
      }

      // Store for offline actions (sync queue)
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { autoIncrement: true });
      }
    },
  });
};

// ✅ Save or update an orderRec
export const saveOrderRec = async (orderRec: any) => {
  const db = await getDB();
  await db.put(ORDER_STORE, orderRec);
};

// ✅ Get orderRec by ID
export const getOrderRecById = async (id: string) => {
  const db = await getDB();
  return await db.get(ORDER_STORE, id);
};

// ✅ Save a pending action (for offline sync queue)
export const savePendingAction = async (action: any) => {
  const db = await getDB();
  const tx = db.transaction(PENDING_STORE, 'readwrite');
  await tx.store.add(action);
  await tx.done;
};

// ✅ Get all pending actions
export const getPendingActions = async () => {
  const db = await getDB();
  return db.getAll(PENDING_STORE);
};

// ✅ Clear all pending actions after successful sync
export const clearPendingActions = async () => {
  const db = await getDB();
  const tx = db.transaction(PENDING_STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
};

// check for pending actions if any
// export const hasPendingActions = async (): Promise<boolean> => {
//   const db = await getDB();
//   const tx = db.transaction("pendingActions", "readonly");
//   const count = await tx.store.count();
//   return count > 0;
// };
export const hasPendingActionsForId = async (orderId: string) => {
  const db = await getDB();
  const actions = await db.getAll(PENDING_STORE);

  return actions.some(a => a.orderId === orderId);
};

// delete any pending actions for a order rec if order is deleted
export const deletePendingActionsForId = async (orderId: string) => {
  const db = await getDB();

  // 🔥 1. Delete pending actions
  const tx1 = db.transaction(PENDING_STORE, 'readwrite');
  const store1 = tx1.store;

  const keys = await store1.getAllKeys();
  const actions = await store1.getAll();

  for (let i = 0; i < actions.length; i++) {
    if (actions[i].orderId === orderId) {
      await store1.delete(keys[i]);
    }
  }
  await tx1.done;

  // 🔥 2. Delete cached order rec
  const tx2 = db.transaction(ORDER_STORE, 'readwrite');
  await tx2.store.delete(orderId);  // uses keyPath (id)
  await tx2.done;

  return true;
};

// clear index db
export const clearLocalDB = async () => {
  try {
    await indexedDB.deleteDatabase(DB_NAME);
    console.log("🧹 IndexedDB cleared on logout");
  } catch (err) {
    console.error("❌ Failed to clear IndexedDB:", err);
  }
};

