const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { processAndSendReport } = require("../cron_jobs/auditIssueReportCron");

async function run() {
    let hadError = false;

    try {
        await connectDB(); // Assuming this is defined elsewhere
        console.log('Generating Audit Issues Excel Report...\n');

        const filePath = await processAndSendReport();

        console.log(`Report generated and queued for email: ${filePath}`);

    } catch (err) {
        hadError = true;
        console.error('Report Generation Failed:', err);
    } finally {
        // Keep a slight delay if you need to ensure file is read before disconnect, 
        // though Bull queue usually handles the path later.
        try { await mongoose.disconnect(); } catch { }
        process.exit(hadError ? 1 : 0);
    }
}

if (require.main === module) run();
module.exports = { run };
