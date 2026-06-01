const fs = require("fs");
const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");

const emailQueue = new Queue("emailQueue", { connection });

async function resolveAttachments(attachments = []) {
  return Promise.all(
    attachments.map(async (att) => {
      if (att.path) {
        const buf = await fs.promises.readFile(att.path);
        return { filename: att.filename, content: buf.toString("base64"), encoding: "base64" };
      }
      if (Buffer.isBuffer(att.content)) {
        return { filename: att.filename, content: att.content.toString("base64"), encoding: "base64", contentType: att.contentType };
      }
      return att;
    })
  );
}

async function processEmailJob(job) {
  const { attachments, ...rest } = job.data;
  const resolved = await resolveAttachments(attachments);

  const res = await fetch(`${process.env.EMAIL_SERVICE_URL}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.EMAIL_SERVICE_API_KEY,
    },
    body: JSON.stringify({
      ...rest,
      ...(resolved.length > 0 && { attachments: resolved }),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `email-service responded ${res.status}`);
  }
}

const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    try {
      console.log(`📧 Processing email job ${job.id} for ${job.data.to}`);
      await processEmailJob(job);
      console.log(`✅ Email job ${job.id} completed`);
    } catch (error) {
      console.error(`❌ Email job ${job.id} failed:`, error);
      throw error;
    }
  },
  { connection }
);

emailWorker.on("failed", (job, err) => {
  console.error(`🚨 Email job ${job?.id || "unknown"} failed:`, err.message);
});

emailWorker.on("completed", (job) => {
  console.log(`🎉 Email job ${job.id} completed successfully`);
});

module.exports = { emailQueue, emailWorker, resolveAttachments, processEmailJob };
