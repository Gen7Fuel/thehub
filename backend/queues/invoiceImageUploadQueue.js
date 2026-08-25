const { Queue, Worker } = require("bullmq");
const connection = require("../utils/redisClient");
const CsoInvoice = require("../models/CsoInvoice");
const { calculateLaplacianVariance } = require("../utils/blurDetector");
const { csoInvoiceQueue } = require("./csoInvoiceQueue"); // Import primary queue

const invoiceProcessingQueue = new Queue("invoiceProcessingQueue", {
  connection,
});

const invoiceProcessingWorker = new Worker(
  "invoiceProcessingQueue",
  async (job) => {
    const {
      invoiceId,
      invoiceImages,
      vendorCode,
      docNumber,
      invoiceDate,
      existingImages = [],
    } = job.data;

    const processedImages = [];

    for (let i = 0; i < invoiceImages.length; i++) {
      const item = invoiceImages[i];

      if (typeof item === "string" && item.startsWith("data:")) {
        // 1. Process New Base64 Data
        const { buffer, mime } = dataURLToBuffer(item);
        const originalName = `inv-${vendorCode}-${docNumber}-${invoiceDate}-${i}.png`;

        const { score, isFlaggedBlur } =
          await calculateLaplacianVariance(buffer);

        const formData = new FormData();
        const fileBlob = new Blob([buffer], { type: mime });
        formData.append("file", fileBlob, originalName);

        const response = await fetch("http://cdn:5001/cdn/upload-png", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`CDN upload dropped with status: ${response.status}`);
        }

        const data = await response.json();

        if (data.filename) {
          processedImages.push({
            name: data.filename,
            laplacianScore: score,
            isFlaggedBlur,
          });
        }
      } else {
        // 2. Preserve Existing Filename/Metadata Object
        const targetFilename = typeof item === "object" ? item.name : item;
        const matchedExisting = existingImages.find(
          (img) =>
            (typeof img === "object" ? img.name : img) === targetFilename,
        );

        if (matchedExisting) {
          processedImages.push(matchedExisting);
        } else {
          processedImages.push({
            name: targetFilename,
            laplacianScore: null,
            isFlaggedBlur: false,
          });
        }
      }
    }

    // Save final merged array to MongoDB
    await CsoInvoice.findByIdAndUpdate(invoiceId, {
      $set: { images: processedImages },
    });

    // Forward to primary CSO automation queue
    console.log(
      `📡 Forwarding Invoice ${invoiceId} to primary csoInvoiceQueue`,
    );
    await csoInvoiceQueue.add(
      `invoice-upload-${invoiceId}-${Date.now()}`,
      { invoiceId },
      {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  },
  {
    connection,
    concurrency: 2,
  },
);

function dataURLToBuffer(dataURL) {
  const parts = dataURL.split(";base64,");
  const mime = parts[0].split(":")[1];
  const buffer = Buffer.from(parts[1], "base64");
  return { buffer, mime };
}

module.exports = { invoiceProcessingQueue, invoiceProcessingWorker };
