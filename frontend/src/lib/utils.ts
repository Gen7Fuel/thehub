import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { domain } from "@/lib/constants"
import { jwtDecode } from "jwt-decode"
import axios from "axios"
import { getPendingActionEntries, deletePendingAction, updatePendingAction, saveOrderRec } from "@/lib/orderRecIndexedDB"
import { isActuallyOnline } from "@/lib/network"
// import { useAuth } from "@/context/AuthContext";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function uploadBase64Image(base64Data: string | null, fileName: string): Promise<any> {
  const response = await axios.post(`/cdn/upload-base64`, {
    base64Data,
    fileName,
  }, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    // Bounds how long a caller waits before treating the connection as
    // unreachable (e.g. to fall back to an offline queue) — axios has no
    // timeout by default, so a stalled connection would otherwise hang far
    // longer than the browser's own "no network" detection.
    timeout: 15000,
  });
  console.log('Uploaded file info:', response.data);
  return response.data;
}

export const formatFleetCardNumber = (number: string) => {
  return number.replace(/(.{4})/g, '$1 ').trim();
};

export function slugToString(slug: string) {
  return slug
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
}

export function slugify(str: string) {
  return str
          .toLowerCase()
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/[^\w-]+/g, '') // Remove all non-word chars
          .replace(/--+/g, '-') // Replace multiple hyphens with a single one
          .replace(/^-+|-+$/g, ''); // Trim hyphens from start and end
}

function calculateTotal(cash: { [s: string]: number }) {
  const denominations = {
    five: 5,
    ten: 10,
    twenty: 20,
    fifty: 50,
    hundred: 100,
    two: 2,
    one: 1,
    quarter: 0.25,
    dime: 0.1,
    nickel: 0.05
  };

  return Object.entries(cash).reduce((total, [key, count]) => {
    return total + (denominations[key as keyof typeof denominations] || 0) * count;
  }, 0);
}

export function calculateData(data: any) {
  if (
    !data ||
    !data.closing_float ||
    !data.closing_float.bill ||
    !data.closing_float.change ||
    !data.opening_float ||
    !data.opening_float.bill ||
    !data.opening_float.change
  ) {
    throw new Error("Invalid data provided");
  }

  // Calculate total closing float (bills and change separately)
  const totalClosingFloatBill = calculateTotal(data.closing_float.bill);
  const totalClosingFloatChange = calculateTotal(data.closing_float.change);
  const totalClosingFloat = totalClosingFloatBill + totalClosingFloatChange;

  // Calculate total opening float (bills and change separately)
  const totalOpeningFloatBill = calculateTotal(data.opening_float.bill);
  const totalOpeningFloatChange = calculateTotal(data.opening_float.change);
  const totalOpeningFloat = totalOpeningFloatBill + totalOpeningFloatChange;

  // Calculate total cash for deposit
  const totalCashForDeposit = totalClosingFloat - data.float_returned_to_bag;

  // Calculate total drops
  const totalDrops = data.drops.reduce((sum: number, drop: any) => sum + drop.amount, 0);

  // Calculate total cash
  const totalCash = totalDrops + totalCashForDeposit;

  // Calculate over/short amount
  const overShortAmount = totalCash - data.shift_report_cash;

  // Determine if it's short or over
  const isShort = overShortAmount < 0;

  return {
    totalClosingFloatBill,
    totalClosingFloatChange,
    totalClosingFloat,
    totalOpeningFloatBill,
    totalOpeningFloatChange,
    totalOpeningFloat,
    totalCashForDeposit,
    totalDrops,
    totalCash,
    overShortAmount: Math.abs(overShortAmount), // Return absolute value for clarity
    isShort,
  };
}

export function formatPhoneNumber(phoneNumber: string) {
  // Remove all non-digit characters
  const cleaned = ('' + phoneNumber).replace(/\D/g, '');

  // Check if the number is valid
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return null;
}

export function getStartAndEndOfToday() {
  const now = new Date();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function formatStatusCardNumber(statusCardNumber: string) {
  // Remove all non-digit characters
  const cleaned = ('' + statusCardNumber).replace(/\D/g, '');

  // Check if the number is valid
  const match = cleaned.match(/^(\d{5})(\d{5})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return null;
}

/**
 * Converts a decimal number to a string with commas.
 * @param {string} num - The decimal number.
 * @param {number} decimalPlaces - Number of minimum decimal places.
 * @returns {string} - The formatted number string.
 */
export function applyComma(num: number, decimalPlaces= 0) {
  let response;
  response = String(Number(num).toLocaleString('en-US', { minimumFractionDigits: decimalPlaces }));
  if (num < 0) {
    num *= -1;
    response = "(" + String(Number(num).toLocaleString('en-US', { minimumFractionDigits: decimalPlaces })) + ")";
  }
  return response;
};

/**
 * Converts a snake_case string to Title Case.
 * @param {string} str - The snake_case string.
 * @returns {string} - The Title Case string.
 */
export const snakeToTitleCase = (str: String) => {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Converts a camelCase string to Title Case.
 * @param {string} str - The camelCase string.
 * @returns {string} - The Title Case string.
 */
export function camelCaseToTitleCase(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, s => s.toUpperCase()) // Capitalize first letter
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}


/**
 * Send email via backend API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} content - Email content (can be HTML or plain text)
 * @param {boolean} isHtml - Whether content is HTML (default: false)
 * @returns {Promise} - Promise resolving to response
 */
export async function sendEmail({
  to,
  cc,
  subject,
  content,
  isHtml = false
}: {
  to: string;
  cc: string[];
  subject: string;
  content: string;
  isHtml?: boolean;
}) {
  try {
    const response = await axios.post(`${domain}/api/send-email`, {
      to,
      cc,
      subject,
      text: isHtml ? '' : content,
      html: isHtml ? content : ''
    }, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });
    console.log('Email sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

/**
 * Send bulk emails via backend API
 * @param {string[]} recipients - Array of recipient email addresses
 * @param {string} subject - Email subject
 * @param {string} content - Email content
 * @param {boolean} isHtml - Whether content is HTML (default: false)
 * @returns {Promise} - Promise resolving to response
 */
export async function sendBulkEmail({
  recipients,
  subject,
  content,
  isHtml = false
}: {
  recipients: string[];
  subject: string;
  content: string;
  isHtml?: boolean;
}) {
  try {
    const response = await axios.post(`${domain}/api/send-bulk-email`, {
      recipients,
      subject,
      text: isHtml ? '' : content,
      html: isHtml ? content : ''
    }, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });
    console.log('Bulk emails sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending bulk emails:', error);
    throw error;
  }
}

const user = localStorage.getItem('TimeZone')
/**
 * Converts a date string from the user's timezone to UTC.
 * @param {string} dateString - The date string to convert (e.g., "2025-07-25T10:00:00")
 * @returns {string} - The UTC date string in ISO format
 */
export function toUTCstring(dateString: string): string {
  const timezone = user || 'UTC';
  
  // Create a date object treating the input as being in the user's timezone
  const date = new Date(dateString);
  
  // Get the timezone offset in minutes
  const tempDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offset = utcDate.getTime() - tempDate.getTime();
  
  // Apply the offset to get the correct UTC time
  const utcResult = new Date(date.getTime() + offset);
  
  return utcResult.toISOString();
}
/**
 * Converts a date to UTC based on the user's timezone stored in localStorage.
 * @param {Date} date - The date to convert.
 * @returns {Date} - The UTC date.
 */
export function toUTC(date: Date): Date {
  const timezone = user || 'UTC';
  const utcTime = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const localTime = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcTime.getTime() - localTime.getTime();
  return new Date(date.getTime() + offset);
}


/**
 * Checks if a JWT token is expired.
 * @param {string | null} token - The JWT token to check.
 * @returns {boolean} - True if the token is expired, false otherwise.
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds, Date.now() is in ms
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Fetches vendor name by vendor ID.
 * @param {string} vendorId - The vendor's MongoDB ObjectId.
 * @returns {Promise<string | null>} - The vendor name, or null if not found.
 */
export async function getVendorNameById(vendorId: string): Promise<string | null> {
  try {
    const response = await axios.get(`/api/vendors/${vendorId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.data?.name ?? null;
  } catch (error) {
    console.error('Error fetching vendor name:', error);
    return null;
  }
}

// get csoCode by station name
export async function getCsoCodeByStationName(stationName: string): Promise<string | null> {
  try {
    const response = await axios.get(`/api/locations/name/${encodeURIComponent(stationName)}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    });
    return response.data?.csoCode ?? null;
  } catch (error) {
    console.error('Error fetching CSO code:', error);
    return null;
  }
}

// get status color for order rec status
export const getOrderRecStatusColor = (status?: string) => {
  switch (status) {
    case "Created":
      return "#fde68a"; // light yellow
    case "Placed":
      return "#bfdbfe"; // light blue
    case "Not Placed":
      return "#979797ff"; // dark grey
    case "Completed":
      return "#fdba74"; // light orange/golden
    case "Delivered":
      return "#bbf7d0"; // light green
    case "Invoice Received":
      return "#fbcfe8"; // light rose pink
    default:
      return "#f3f4f6"; // default light grey
  }
};

//Decoding jwt token helper function
interface User {
  id?: string;
  email?: string;
  location?: string;
  initials?: string;
  name?: string;
  timezone?: string;
  access?: any;
}

export const getDecodedToken = (): User | null => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return jwtDecode<User>(token);
  } catch (err) {
    console.error("Failed to decode token:", err);
    return null;
  }
};

//function for converting cameltext case of permissions to normal capitalize text
export function camelCaseToCapitalized(text: String) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before each uppercase letter
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
    .join(' ');
}

// Replays a single queued action against the backend. Shared by
// syncPendingActions()'s loop below — kept as its own function so the loop
// body stays readable.
async function syncOneAction(action: any): Promise<void> {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  if (action.type === "TOGGLE_ITEM") {
    await axios.put(
      `/api/order-rec/${action.orderId}/item/${action.catIdx}/${action.itemIdx}`,
      { completed: action.completed, isChanged: action.isChanged },
      { headers: authHeader }
    );
    const res = await axios.get(`/api/order-rec/${action.orderId}`, { headers: authHeader });
    const latest = { ...res.data, id: res.data._id, _id: res.data._id };
    await saveOrderRec(latest);
    console.log("✅ Synced and refreshed TOGGLE_ITEM order record:", latest.id);
  }

  else if (action.type === "UPDATE_ORDER_REC") {
    const orderId = action.id;
    const res = await axios.put(
      `/api/order-rec/${orderId}`,
      { categories: action.payload.categories },
      { headers: authHeader }
    );
    const latest = { ...res.data, id: res.data._id, _id: res.data._id };
    await saveOrderRec(latest);
    console.log("✅ Synced and refreshed UPDATE_ORDER_REC order record:", latest.id);
  }

  else if (action.type === "CREATE_PURCHASE_ORDER") {
    const { filename } = await uploadBase64Image(action.receipt, "receipt.jpg");
    await axios.post(
      "/api/purchase-orders",
      { ...action.payload, receipt: filename },
      { headers: { ...authHeader, "X-Required-Permission": "po" } }
    );
    console.log("✅ Synced CREATE_PURCHASE_ORDER for", action.payload?.customerName);
  }

  else if (action.type === "SAVE_EXTRA_NOTE") {
    const res = await axios.patch(
      `/api/order-rec/${action.orderId}`,
      { extraItemsNote: action.note },
      { headers: authHeader }
    );
    const latest = { ...res.data, id: res.data._id, _id: res.data._id };
    await saveOrderRec(latest);
    console.log("✅ Synced and refreshed SAVE_EXTRA_NOTE order record:", latest.id);
  }

  else {
    throw new Error(`Unknown pending action type: ${action.type}`);
  }
}

// HTTP failures that will NEVER succeed no matter how many times we retry —
// e.g. 403 (permission denied) and 409 (duplicate PO number, see
// backend/routes/purchaseOrder.js). Leaving these queued forever would mean
// a silent, unexplained "pending" limbo with no path to resolution.
// Everything else (no response at all = network/timeout, 5xx, 408, 429) is
// transient and stays queued for the next pass.
function isPermanentFailure(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status == null) return false; // network/timeout — retryable
    if (status === 408 || status === 429) return false; // explicitly transient
    return status >= 400 && status < 500;
  }
  // A non-axios error means our own sync code threw (e.g. an unrecognized
  // action.type) — retrying won't fix that either.
  return true;
}

function describeSyncFailure(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message || "Sync failed.";
  }
  return err instanceof Error ? err.message : "Sync failed.";
}

// Guards against overlapping sync passes — syncPendingActions() can now be
// triggered from multiple places close together (a submit's own
// triggerBackgroundSync(), the navbar's `online` listener, and its 15s
// poll), and without this a fast-firing pair of calls could both pick up
// the same pending action and, e.g., upload the same receipt photo twice.
let syncInFlight = false;

//function for syncing queued offline actions (order rec + purchase orders) with the backend
export async function syncPendingActions() {
  if (syncInFlight) {
    console.log("🛰️ Sync already in progress — skipping overlapping call");
    return;
  }
  syncInFlight = true;

  try {
    // Loops passes until a pass makes zero progress (nothing left to sync,
    // or everything remaining is a transient failure) — re-reading the
    // queue fresh every pass means anything queued concurrently (e.g. a
    // second PO submitted mid-sync) is picked up instead of lost, unlike
    // the previous snapshot+clear()-the-whole-store design.
    while (true) {
      await new Promise(res => setTimeout(res, 300));

      const entries = await getPendingActionEntries();
      const actionable = entries.filter(({ action }) => !action.failed);
      if (!actionable.length) break;

      console.log(`🛰️ Syncing ${actionable.length} pending actions...`);
      let madeProgress = false;

      for (const { key, action } of actionable) {
        try {
          await syncOneAction(action);
          await deletePendingAction(key); // remove ONLY this entry
          madeProgress = true;
        } catch (err) {
          if (isPermanentFailure(err)) {
            await updatePendingAction(key, {
              failed: true,
              failureReason: describeSyncFailure(err),
              failedAt: Date.now(),
            });
            madeProgress = true; // resolved into a terminal state, not stuck
            console.error("🛑 Permanent failure, will not retry:", action.type, key, err);
          } else {
            console.warn("⚠️ Transient failure, left queued for retry:", action.type, key, err);
          }
        }
      }

      // Nothing changed this pass — whatever's left is a transient failure
      // that just failed again. Stop instead of hot-looping; the next
      // `online` event / 15s poll / triggerBackgroundSync() call retries.
      if (!madeProgress) break;
    }
  } finally {
    syncInFlight = false;
  }

  console.log("✅ Pending sync pass done");
}

// Best-effort background sync trigger, meant to be called WITHOUT awaiting
// (fire-and-forget). isActuallyOnline() can itself take up to ~12s on a
// degraded connection, but since callers don't await this, that delay is
// invisible to them — it only affects how soon a genuinely-online user's
// queued item leaves the "pending" state.
export async function triggerBackgroundSync(): Promise<void> {
  try {
    if (await isActuallyOnline()) {
      await syncPendingActions();
    }
  } catch (err) {
    console.warn("Background sync attempt failed to start:", err);
  }
}

