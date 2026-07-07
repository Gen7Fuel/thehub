const express = require('express');
const router = express.Router();
const { getLatestCsoVendorsList } = require('../services/sqlService');
const CsoInvoice = require('../models/CsoInvoice');

// GET /api/invoice-upload/vendors
router.get('/vendors', async (req, res) => {
  try {
    const records = await getLatestCsoVendorsList();
    
    // Map MS SQL bracketed spaces/casing cleanly into clean JSON keys
    const formattedVendors = records.map(vendor => ({
      code: vendor.VendorCode || '',
      name: vendor.VendorName || ''
    }));

    return res.json({ success: true, vendors: formattedVendors });
  } catch (err) {
    console.error("Express API error handling SQL vendor extraction:", err);
    return res.status(500).json({ success: false, error: "Internal Server Database Error" });
  }
});

// Helper: Convert Frontend Base64 DataURL to Node Buffer & Extract MIME metadata
const dataURLToBuffer = (dataurl) => {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const buffer = Buffer.from(arr[1], 'base64');
  return { buffer, mime };
};

// ---------------------------------------------------------
// POST /api/invoice-upload/submit
// ---------------------------------------------------------
router.post('/submit', async (req, res) => {
  try {
    const userMongoId = req.user?._id; 
    const siteMongoId = req.user?.locationMongoId; 

    const {
      invoiceDate, // Incoming ISO string from frontend (e.g., "2026-07-07T20:15:30.000Z")
      vendorCode,
      vendorName,
      docNumber,
      methodOfPayment,
      checkNumber,
      totalCost,
      invoiceImages 
    } = req.body;

    if (!invoiceImages || invoiceImages.length === 0) {
      return res.status(400).json({ success: false, error: "At least one invoice image is required." });
    }
    if (methodOfPayment === 'check' && !checkNumber) {
      return res.status(400).json({ success: false, error: "Check number is required for check payments." });
    }

    // 🚀 Extract just the clean YYYY-MM-DD part from the payload string
    const dateStringOnly = invoiceDate.split('T')[0]; 

    const uploadedFilenames = [];

    // Process and dispatch files directly through the Docker container network
    for (let i = 0; i < invoiceImages.length; i++) {
      const base64Str = invoiceImages[i];

      if (base64Str.startsWith('data:')) {
        const { buffer, mime } = dataURLToBuffer(base64Str);
        // Constructed safe naming convention
        const originalName = `inv-${vendorCode}-${docNumber}-${dateStringOnly}-${i}.png`;

        const formData = new FormData();
        const fileBlob = new Blob([buffer], { type: mime });
        formData.append("file", fileBlob, originalName);

        const response = await fetch("http://cdn:5001/cdn/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`CDN server dropped connection with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.filename) {
          uploadedFilenames.push(data.filename);
        } else {
          throw new Error("CDN response missing filename field.");
        }
      }
    }

    // Persist cleanly to MongoDB using the date string
    const newInvoice = new CsoInvoice({
      siteMongoId,
      submittedByMongoId: userMongoId,
      invoiceDate: dateStringOnly, // 🚀 Saved as pure "YYYY-MM-DD" string
      vendorCode,
      vendorName,
      docNumber,
      methodOfPayment,
      checkNumber: methodOfPayment === 'check' ? checkNumber : null,
      totalCost: Number(totalCost),
      images: uploadedFilenames,
      status: 'pending_api_upload'
    });

    await newInvoice.save();

    return res.json({ 
      success: true, 
      message: "Invoice successfully processed and saved to database.",
      invoiceId: newInvoice._id 
    });

  } catch (err) {
    console.error("❌ Secondary Pipeline Error: Failed uploading image asset to CDN:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error during upload sequence." });
  }
});

module.exports = router;