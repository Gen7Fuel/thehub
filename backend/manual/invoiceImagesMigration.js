const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");
const connectDB = require("../config/db");
const mongoose = require("mongoose");
const CsoInvoice = require("../models/CsoInvoice");
const { calculateLaplacianVariance } = require("../utils/blurDetector");

/**
 * Migration Script: Transforms legacy string image arrays [ "inv-1.png" ]
 * into subdocument arrays [ { name, laplacianScore, isFlaggedBlur } ]
 * by downloading images from CDN and computing quality scores.
 */
async function migrateInvoiceImagesToSubdocuments() {
  console.log("🚀 Starting CsoInvoice image array migration...");
  const tempDir = path.join(os.tmpdir(), "invoice-migration-cache");

  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Fetch documents directly using lean to bypass Mongoose schema casting
    const invoices = await CsoInvoice.find({}).lean();
    console.log(`🔍 Found ${invoices.length} total invoice records to evaluate.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let failureCount = 0;

    for (const invoice of invoices) {
      const currentImages = invoice.images || [];

      // Check if already migrated to new subdocument schema structure
      const isAlreadyMigrated =
        currentImages.length > 0 &&
        typeof currentImages[0] === "object" &&
        currentImages[0] !== null &&
        "name" in currentImages[0];

      if (isAlreadyMigrated) {
        skippedCount++;
        continue;
      }

      console.log(`⏳ Processing Invoice ID: ${invoice._id} (${currentImages.length} images)...`);
      const updatedImagesList = [];

      for (const imgItem of currentImages) {
        // Extract plain filename
        const filename =
          typeof imgItem === "string"
            ? imgItem.replace("/cdn/download/", "").trim()
            : imgItem?.name || "";

        if (!filename) continue;

        const cdnUrl = `http://cdn:5001/cdn/download/${filename}`;
        const tempFilePath = path.join(tempDir, `${Date.now()}-${filename}`);

        let laplacianScore = null;
        let isFlaggedBlur = false;

        try {
          // Download image arraybuffer from CDN container
          const response = await axios.get(cdnUrl, {
            responseType: "arraybuffer",
            timeout: 10000,
          });

          // Write buffer temporarily for Laplacian processing
          await fs.promises.writeFile(tempFilePath, Buffer.from(response.data));

          // Run blur detection via utility (returns { score/laplacianScore, isFlaggedBlur })
          if (typeof calculateLaplacianVariance === "function") {
            const result = await calculateLaplacianVariance(tempFilePath);
            if (result) {
              laplacianScore = result.laplacianScore ?? result.score ?? null;
              isFlaggedBlur = Boolean(result.isFlaggedBlur);
            }
          }
        } catch (downloadErr) {
          console.warn(
            `⚠️ Could not fetch or process image ${filename} from CDN: ${downloadErr.message}`
          );
        } finally {
          // Cleanup temp disk cached file
          if (fs.existsSync(tempFilePath)) {
            await fs.promises.unlink(tempFilePath).catch(() => {});
          }
        }

        updatedImagesList.push({
          name: filename,
          laplacianScore,
          isFlaggedBlur,
        });
      }

      if (updatedImagesList.length > 0) {
        // Direct MongoDB update to bypass schema validation during format migration
        await CsoInvoice.collection.updateOne(
          { _id: invoice._id },
          { $set: { images: updatedImagesList } }
        );
        migratedCount++;
        console.log(`✅ Successfully updated Invoice ID: ${invoice._id}`);
      } else {
        failureCount++;
        console.warn(`❌ No images could be converted for Invoice ID: ${invoice._id}`);
      }
    }

    console.log("\n==========================================");
    console.log("🎉 MIGRATION COMPLETE SUMMARY:");
    console.log(`- Total Migrated: ${migratedCount}`);
    console.log(`- Total Skipped (Already New Format): ${skippedCount}`);
    console.log(`- Total Failed/Empty: ${failureCount}`);
    console.log("==========================================\n");
  } catch (err) {
    console.error("💥 Fatal error during migration execution:", err);
  } finally {
    // Clean up cache directory
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function run() {
  let hadError = false;
  try {
    await connectDB();
    await migrateInvoiceImagesToSubdocuments();
  } catch (err) {
    hadError = true;
    console.error("Sync failed:", err);
  } finally {
    try {
      await mongoose.disconnect();
      console.log("Mongo disconnected.");
    } catch (e) { }
    process.exit(hadError ? 1 : 0);
  }
}

if (require.main === module) run();

module.exports = migrateInvoiceImagesToSubdocuments;