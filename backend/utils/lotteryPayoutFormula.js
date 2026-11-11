// SFT lottery payout rules. Only Sioux Valley includes LOTTO WIN for now.
// Keep location differences here so manual imports and scheduled syncs agree.
const defaultFormula = ['lottoPayout'];
const siteFormulas = new Map([
  ['sioux valley', ['lottoPayout', 'lottoWin']],
]);

function calculateLotteryPayout(site, amounts) {
  const formula = siteFormulas.get(String(site ?? '').trim().toLowerCase()) ?? defaultFormula;
  const values = formula.map(field => amounts[field]).filter(value => value != null);
  if (values.length === 0) return null;
  return Number(values.reduce((sum, value) => sum + value, 0).toFixed(2));
}

module.exports = { calculateLotteryPayout };
