const express = require("express");
const router = express.Router();
const { getLatestCsoVendorsList } = require("../services/sqlService");
const { csoInvoiceQueue } = require("../queues/csoInvoiceQueue");
const CsoInvoice = require("../models/CsoInvoice");
const Location = require("../models/Location");

// GET /api/invoice-upload/vendors
router.get("/vendors", async (req, res) => {
  try {
    const records = await getLatestCsoVendorsList();

    // Map MS SQL bracketed spaces/casing cleanly into clean JSON keys
    const formattedVendors = records.map((vendor) => ({
      code: vendor.VendorCode || "",
      name: vendor.VendorName || "",
    }));

    return res.json({ success: true, vendors: formattedVendors });
  } catch (err) {
    console.error("Express API error handling SQL vendor extraction:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Database Error" });
  }
});

// GET /api/invoice-upload/list?siteId=...&fromDate=2026-07-21&toDate=2026-07-22
// GET /api/invoice-upload/list?siteName=...&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// GET /api/invoice-upload/list
router.get("/list", async (req, res) => {
  try {
    const { siteName, fromDate, toDate } = req.query;
    // Build dynamic MongoDB query object
    const query = {};

    // 1. Resolve siteName string to Location ObjectId if provided
    if (siteName && siteName !== "all" && siteName.trim() !== "") {
      // Case-insensitive regex search to avoid slight casing or whitespace mismatches
      const targetLocation = await Location.findOne({
        stationName: { $regex: new RegExp(`^${siteName.trim()}$`, "i") },
      });

      if (!targetLocation) {
        console.warn(
          `⚠️ [INVOICE LIST API] Location matching '${siteName}' not found in DB.`
        );
        return res.status(404).json({
          success: false,
          error: `Configured location matching '${siteName}' could not be resolved.`,
        });
      }
      query.site = targetLocation._id;
    }

    // 2. String-based Date Range Filtering ('YYYY-MM-DD')
    if (fromDate || toDate) {
      query.invoiceDate = {};
      if (fromDate) query.invoiceDate.$gte = String(fromDate).trim();
      if (toDate) query.invoiceDate.$lte = String(toDate).trim();
    }

    // Query DB
    const invoices = await CsoInvoice.find(query)
      .populate("site", "stationName csoCode")
      .populate("submittedByMongoId", "name email")
      .sort({ invoiceDate: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: invoices,
    });
  } catch (err) {
    console.error("❌ [INVOICE LIST API] Error fetching filtered invoice list:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve invoice records.",
    });
  }
});

// Helper: Convert Frontend Base64 DataURL to Node Buffer & Extract MIME metadata
const dataURLToBuffer = (dataurl) => {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const buffer = Buffer.from(arr[1], "base64");
  return { buffer, mime };
};

// ---------------------------------------------------------
// POST /api/invoice-upload/submit
// ---------------------------------------------------------
router.post("/submit", async (req, res) => {
  try {
    const userMongoId = req.user?._id;

    const {
      siteName,
      invoiceDate,
      vendorCode,
      vendorName,
      docNumber,
      methodOfPayment,
      checkNumber,
      totalCost,
      invoiceImages,
    } = req.body;

    // Safety checks
    if (!siteName) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Station location targeting context is required.",
        });
    }
    if (!invoiceImages || invoiceImages.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          error: "At least one invoice image is required.",
        });
    }
    if (methodOfPayment === "check" && !checkNumber) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Check number is required for check payments.",
        });
    }

    // Dynamic Database Lookup via unique stationName string
    const targetLocation = await Location.findOne({ stationName: siteName });
    if (!targetLocation) {
      return res.status(404).json({
        success: false,
        error: `Configured location matching '${siteName}' could not be resolved.`,
      });
    }

    const siteMongoId = targetLocation._id;
    const targetCsoCode = targetLocation.csoCode || null;
    const dateStringOnly = invoiceDate.split("T")[0];
    const uploadedFilenames = [];

    // Process and dispatch files directly through the Docker container network
    for (let i = 0; i < invoiceImages.length; i++) {
      const base64Str = invoiceImages[i];

      if (base64Str.startsWith("data:")) {
        const { buffer, mime } = dataURLToBuffer(base64Str);
        const originalName = `inv-${vendorCode}-${docNumber}-${dateStringOnly}-${i}.png`;

        const formData = new FormData();
        const fileBlob = new Blob([buffer], { type: mime });
        formData.append("file", fileBlob, originalName);

        const response = await fetch("http://cdn:5001/cdn/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(
            `CDN server dropped connection with status: ${response.status}`,
          );
        }

        const data = await response.json();
        if (data.filename) {
          uploadedFilenames.push(data.filename);
        } else {
          throw new Error("CDN response missing filename field.");
        }
      }
    }

    // Persist to MongoDB with early 'pending_api_upload' operational status flags
    const newInvoice = new CsoInvoice({
      site: siteMongoId,
      siteCsoCode: targetCsoCode,
      submittedByMongoId: userMongoId,
      invoiceDate: dateStringOnly,
      vendorCode,
      vendorName,
      docNumber,
      methodOfPayment,
      checkNumber: methodOfPayment === "check" ? checkNumber : null,
      totalCost: Number(totalCost),
      images: uploadedFilenames,
      status: "pending_api_upload",
    });

    await newInvoice.save();

    // 🚀 BullMQ Offloading Step: Safely buffer job details to Redis
    console.log(
      `📡 Offloading execution loop trace to background worker thread for Invoice: ${newInvoice._id}`,
    );
    await csoInvoiceQueue.add(
      `invoice-upload-${newInvoice._id}-${Date.now()}`,
      { invoiceId: newInvoice._id },
      {
        attempts: 1, // Keep single delivery attempts to avoid accidental duplicate form actions
        removeOnComplete: true, // Auto-purge jobs from system on success to clean Redis memory profiles
        removeOnFail: false, // Retain trace failures inside dashboard metrics for logging analysis
      },
    );

    // Promptly return response to ensure standard instant page feedback
    return res.json({
      success: true,
      message: "Your invoice has been submitted successfully! We are processing the upload in the background now.\nYou will be notified automatically as soon as it completes, or you can check the List page to view the current status.",
      invoiceId: newInvoice._id,
    });
  } catch (err) {
    console.error(
      "❌ Secondary Pipeline Error: Failed uploading image asset to CDN:",
      err,
    );
    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error during upload sequence.",
    });
  }
});

module.exports = router;
