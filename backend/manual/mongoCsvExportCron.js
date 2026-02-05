const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { exportToAzureCSV } = require('../cron_jobs/mongoCsvExportCron');
// Import your Mongoose models here
const AuditTemplate = require("../models/audit/auditTemplate");

async function run() {
    let hadError = false;

    try {
        await connectDB();
        console.log('🚀 Starting Manual CSV Export to Azure...\n');

        // You can loop through multiple models here if needed
        const blobName = await exportToAzureCSV(AuditTemplate, 'audit_templates');

        console.log(`✔ Export successful! File stored at: ${blobName}`);

    } catch (err) {
        hadError = true;
        console.error('❌ Export Failed:', err);
    } finally {
        try { 
            await mongoose.disconnect(); 
            console.log('Database disconnected.');
        } catch (e) { }
        process.exit(hadError ? 1 : 0);
    }
}

if (require.main === module) run();
module.exports = { run };