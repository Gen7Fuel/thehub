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

// Enumerate pending actions together with their real IndexedDB keys, so a
// single entry can be deleted/patched without disturbing the rest of the
// queue. The store is autoIncrement (no keyPath), so getAll() alone never
// surfaces keys — getAllKeys() does, in the same result order.
export const getPendingActionEntries = async (): Promise<{ key: number; action: any }[]> => {
  const db = await getDB();
  const tx = db.transaction(PENDING_STORE, 'readonly');
  const keys = await tx.store.getAllKeys();
  const actions = await tx.store.getAll();
  await tx.done;
  return keys.map((key, i) => ({ key: key as number, action: actions[i] }));
};

// Delete exactly one pending action by its IndexedDB key. Prefer this over
// clearPendingActions() when acting on specific entries — a blanket clear()
// can silently drop actions queued concurrently by other code.
export const deletePendingAction = async (key: number): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(PENDING_STORE, 'readwrite');
  await tx.store.delete(key);
  await tx.done;
};

// Patch a single pending action in place (e.g. to mark a permanent sync
// failure) without touching its key or any other queued entry.
export const updatePendingAction = async (key: number, patch: Record<string, any>): Promise<void> => {
  const db = await getDB();
  const tx = db.transaction(PENDING_STORE, 'readwrite');
  const existing = await tx.store.get(key);
  if (existing) {
    await tx.store.put({ ...existing, ...patch }, key);
  }
  await tx.done;
};

// ✅ Get all pending actions. Each object additively includes `_key` (its
// IndexedDB key) so callers that need to delete/patch a specific entry
// (e.g. dismissing one failed purchase order) can do so via
// deletePendingAction/updatePendingAction without affecting the rest.
export const getPendingActions = async () => {
  const entries = await getPendingActionEntries();
  return entries.map(({ key, action }) => ({ ...action, _key: key }));
};

// Clear all pending actions. Kept for compatibility, but prefer
// deletePendingAction(key) for anything acting on specific entries — this
// wipes the entire store, which can drop actions added concurrently.
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

  // Exclude permanently-failed entries — otherwise a 403/404 on a TOGGLE_ITEM
  // would leave this flag set forever, permanently blocking this order from
  // ever refreshing from the server again.
  return actions.some(a => a.orderId === orderId && !a.failed);
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

