const mongoose = require("mongoose");

// Single Execution/Attempt Trace Schema
const ExecutionLogSchema = new mongoose.Schema(
  {
    attemptNumber: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["uploaded_to_cso", "failed_cso_upload", "retry_phase"],
      required: true,
    },
    // Classification type for quick UI badge filtering (e.g., 'USER_ERROR', 'SYSTEM_TIMEOUT', 'UI_MISMATCH')
    errorCategory: {
      type: String,
      enum: ["USER_ERROR", "SYSTEM_ERROR", "RETRY_EVENT", "NONE"],
      default: "NONE",
    },
    // Clean, layman-formatted message for display on frontend
    message: {
      type: String,
      trim: true,
      default: null,
    },
    // Technical stack trace / raw error context for admin inspection
    rawError: {
      type: String,
      default: null,
    },
    // CDN filename of the screenshot proof (e.g. "err-inv-669d-att1.png")
    errorScreenshotFilename: {
      type: String,
      default: null,
    },
    // Step marker indicating where script failed (e.g. "CALENDAR_PICK", "VENDOR_LOOKUP", "GRID_VERIFY")
    executionStep: {
      type: String,
      default: null,
    },
  },
  { _id: true },
);

const CsoInvoiceSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
      index: true,
    },
    submittedByMongoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    invoiceDate: {
      type: String,
      required: true,
      trim: true,
    },
    siteCsoCode: {
      type: String,
      required: true,
      trim: true,
    },
    vendorCode: {
      type: String,
      required: true,
      trim: true,
    },
    vendorName: {
      type: String,
      required: true,
      trim: true,
    },
    docNumber: {
      type: String,
      required: true,
      trim: true,
    },
    methodOfPayment: {
      type: String,
      required: true,
      enum: ["cash", "credit", "check", "money_order", "eft", "credit_card"],
    },
    checkNumber: {
      type: String,
      trim: true,
      default: null,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
    images: {
      type: [String],
      validate: [
        (v) => v.length > 0,
        "At least one invoice image is required.",
      ],
    },
    status: {
      type: String,
      enum: ["pending_api_upload", "uploaded_to_cso", "failed_cso_upload"],
      default: "pending_api_upload",
      index: true,
    },
    csoUploadError: {
      type: String,
      default: null,
    },
    // 🚀 New Execution Audit Trail: Tracks every retry/failure with CDN screenshots & context
    logs: {
      type: [ExecutionLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("CsoInvoice", CsoInvoiceSchema);
