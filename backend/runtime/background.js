const WORKER_MODULES = [
  'accessLogQueue', 'actionLogQueue', 'changeLogQueue', 'cdnUploadQueue', 'emailQueue',
  'fuelNotificationQueue', 'fuelOrderDraftQueue', 'gasBuddyQueue', 'gvmQueue',
  'invoiceImageUploadQueue', 'petrosoftQueue', 'priceTimeoutQueue',
];
const CRON_MODULES = [
  'cycleCountCron', 'auditIssueReportCron', 'mongoCsvExportCron', 'logArchiveCron',
  'archiveOldNotification', 'logoutUsersCron', 'dashboardCacheCron', 'dailyFuelSyncCron',
  'weeklyArReportCron', 'itemBkSanitizationCron', 'cycleCountReportCron',
  'syncStgLiveFuelPriceCron', 'syncDailyStgLiveFuelCron', 'fetchBullochShiftsCron',
  'autoSumitCashSummaryReportCron', 'postgresParquetExportCron', 'arCustomerSyncCron',
  'stationAuditVisitorReportCron',
];
async function startBackground(io, onFailure) {
  const { runsWorkers, runsSchedules } = require('./role');
  if (runsWorkers()) {
    for (const name of WORKER_MODULES) require('../queues/' + name);
    require('../queues/csoInvoiceQueue').initCsoInvoiceWorker(io);
    require('../queues/priceScheduleQueue').initPriceScheduleWorker(io);
    require('../queues/writeOffAutomationQueue').initWriteOffAutomationWorker(io);
    require('../queues/stationAuditOrderQueue').initStationAuditOrderWorker(io);
    await require('./workers').startWorkers(onFailure);
  }
  if (runsSchedules()) {
    await require('./scheduler').startLease(require('../utils/redisClient'), onFailure);
    for (const name of CRON_MODULES) require('../cron_jobs/' + name);
    require('../cron_jobs/cycleCountWeeklyInstanceCron').initWeeklyInstanceCron(io);
  }
}
module.exports = { startBackground, WORKER_MODULES, CRON_MODULES };
