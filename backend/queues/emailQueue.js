const { Queue, Worker } = require("bullmq");
const { sendEmail } = require("../utils/emailService");
const connection = require("../utils/redisClient");

// Initialize the queue for adding jobs
const emailQueue = new Queue("emailQueue", { connection });

// Background worker for processing queued jobs
const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    try {
      console.log(`📧 Processing email job ${job.id} for ${job.data.to}`);
      await sendEmail(job.data);
      console.log(`✅ Email job ${job.id} completed`);
    } catch (error) {
      console.error(`❌ Email job ${job.id} failed:`, error);
      throw error; // Let BullMQ handle retries
    }
  },
  { connection }
);

// Log failures
emailWorker.on("failed", (job, err) => {
  console.error(`🚨 Email job ${job?.id || "unknown"} failed:`, err.message);
});

emailWorker.on("completed", (job) => {
  console.log(`🎉 Email job ${job.id} completed successfully`);
});

module.exports = { emailQueue, emailWorker };