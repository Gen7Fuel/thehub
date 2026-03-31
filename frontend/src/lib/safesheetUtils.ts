/**
 * Pure utility functions for the safesheet module.
 * Extracted here so they can be unit-tested independently of React.
 */

export type SafesheetEntry = {
  _id: string
  date: string
  description?: string
  cashIn: number
  cashExpenseOut: number
  cashDepositBank: number
  cashOnHandSafe?: number
  createdAt?: string
  updatedAt?: string
  photo?: string | null
  assignedDate?: string
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Zero-pads a single-digit number to 2 digits. */
export const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Formats a Date using the local wall-clock year/month/day (no UTC conversion).
 * Suitable for display in the table where we want "today's date" in the user's timezone.
 */
export const ymdFixed = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Alias of ymdFixed — same implementation, named separately to match component usage. */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Parses a YYYY-MM-DD string to a local-midnight Date.
 * Returns `undefined` for missing, null, or malformed strings.
 */
export const parseYmd = (s?: string): Date | undefined => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/**
 * Formats a Date as "15 Mar '26" using local wall-clock values.
 */
export const fmtDateDisplay = (d: Date): string => {
  const day = d.getDate()
  const month = d.toLocaleString('en-US', { month: 'short' })
  const year = String(d.getFullYear()).slice(2)
  return `${day} ${month} '${year}`
}

// ─── Number formatters ────────────────────────────────────────────────────────

/**
 * Formats a number with 2 decimal places.
 * Returns empty string for 0, null, or undefined (zero is treated as "no entry").
 */
export const fmtNumber = (v?: number | null): string => {
  if (v === null || v === undefined || v === 0) return ''
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

/**
 * Formats a number with 2 decimal places.
 * Unlike fmtNumber, returns "0.00" for zero (used for Cash On Hand column).
 * Returns empty string only for null/undefined.
 */
export const fmtNumberShowZero = (v?: number | null): string => {
  if (v === null || v === undefined) return ''
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

// ─── Running balance ──────────────────────────────────────────────────────────

/**
 * Re-computes the cashOnHandSafe running balance for an ordered list of entries.
 * Used for optimistic UI updates after an inline cell edit.
 */
export const recomputeCashOnHand = (
  entries: SafesheetEntry[],
  initialBalance: number,
): SafesheetEntry[] => {
  let balance = initialBalance
  return entries.map((entry) => {
    balance = balance + entry.cashIn - entry.cashExpenseOut - entry.cashDepositBank
    return { ...entry, cashOnHandSafe: balance }
  })
}

// ─── Sorting helpers (used by formattedEntries memo in the component) ─────────

/**
 * Returns 0 (cashIn), 1 (cashExpenseOut), 2 (cashDepositBank), or 3 (empty).
 * Controls the within-day ordering when entries are sorted by assignedDate.
 */
export const typeRank = (e: {
  cashIn?: number | null
  cashExpenseOut?: number | null
  cashDepositBank?: number | null
}): number => {
  if (Number(e.cashIn || 0) > 0) return 0
  if (Number(e.cashExpenseOut || 0) > 0) return 1
  if (Number(e.cashDepositBank || 0) > 0) return 2
  return 3
}

/**
 * Returns the YYYY-MM-DD key used for sorting.
 * Prefers `assignedDate` if present and valid; falls back to the entry's `date` field.
 */
export const getSortKey = (entry: {
  date: string | Date
  assignedDate?: string
}): string => {
  if (entry.assignedDate && /^\d{4}-\d{2}-\d{2}$/.test(entry.assignedDate)) {
    return entry.assignedDate
  }
  const x = new Date(entry.date as string)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
