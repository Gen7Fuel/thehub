const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const OrderRec = require("../models/OrderRec");
const Vendor = require("../models/Vendor");
const {
  StationAuditChecklist,
  StationAuditResponse,
} = require("../models/station-audits");
const { enqueueChangeLog } = require("./changeLogQueue");

const QUEUE_NAME = "stationAuditOrderQueue";

const stationAuditOrderQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000, age: 86400 },
    removeOnFail: { count: 5000, age: 604800 },
  },
});

async function enqueueStationAuditOrder(payload) {
  if (!payload?.responseId) throw new Error("Missing Station Audit response ID");
  return stationAuditOrderQueue.add("create-order-rec", payload, {
    jobId: String(payload.responseId),
  });
}

async function createOrderForResponse(jobData, io) {
  const response = await StationAuditResponse.findById(jobData.responseId).lean();
  if (!response?.checked || !response.requestOrder) {
    throw new Error("Station Audit response is not eligible for order creation");
  }

  const checklist = await StationAuditChecklist.findById(response.checklist)
    .select("item requestOrderEnabled suppliesVendor")
    .lean();
  if (!checklist?.requestOrderEnabled || !checklist.suppliesVendor) {
    throw new Error("Station Audit checklist order configuration is incomplete");
  }

  let orderRec = response.order
    ? await OrderRec.findById(response.order)
    : await OrderRec.findOne({ stationAuditResponse: response._id });

  if (!orderRec) {
    const vendorDoc = await Vendor.findOne({
      name: checklist.suppliesVendor,
      location: jobData.siteName,
    });
    if (!vendorDoc) {
      throw new Error(`Vendor ${checklist.suppliesVendor} is not configured for ${jobData.siteName}`);
    }
    if (!vendorDoc.station_supplies?.length) {
      throw new Error(`Vendor ${checklist.suppliesVendor} has no station supplies configured`);
    }

    orderRec = new OrderRec({
      categories: [{
        number: "5001",
        name: "Station Supplies",
        items: vendorDoc.station_supplies.map((supply) => ({
          gtin: supply.upc,
          vin: supply.vin,
          itemName: supply.name,
          size: supply.size,
          onHandQty: 0,
          casesToOrderOld: 0,
          completed: false,
        })),
        completed: false,
      }],
      site: jobData.siteName,
      vendor: vendorDoc._id,
      email: "orders@gen7fuel.com",
      currentStatus: "Created",
      statusHistory: [{ status: "Created", timestamp: new Date() }],
      comments: [],
      stationAuditResponse: response._id,
    });

    try {
      await orderRec.save();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      orderRec = await OrderRec.findOne({ stationAuditResponse: response._id });
      if (!orderRec) throw error;
    }
  }

  await StationAuditResponse.updateOne(
    { _id: response._id, requestOrder: true },
    { $set: { orderCreated: true, order: orderRec._id } }
  );

  await enqueueChangeLog({
    eventId: `station-audit-order-${response._id}`,
    eventType: "change",
    userId: jobData.actor?.userId,
    username: jobData.actor?.username,
    role: jobData.actor?.role,
    locationId: jobData.locationId,
    locationName: jobData.siteName,
    action: "create",
    resourceType: "order-rec",
    resourceId: orderRec._id,
    resourceStore: "mongodb",
    success: true,
    statusCode: 201,
    message: `Station Audit order created for ${checklist.suppliesVendor} at ${jobData.siteName}`,
    source: "station-audit.checklists.order-worker",
    requestId: jobData.requestId,
    ip: jobData.ip,
    userAgent: jobData.userAgent,
    changes: [{ field: "stationAuditResponse", from: null, to: String(response._id) }],
  });

  if (io) io.emit("orderCreated", orderRec);
  return { orderId: orderRec._id.toString(), responseId: response._id.toString() };
}

let stationAuditOrderWorker = null;

function initStationAuditOrderWorker(io) {
  if (stationAuditOrderWorker) return stationAuditOrderWorker;
  stationAuditOrderWorker = new Worker(
    QUEUE_NAME,
    (job) => createOrderForResponse(job.data, io),
    { connection, concurrency: 3 }
  );
  stationAuditOrderWorker.on("failed", (job, error) => {
    console.error(`Station Audit order job ${job?.id || "unknown"} failed:`, error.message);
  });
  return stationAuditOrderWorker;
}

module.exports = {
  stationAuditOrderQueue,
  enqueueStationAuditOrder,
  initStationAuditOrderWorker,
  createOrderForResponse,
};
