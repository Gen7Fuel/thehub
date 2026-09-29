/**
 * Monthly "A/R Paid Report" — every A/R customer entry with a non-zero `paid`
 * amount across a month's shift reports, grouped by site.
 *
 * This module is PURE: no mongoose, no I/O, no Date.now(), no ambient timezone
 * reads. The route supplies the lean CashSummary docs; everything here is a
 * deterministic transform, so it unit-tests without a DB and produces identical
 * output on a UTC container and a local dev box.
 *
 * Every display string the .docx needs is composed here (dateLabel, amountLabel,
 * summaryText, periodLabel). The client never constructs a Date — see the note on
 * docToYmd below for why that matters.
 */
const { formatReportSiteName } = require('./siteDisplayName');

// `paid` was first persisted on 2026-07-03 (commit 47f98a4c). Shift docs written
// before that have `paid: null`, so earlier months would silently report nothing.
const MIN_MONTH = '2026-07';
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Above this many shifts, the summary prose stops enumerating shift numbers and
// switches to a count. A full month is ~90 shifts; the sample enumerated 6 only
// because that month's data was sparse.
const SHIFT_LIST_CAP = 12;

const UNNAMED_CUSTOMER = '(Unnamed)';

const AR_PAID_REPORT_SITES = [
  { site: 'Wavers West', displayName: formatReportSiteName('Wavers West') },
  { site: 'Wavers East', displayName: formatReportSiteName('Wavers East') },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const NUMBER_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty',
];

const EN_DASH = '–';

// ─── Primitives ───────────────────────────────────────────────────────────────

/** 3 -> 'three'; 21 -> '21'. */
function numberWord(n) {
  return Number.isInteger(n) && n >= 0 && n < NUMBER_WORDS.length
    ? NUMBER_WORDS[n]
    : String(n);
}

/**
 * Half-open [start, end) window for a 'YYYY-MM' month, in UTC.
 *
 * Date.UTC(y, 12, 1) normalizes to Jan 1 of y+1 by spec, so December needs no
 * special case — do not hand-roll the year rollover.
 */
function monthWindowUtc(month) {
  const [y, m] = String(month).split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1)),
  };
}

/**
 * Recover the calendar day a shift was filed for, as 'YYYY-MM-DD'.
 *
 * The cash-summary form sends browser-local midnight as an ISO string
 * (frontend .../cash-summary/form.tsx toLocalMidnightISO) and the POST stores it
 * verbatim, so a July 16 Winnipeg shift lands as 2026-07-16T05:00:00.000Z — not
 * UTC midnight. For any negative UTC offset (all of Canada) that stays on the
 * same UTC calendar day, so getUTC* recovers the intended day and does so
 * identically wherever this runs.
 */
function docToYmd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** '2026-07-16' -> 'July 16, 2026'. Formats from the string, never from a Date. */
function formatDateLabel(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** '2026-07-16' -> 'July 16'. */
function formatMonthDay(ymd) {
  const [, m, d] = String(ymd).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Hand-rolled so tests do not depend on the host's ICU data. */
function formatMoney(n) {
  const negative = n < 0;
  const [whole, frac] = Math.abs(n).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${frac}`;
}

/** ['a'] -> 'a'; ['a','b'] -> 'a and b'; ['a','b','c'] -> 'a, b, and c'. */
function joinList(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Dates always fall inside one month, so the year is stated once at the end:
 * 'July 16 and July 17, 2026'.
 */
function formatDateList(ymds) {
  if (ymds.length === 0) return '';
  const year = String(ymds[0]).split('-')[0];
  return `${joinList(ymds.map(formatMonthDay))}, ${year}`;
}

/** '10012, 20014, and 40009'. */
function formatShiftList(shiftNumbers) {
  return joinList(shiftNumbers.map(String));
}

/** Numeric where possible — lexicographically, '9001' would sort after '10012'. */
function compareShiftNumber(a, b) {
  const na = Number(a);
  const nb = Number(b);
  const aIsNum = a !== '' && Number.isFinite(na);
  const bIsNum = b !== '' && Number.isFinite(nb);
  if (aIsNum && bIsNum) {
    if (na !== nb) return na - nb;
    return String(a).localeCompare(String(b));
  }
  if (aIsNum) return -1;
  if (bIsNum) return 1;
  return String(a).localeCompare(String(b));
}

// ─── Prose ────────────────────────────────────────────────────────────────────

function buildCoverageClause({ shiftDateYmds, shiftNumbers }) {
  if (shiftNumbers.length <= SHIFT_LIST_CAP) {
    const shiftWord = shiftNumbers.length === 1 ? 'shift number' : 'shift numbers';
    return `dated ${formatDateList(shiftDateYmds)} (${shiftWord} ${formatShiftList(shiftNumbers)})`;
  }
  const first = shiftDateYmds[0];
  const last = shiftDateYmds[shiftDateYmds.length - 1];
  const year = String(first).split('-')[0];
  return `between ${formatMonthDay(first)} and ${formatMonthDay(last)}, ${year} `
    + `(${shiftNumbers.length} shift reports)`;
}

function buildSummaryText({ displayName, monthLabel, shiftDateYmds, shiftNumbers, payingCustomerCount }) {
  // (C) no shift docs at all — the enumerated template would emit "dated  (shift numbers )".
  if (shiftNumbers.length === 0) {
    return `No shift reports are available for ${displayName} for ${monthLabel}. `
      + 'No accounts receivable (A/R) payments are recorded for this period.';
  }

  const coverage = buildCoverageClause({ shiftDateYmds, shiftNumbers });
  const opening = `This report covers all shift reports available for ${displayName} ${coverage}.`;

  // (B) shifts exist, nobody paid.
  if (payingCustomerCount === 0) {
    return `${opening} No accounts receivable (A/R) customers recorded a payment toward `
      + 'their outstanding balance during this period. All A/R customer entries during this '
      + 'period reflect charges incurred with no payment recorded.';
  }

  // (A) the sample's wording.
  const acrossPhrase = shiftNumbers.length === 1 ? 'Across this shift' : 'Across these shifts';
  const plural = payingCustomerCount === 1 ? '' : 's';
  return `${opening} ${acrossPhrase}, ${numberWord(payingCustomerCount)} accounts receivable `
    + `(A/R) customer${plural} made a payment toward their outstanding balance. All other A/R `
    + 'customer entries during this period reflect charges incurred with no payment recorded.';
}

function buildCoverageLabel(paymentYmds) {
  if (paymentYmds.length === 0) return 'No A/R payments recorded';
  if (paymentYmds.length === 1) {
    return `A/R payments recorded ${formatDateLabel(paymentYmds[0])}`;
  }
  // Always within one month, so collapse to a day range: 'July 16–17, 2026'.
  const first = paymentYmds[0];
  const last = paymentYmds[paymentYmds.length - 1];
  const [y, m, dFirst] = String(first).split('-').map(Number);
  const dLast = Number(String(last).split('-')[2]);
  return `A/R payments recorded ${MONTHS[m - 1]} ${dFirst}${EN_DASH}${dLast}, ${y}`;
}

// ─── Per-site assembly ────────────────────────────────────────────────────────

function buildSiteSection({ site, displayName }, allDocs, monthLabel) {
  const siteDocs = allDocs
    .filter((d) => d && d.site === site)
    .map((d) => ({ doc: d, ymd: docToYmd(d.date) }))
    .filter((entry) => entry.ymd !== null)
    // Copy before sorting — never mutate the caller's array.
    .sort((a, b) => (
      a.ymd < b.ymd ? -1
        : a.ymd > b.ymd ? 1
          : compareShiftNumber(a.doc.shift_number, b.doc.shift_number)
    ));

  const shiftNumbers = siteDocs.map((e) => String(e.doc.shift_number));
  const shiftDateYmds = [...new Set(siteDocs.map((e) => e.ymd))];

  const rows = [];
  let hasNegativeAmounts = false;
  let hasUnnamedCustomers = false;

  for (const { doc, ymd } of siteDocs) {
    if (!Array.isArray(doc.arCustomers)) continue;

    // Merge duplicate names within a single shift so the detail table never shows
    // two rows with an identical Date/Customer/Shift#. Matches the name-keyed merge
    // in eodReportWavers.js — trimmed, but not case-folded.
    const merged = new Map();
    for (const cust of doc.arCustomers) {
      if (!cust) continue;
      const paid = cust.paid;
      // Excludes null (the schema default), 0, undefined, NaN and numeric strings.
      if (!Number.isFinite(paid) || paid === 0) continue;
      const trimmed = typeof cust.name === 'string' ? cust.name.trim() : '';
      const name = trimmed || UNNAMED_CUSTOMER;
      merged.set(name, (merged.get(name) || 0) + Math.round(paid * 100));
    }

    const names = [...merged.keys()].sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      const cents = merged.get(name);
      if (cents === 0) continue; // a charge and its reversal on the same shift
      if (cents < 0) hasNegativeAmounts = true;
      if (name === UNNAMED_CUSTOMER) hasUnnamedCustomers = true;
      const amount = cents / 100;
      rows.push({
        dateYmd: ymd,
        dateLabel: formatDateLabel(ymd),
        customer: name,
        shiftNumber: String(doc.shift_number),
        amount,
        amountLabel: formatMoney(amount),
      });
    }
  }

  // Integer cents throughout, divided once, so 2925.03 + 949.98 is exactly 3875.01.
  const totalCents = rows.reduce((acc, r) => acc + Math.round(r.amount * 100), 0);
  const totalPaid = totalCents / 100;
  const paymentCount = rows.length;
  const payingCustomerCount = new Set(rows.map((r) => r.customer)).size;
  const paymentYmds = [...new Set(rows.map((r) => r.dateYmd))].sort();

  return {
    site,
    displayName,
    hasShifts: siteDocs.length > 0,
    coverageLabel: buildCoverageLabel(paymentYmds),
    summaryText: buildSummaryText({
      displayName, monthLabel, shiftDateYmds, shiftNumbers, payingCustomerCount,
    }),
    shiftCount: shiftNumbers.length,
    shiftNumbers,
    shiftDateYmds,
    payingCustomerCount, // distinct names — drives the prose
    paymentCount, // detail rows — drives "N payments"
    totalPaid,
    totalPaidLabel: formatMoney(totalPaid),
    paymentCountLabel: `${paymentCount} payment${paymentCount === 1 ? '' : 's'}`,
    hasNegativeAmounts,
    hasUnnamedCustomers,
    rows,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * @param {Object} input
 * @param {string} input.month  'YYYY-MM', pre-validated by the caller.
 * @param {Array<{site: string, displayName: string}>} input.siteConfigs
 *        Order determines section order. Sites with no docs still get a section.
 * @param {Array<{site: string, shift_number: string, date: Date|string,
 *                arCustomers?: Array<{name?: string, paid?: number|null}>}>} input.docs
 *        Lean CashSummary docs for the whole month, all sites, any order.
 *        Docs whose site is not in siteConfigs are ignored.
 * @returns {Object} report — see the route for the wire shape.
 */
function buildArPaidReport({ month, siteConfigs = AR_PAID_REPORT_SITES, docs = [] }) {
  const [year, monthNum] = String(month).split('-').map(Number);
  const monthLabel = `${MONTHS[monthNum - 1]} ${year}`;
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const periodLabel = `${MONTHS[monthNum - 1]} 1 ${EN_DASH} ${MONTHS[monthNum - 1]} ${lastDay}, ${year}`;

  const sites = siteConfigs.map((cfg) => buildSiteSection(cfg, docs, monthLabel));

  const grandTotalCents = sites.reduce(
    (acc, s) => acc + Math.round(s.totalPaid * 100),
    0,
  );

  return {
    month,
    monthLabel,
    periodLabel,
    grandTotalPaid: grandTotalCents / 100,
    grandTotalPaidLabel: formatMoney(grandTotalCents / 100),
    grandPaymentCount: sites.reduce((acc, s) => acc + s.paymentCount, 0),
    sites,
  };
}

module.exports = {
  buildArPaidReport,
  AR_PAID_REPORT_SITES,
  MIN_MONTH,
  MONTH_RE,
  SHIFT_LIST_CAP,
  UNNAMED_CUSTOMER,
  monthWindowUtc,
  // Exported for direct unit testing.
  formatMoney,
  formatDateLabel,
  formatDateList,
  formatShiftList,
  numberWord,
  docToYmd,
  compareShiftNumber,
};
