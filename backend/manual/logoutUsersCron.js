const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { resetUserLoginStatus } = require("../cron_jobs/logoutUsersCron");

async function run() {
    let hadError = false;

    try {
        await connectDB(); // Assuming this is defined elsewhere
        await resetUserLoginStatus();
    } catch (err) {
        hadError = true;
        console.error('User logout failed:', err);
    } finally {
        // Keep a slight delay if you need to ensure file is read before disconnect, 
        // though Bull queue usually handles the path later.
        try { await mongoose.disconnect(); } catch { }
        process.exit(hadError ? 1 : 0);
    }
}

if (require.main === module) run();
module.exports = { run };
