/**
 * Merges daily sales (Store Total_Sales + Cumulative Fuel Sales Amount) into timesheet records.
 * - Store Sales (TotalSales) uses ISO Date strings.
 * - Fuel Sales (FuelSummary) uses YYYYMMDD string/integer Date_SK.
 */
export function mergeSalesWithTimesheets(timesheets = [], sales = [], fuel = []) {
  // 1. Build lookup for daily store sales: YYYY-MM-DD -> storeSales
  const dailyStoreSales = {};
  sales.forEach((s) => {
    let dateStr = '';
    // TotalSales uses ISO date or Date_SK as ISO format
    const rawDate = s.Date_SK || s.date || s.Date;
    if (rawDate) {
      dateStr = new Date(rawDate).toISOString().split('T')[0];
    }
    if (dateStr) {
      dailyStoreSales[dateStr] = (dailyStoreSales[dateStr] || 0) + (Number(s.Total_Sales) || 0);
    }
  });

  // 2. Build lookup for daily fuel sales amount (cumulative sum across grades): YYYY-MM-DD -> fuelSales
  const dailyFuelSales = {};
  fuel.forEach((f) => {
    let dateStr = '';
    // FuelSummary uses YYYYMMDD format (e.g. 20260301) or businessDate field
    const rawDate = f.businessDate || f.Date_SK;
    if (rawDate) {
      const str = String(rawDate);
      if (str.length === 8 && !str.includes('-')) {
        // Parse YYYYMMDD -> YYYY-MM-DD
        dateStr = `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
      } else {
        dateStr = new Date(rawDate).toISOString().split('T')[0];
      }
    }
    if (dateStr) {
      dailyFuelSales[dateStr] = (dailyFuelSales[dateStr] || 0) + (Number(f.fuelSalesAmount) || 0);
    }
  });

  // 3. Map total sales onto each timesheet row
  return timesheets.map((ts) => {
    let laborDateStr = null;
    if (ts.LaborDate) {
      const str = String(ts.LaborDate);
      if (str.length === 8 && !str.includes('-')) {
        laborDateStr = `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
      } else {
        laborDateStr = new Date(ts.LaborDate).toISOString().split('T')[0];
      }
    }

    const storeSales = dailyStoreSales[laborDateStr] || 0;
    const fuelSales = dailyFuelSales[laborDateStr] || 0;
    const totalSales = storeSales + fuelSales;

    return {
      ...ts,
      LaborDate: laborDateStr,
      storeSales,
      fuelSales,
      totalSales,
    };
  });
}