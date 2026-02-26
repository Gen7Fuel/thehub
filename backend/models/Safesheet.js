const mongoose = require('mongoose');
const { Schema } = mongoose;

// Helpers to prevent float drift
const round2 = (v) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};
const toCents = (v) => Math.round(Number(v || 0) * 100);

/**
 * Entry subdocument - represents a single row in the safe/cash sheet.
 */
const EntrySchema = new Schema({
  date: { type: Date, required: true },
  description: { type: String, default: '' },
  cashIn: { type: Number, default: 0 },
  cashExpenseOut: { type: Number, default: 0 },
  cashDepositBank: { type: Number, default: 0 },
  photo: { type: String, default: '' },
}, { timestamps: true });

/**
 * Safesheet document - holds metadata and an array of entries.
 * The running balance (cashOnHandSafe) is not stored; it's computed on demand.
 */
const SafesheetSchema = new Schema({
  site: { type: String, required: true, index: true, unique: true }, // unique site identifier
  initialBalance: { type: Number, default: 0 }, // starting safe balance before entries
  entries: { type: [EntrySchema], default: [] },
}, { timestamps: true });

// Normalize money fields on every save
SafesheetSchema.pre('save', function normalizeMoney(next) {
  this.initialBalance = round2(this.initialBalance);
  if (Array.isArray(this.entries)) {
    this.entries.forEach((e) => {
      e.cashIn = round2(e.cashIn);
      e.cashExpenseOut = round2(e.cashExpenseOut);
      e.cashDepositBank = round2(e.cashDepositBank);
    });
  }
  next();
});

/**
 * Instance method:
 * Returns the entries sorted by date (then by createdAt) with a computed running balance
 * for each row named `cashOnHandSafe`.
 */
SafesheetSchema.methods.getEntriesWithRunningBalance = function () {
  const rows = (this.entries || []).map((e, i) => ({ i, ...(e.toObject?.() ?? e) }))

  const ymdLocal = (d) => {
    const x = new Date(d)
    const y = x.getFullYear()
    const m = String(x.getMonth() + 1).padStart(2, '0')
    const day = String(x.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const typeRank = (e) => {
    const ci = Number(e.cashIn || 0)
    const ce = Number(e.cashExpenseOut || 0)
    const cb = Number(e.cashDepositBank || 0)
    if (ci > 0) return 0           // cashIn first
    if (ce > 0) return 1           // expenses next
    if (cb > 0) return 2           // bank deposit last
    return 3
  }

  // Sort by calendar day (local) ASC, then by type rank, then stable by original index
  rows.sort((a, b) => {
    const da = ymdLocal(a.date)
    const db = ymdLocal(b.date)
    if (da !== db) return da.localeCompare(db)
    const ra = typeRank(a)
    const rb = typeRank(b)
    if (ra !== rb) return ra - rb
    return a.i - b.i
  })

  // Recompute running balance using integer cents to avoid float drift
  let cents = toCents(this.initialBalance || 0)
  return rows.map((e) => {
    cents += toCents(e.cashIn)
    cents -= toCents(e.cashExpenseOut)
    cents -= toCents(e.cashDepositBank)
    return { ...e, cashOnHandSafe: cents / 100 }
  })
}
// SafesheetSchema.methods.getEntriesWithRunningBalance = function () {
//   // clone and sort entries to avoid mutating the document in memory
//   const sorted = [...this.entries].sort((a, b) => {
//     const da = +new Date(a.date);
//     const db = +new Date(b.date);
//     if (da !== db) return da - db;
//     // tie-breaker by creation time (timestamps) or _id
//     if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
//     return String(a._id).localeCompare(String(b._id));
//   });

//   let running = Number(this.initialBalance || 0);
//   return sorted.map(e => {
//     // Increment/Decrement rules:
//     // - cashIn increases safe
//     // - cashExpenseOut decreases safe
//     // - cashDepositBank decreases safe (money deposited to bank)
//     const cashIn = Number(e.cashIn || 0);
//     const expense = Number(e.cashExpenseOut || 0);
//     const deposit = Number(e.cashDepositBank || 0);

//     running = running + cashIn - expense - deposit;

//     return {
//       _id: e._id,
//       date: e.date,
//       description: e.description,
//       cashIn,
//       cashExpenseOut: expense,
//       cashDepositBank: deposit,
//       cashOnHandSafe: Number(running.toFixed(2)),
//       createdAt: e.createdAt,
//       updatedAt: e.updatedAt,
//     };
//   });
// };

/**
 * Convenience static to add an entry and return entries with running balances.
 * Usage: Safesheet.addEntry(sheetId, entryData)
 */
SafesheetSchema.statics.addEntry = async function (sheetId, entryData) {
  const sheet = await this.findById(sheetId);
  if (!sheet) throw new Error('Safesheet not found');

  sheet.entries.push(entryData);
  await sheet.save();
  return sheet.getEntriesWithRunningBalance();
};

/**
 * Optional: compute running balances for a list of safesheets or raw entries array
 * Static helper for re-use (pure function).
 */
SafesheetSchema.statics.computeRunning = function (entries, initialBalance = 0) {
  const sorted = [...entries].sort((a, b) => {
    const da = +new Date(a.date);
    const db = +new Date(b.date);
    if (da !== db) return da - db;
    if (a.createdAt && b.createdAt) return a.createdAt - b.createdAt;
    return String(a._id || '').localeCompare(String(b._id || ''));
  });

  let running = Number(initialBalance || 0);
  return sorted.map(e => {
    const cashIn = Number(e.cashIn || 0);
    const expense = Number(e.cashExpenseOut || 0);
    const deposit = Number(e.cashDepositBank || 0);
    running = running + cashIn - expense - deposit;
    return { ...e, cashOnHandSafe: Number(running.toFixed(2)) };
  });
};

/**
 * Returns end-of-day balances and bank deposits for last N days
 */
/**
 * Returns end-of-day balances and bank deposits filtered by a specific date range
 * @param {string} from - YYYY-MM-DD
 * @param {string} to - YYYY-MM-DD
 */
SafesheetSchema.methods.getDailyBalances = function (from, to) {
  // Get all entries with computed running balances
  const entries = this.getEntriesWithRunningBalance();

  const dayKey = (d) => {
    const x = new Date(d);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dailyMap = new Map();

  for (const e of entries) {
    const key = dayKey(e.date);

    // FILTER: Only process entries within the requested range
    if (from && key < from) continue;
    if (to && key > to) continue;

    if (!dailyMap.has(key)) {
      dailyMap.set(key, {
        date: key,
        endOfDayBalance: e.cashOnHandSafe,
        bankDepositTotal: Number(e.cashDepositBank || 0),
      });
    } else {
      const d = dailyMap.get(key);
      // The last entry processed for a day will represent the end-of-day balance
      d.endOfDayBalance = e.cashOnHandSafe;
      d.bankDepositTotal += Number(e.cashDepositBank || 0);
    }
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};


module.exports = mongoose.model('Safesheet', SafesheetSchema);