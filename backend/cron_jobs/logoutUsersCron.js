const User = require("../models/User");
const cron = require("node-cron");

/**
 * Resets the is_loggedIn flag for all users.
 * This ensures the DB state matches the forced token expiration.
 */
const resetUserLoginStatus = async () => {
  try {
    console.log("Starting daily logout reset...");

    const result = await User.updateMany(
      { is_loggedIn: true },
      { $set: { is_loggedIn: false } },
      { timestamps: false } // This prevents the updatedAt field from changing
    );

    console.log(`Successfully reset status for ${result.modifiedCount} users.`);
  } catch (error) {
    console.error("Error during daily logout reset:", error);
  }
};

// "0 9 * * *" runs at 9:00 AM UTC if your server is in UTC
// Or keep the timezone-specific one and set it to 4 AM or 5 AM
cron.schedule("0 9 * * *", () => {
  console.log("Running scheduled global logout reset (9 AM UTC)...");
  resetUserLoginStatus();
}, {
  scheduled: true,
  timezone: "UTC" // Setting this to UTC makes it easier to match your token logic
});

module.exports = { resetUserLoginStatus };