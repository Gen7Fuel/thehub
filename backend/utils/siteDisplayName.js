/**
 * Maps an internal site name to the name used on customer-facing reports.
 *
 * Shared by the daily EOD reports (eodReportWavers, eodCDReportWavers) and the
 * monthly A/R paid report so the same site never appears under two names.
 *
 * Pure, no dependencies — safe to require from unit tests with no DB.
 */
const formatReportSiteName = (rawSite) => {
  if (!rawSite) return '';
  const cleanSite = rawSite.trim().toLowerCase();

  if (cleanSite === 'wavers west') {
    return 'Wavers of Brokenhead';
  }
  if (cleanSite === 'wavers east') {
    return 'Brokenhead Community Store';
  }
  return rawSite;
};

module.exports = { formatReportSiteName };
