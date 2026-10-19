const { Queue, Worker } = require("bullmq");
const { ConfidentialClientApplication } = require("@azure/msal-node");
const { Client } = require("@microsoft/microsoft-graph-client");
const connection = require("../utils/redisClient");

const fuelOrderDraftQueue = new Queue("fuelOrderDraftQueue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      count: 20,
      age: 1800,
    },
    removeOnFail: {
      count: 100,
      age: 259200,
    },
  },
});

async function pushFuelOrderDraft({ draftPayload, targetMailbox }) {
  if (!draftPayload) {
    throw new Error("Missing draft payload.");
  }
  if (!targetMailbox) {
    throw new Error("Missing target mailbox.");
  }

  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);
  const authRes = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const client = Client.init({
    authProvider: (done) => done(null, authRes.accessToken),
  });

  await client
    .api(`/users/${targetMailbox}/mailFolders/drafts/messages`)
    .post(draftPayload);
}

const fuelOrderDraftWorker = new Worker(
  "fuelOrderDraftQueue",
  async (job) => {
    const { targetMailbox, summary } = job.data;
    console.log(
      `📨 [Fuel Draft Worker] Creating draft ${job.id} for ${targetMailbox}: ${summary || "fuel order"}`,
    );
    await pushFuelOrderDraft(job.data);
    console.log(`✅ [Fuel Draft Worker] Draft ${job.id} created for ${targetMailbox}`);
  },
  {
    connection,
    concurrency: 2,
  },
);

fuelOrderDraftWorker.on("failed", (job, err) => {
  console.error(
    `❌ [Fuel Draft Worker] Job ${job?.id || "unknown"} failed:`,
    err,
  );
});

fuelOrderDraftWorker.on("completed", (job) => {
  console.log(`🎉 [Fuel Draft Worker] Job ${job.id} completed successfully`);
});

module.exports = {
  fuelOrderDraftQueue,
  fuelOrderDraftWorker,
  pushFuelOrderDraft,
};
