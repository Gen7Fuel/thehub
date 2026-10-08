// Validation of the cash-rec lines the browser sends for an Intacct Other
// Receipt. The amounts are the ones the page shows; the server only checks
// they are well formed, drops the ones that must not be entered, and keeps
// the rest in order.

const MAX_LINES = 30

/**
 * @param {unknown} rawLines     [{ key?, glAccount, amount, memo? }]
 * @param {object}  opts
 * @param {string[]} opts.allowedGlAccounts
 * @param {boolean} opts.bankStmtAccess  false drops the line keyed "bankRec"
 * @returns {{ lines: Array<{glAccount, amount, memo}>, error?: string }}
 */
function sanitizeOtherReceiptLines(rawLines, { allowedGlAccounts, bankStmtAccess }) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) return { lines: [], error: 'lines are required' }
  if (rawLines.length > MAX_LINES) return { lines: [], error: 'too many lines' }

  const lines = []
  for (const raw of rawLines) {
    const glAccount = typeof raw?.glAccount === 'string' ? raw.glAccount.trim() : ''
    const amount = typeof raw?.amount === 'number' ? raw.amount : NaN
    if (!allowedGlAccounts.includes(glAccount)) return { lines: [], error: `GL account ${glAccount || '(none)'} is not allowed` }
    if (!Number.isFinite(amount)) return { lines: [], error: 'every line needs a numeric amount' }

    // Entries with a zero value are not made in Intacct.
    const cents = Math.round(amount * 100)
    if (cents === 0) continue
    // Sites without bank statement access get no Bank Rec line.
    if (raw.key === 'bankRec' && bankStmtAccess === false) continue

    const memo = typeof raw.memo === 'string' ? raw.memo.trim().slice(0, 100) : ''
    lines.push({ glAccount, amount: cents / 100, memo })
  }
  return { lines }
}

module.exports = { sanitizeOtherReceiptLines }
