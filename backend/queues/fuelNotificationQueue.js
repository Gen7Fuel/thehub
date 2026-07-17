const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const Location = require("../models/Location");
const { sendOperationalFuelAlarm } = require("../utils/sendPushOverNotification");

const fuelNotificationQueue = new Queue("fuelNotificationQueue", { connection });

const fuelNotificationWorker = new Worker(
  "fuelNotificationQueue",
  async (job) => {
    const { locationId, stationName } = job.data;
    console.log(`🤖 [Notification Worker] Processing station target hook for: ${stationName}`);

    // Retrieve active tokens dynamically from the database
    const locationObj = await Location.findById(locationId).lean();
    
    if (!locationObj) {
      throw new Error(`Location records completely missing for ID reference: ${locationId}`);
    }

    // Pass the documents to our parallel pushing engine
    await sendOperationalFuelAlarm({
      pushOverUserKey: locationObj.pushOverUserKey,
      devices: locationObj.devices,
      stationName: locationObj.stationName || stationName
    });

    console.log(`🎉 [Notification Worker] Dispatch completed cleanly for ${stationName}.`);
  },
  {
    connection,
    concurrency: 2, // Safely process parallel station updates simultaneously
    stalledInterval: 15000,
    maxStalledCount: 1
  }
);

fuelNotificationWorker.on("failed", (job, err) => {
  console.error(`❌ [Notification Worker] Job ${job?.id} failed processing exception:`, err);
});

module.exports = { fuelNotificationQueue, fuelNotificationWorker };