const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");
const { sendEmail } = require("../utils/emailService"); // CommonJS version of sendEmail

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const emailQueue = new Queue("emailQueue", { connection });

const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    console.log(`📧 Processing email job ${job.id} for ${job.data.to}`);
    await sendEmail(job.data);
  },
  { connection }
);

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Email job ${job.id} failed:`, err);
});

module.exports = { emailQueue, emailWorker };
