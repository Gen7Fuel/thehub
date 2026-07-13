// const fs = require("fs");
// const path = require("path");
// const axios = require("axios");
// const { chromium } = require("playwright-extra");
// const stealth = require("puppeteer-extra-plugin-stealth")();
// const { emailQueue } = require("../queues/emailQueue");
// const CsoInvoice = require("../models/CsoInvoice");

// // Inject stealth plugin layers into the chromium driver bundle
// chromium.use(stealth);

// /**
//  * Executes Phase 1 & Phase 2 Invoice Data entry automation inside Docflow Scanner.
//  * Pulls variables entirely from MongoDB collections by matching object records.
//  * * @param {object} params - Explicit tracking identification payload wrapper
//  * @param {string} params.invoiceId - The MongoDB ObjectId instance of the CsoInvoice
//  */
// async function processInvoiceAutomation({ invoiceId }) {
//   console.log(
//     `🤖 Initializing Merged Docflow Processing Pipeline for Invoice ID: ${invoiceId}...`,
//   );

//   // 1. Resolve Document Context from MongoDB Collections
//   const invoice = await CsoInvoice.findById(invoiceId);
//   if (!invoice) {
//     throw new Error(
//       `Invoice with DB Ref ID ${invoiceId} does not exist inside historical tracking storage.`,
//     );
//   }

//   const {
//     siteCsoCode, // Target Petrosoft station code (e.g., '78207')
//     invoiceDate, // Stored Date format: 'YYYY-MM-DD'
//     vendorCode,
//     docNumber,
//     methodOfPayment, // 'check', 'cash', 'credit', etc.
//     checkNumber,
//     totalCost,
//     images, // Array of image file paths/filenames on CDN
//   } = invoice;

//   // Format tracking date variables for verification checks on right-hand form
//   const [year, monthStr, dayStr] = invoiceDate.split("-");
//   const cleanDay = parseInt(dayStr, 10).toString();
//   const formattedUIDate = `${monthStr}/${dayStr}/${year}`; // Formats to MM/DD/YYYY to match ExtJS displayfield text string

//   // Setup services folder paths locally for temporary verification storage snapshots
//   const outputDir = path.join(__dirname, "services");
//   if (!fs.existsSync(outputDir)) {
//     fs.mkdirSync(outputDir, { recursive: true });
//   }

//   const systemChromiumPath =
//     process.env.CHROMIUM_PATH ||
//     (fs.existsSync("/usr/bin/chromium-browser")
//       ? "/usr/bin/chromium-browser"
//       : fs.existsSync("/usr/bin/chromium")
//         ? "/usr/bin/chromium"
//         : undefined);

//   const browser = await chromium.launch({
//     headless: true,
//     executablePath: systemChromiumPath,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage",
//     ],
//   });

//   const context = await browser.newContext({
//     viewport: { width: 1400, height: 1000 },
//     userAgent:
//       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
//   });

//   const page = await context.newPage();

//   try {
//     // =========================================================================
//     // PHASE 1: NAVIGATE TO DOCFLOW & TRACK TARGETING DATE
//     // =========================================================================

//     console.log("🔑 Authenticating with CStoreOffice Portal...");
//     await page.goto("https://03.cstoreoffice.com", {
//       waitUntil: "networkidle",
//       timeout: 60000,
//     });
//     await page.waitForSelector("#username", {
//       state: "visible",
//       timeout: 15000,
//     });
//     await page.fill("#username", process.env.PETROSOFT_USERNAME);
//     await page.fill("#password", process.env.PETROSOFT_PASSWORD);
//     await page.click("#kc-login");
//     await page.waitForLoadState("networkidle");

//     console.log("📂 Routing straight into Docflow Scanner matrix...");
//     const docflowUrl =
//       "https://docflow.cstoreoffice.com/app.php/docflow/scanner";
//     await page.goto(docflowUrl, { waitUntil: "load", timeout: 60000 });

//     // Wait for ExtJS container sidebar elements to load safely
//     await page.waitForSelector(`[id="station${siteCsoCode}"]`, {
//       state: "visible",
//       timeout: 30000,
//     });

//     console.log(
//       `🎯 Targeting station button selector: #station${siteCsoCode}-btnEl`,
//     );
//     const stationButton = page.locator(`#station${siteCsoCode}-btnEl`);
//     await stationButton.click();
//     await page.waitForTimeout(2000);

//     const targetDateId = `app-calendar-month-day-${year}${monthStr}${dayStr}`;
//     const monthsArray = [
//       "January",
//       "February",
//       "March",
//       "April",
//       "May",
//       "June",
//       "July",
//       "August",
//       "September",
//       "October",
//       "November",
//       "December",
//     ];
//     const targetMonthLabel = `${monthsArray[parseInt(monthStr, 10) - 1]}, ${year}`;

//     console.log(
//       `📆 Navigating calendar grid wrapper to find: ${targetMonthLabel}`,
//     );

//     let currentMonthLabelText = await page
//       .locator("#app-calendar-tb-month")
//       .innerText();
//     let escapeAttempts = 0;

//     while (
//       currentMonthLabelText.trim() !== targetMonthLabel &&
//       escapeAttempts < 24
//     ) {
//       escapeAttempts++;
//       const currentLabelParts = currentMonthLabelText.split(",");
//       const currentYear = parseInt(currentLabelParts[1].trim(), 10);
//       const currentMonthIndex = monthsArray.indexOf(
//         currentLabelParts[0].trim(),
//       );
//       const targetMonthIndex = parseInt(monthStr, 10) - 1;
//       const targetYearInt = parseInt(year, 10);

//       if (
//         targetYearInt < currentYear ||
//         (targetYearInt === currentYear && targetMonthIndex < currentMonthIndex)
//       ) {
//         console.log("⏮️ Clicking back a month...");
//         await page.click("#app-calendar-tb-prev-btnEl");
//       } else {
//         console.log("⏭️ Clicking forward a month...");
//         await page.click("#app-calendar-tb-next-btnEl");
//       }

//       await page.waitForTimeout(1000);
//       currentMonthLabelText = await page
//         .locator("#app-calendar-tb-month")
//         .innerText();
//     }

//     console.log(
//       `📌 Attempting interaction on cell element mapping to ID: ${targetDateId}`,
//     );
//     const targetEventDayId = targetDateId.replace("-day-", "-ev-day-");
//     const foregroundCell = page.locator(`td[id="${targetEventDayId}"] div`);
//     const backgroundCell = page.locator(`td[id="${targetDateId}"]`);

//     if ((await foregroundCell.count()) > 0) {
//       console.log(
//         `✨ Foreground intercepting visual title element resolved (#${targetEventDayId}). Clicking it directly...`,
//       );
//       await foregroundCell.first().click();
//     } else {
//       console.log(
//         `⚡ Foreground element missing. Forcing click handshake execution matrix directly on background cell...`,
//       );
//       await backgroundCell.first().click({ force: true });
//     }

//     await page.waitForTimeout(3000);

//     // =========================================================================
//     // PHASE 2: NEW DOCUMENT DIALOG TRIGGER & CDN IMAGE DOWNLOAD
//     // =========================================================================

//     console.log(
//       "➕ Clicking '+ New Document' operation element to construct modal trigger context...",
//     );
//     // Using a class + button text combination selector instead of dynamic #button-1023
//     const newDocButton = page.locator(
//       '.doc-scan-btn button:has-text("New Document")',
//     );
//     await newDocButton.waitFor({ state: "visible" });
//     await newDocButton.click();

//     // FIXED: Instead of the dynamic `#document-1111`, target the constant class selector `.documentWindow`
//     const modalWindow = page.locator(".x-window.documentWindow");
//     await modalWindow.waitFor({ state: "visible", timeout: 15000 });

//     const localFilePaths = [];
//     const tempDir = path.join(__dirname, "temp_downloads");
//     if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

//     console.log(
//       `📥 Querying asset payloads. Syncing ${images.length} images from CDN environment...`,
//     );
//     for (const filename of images) {
//       const cdnUrl = `http://cdn:5001/cdn/download/${filename}`;
//       const localPath = path.join(tempDir, filename);

//       const response = await axios({
//         method: "GET",
//         url: cdnUrl,
//         responseType: "stream",
//       });

//       const writer = fs.createWriteStream(localPath);
//       response.data.pipe(writer);

//       await new Promise((resolve, reject) => {
//         writer.on("finish", resolve);
//         writer.on("error", reject);
//       });
//       localFilePaths.push(localPath);
//     }

//     // FIXED: Target the upload button scope via class name inside the active document window context
//     console.log(
//       "💾 Uploading file structures into active container memory stream...",
//     );
//     await modalWindow.locator(".imgButtonUpload button").click();

//     // FIXED: Target the dynamic hidden file input element cleanly using its standard functional CSS class
//     const fileInputHandle = modalWindow.locator("input.x-form-file-input");
//     await fileInputHandle.setInputFiles(localFilePaths);
//     await page.waitForTimeout(3000); // Give ExtJS ample time to process thumbnail view buffers

//     // =========================================================================
//     // PHASE 2: DATA TRANSFORMATION, MOP EVALUATION, & VERIFICATION
//     // =========================================================================

//     console.log("📝 Commencing Form field alignment mapping values...");

//     // 1. Date Validation Handshake Rules via display field lookups inside the form container
//     const uiDateText = await modalWindow
//       .locator(".documentForm .x-form-display-field")
//       .first()
//       .innerText();
//     if (uiDateText.trim() !== formattedUIDate) {
//       throw new Error(
//         `Critical Date Contradiction: Form displays ${uiDateText.trim()} but database demands validation matching ${formattedUIDate}. Executing script cancellation.`,
//       );
//     }
//     console.log("✅ Target UI Calendar Date matches loaded DB parameters.");

//     // FIXED: Targets inputs securely across rendering sessions using unique "name" attributes
//     // 2. Map Vendor Identifier
//     const vendorInput = modalWindow.locator('input[name="vendor_id"]');
//     await vendorInput.fill(vendorCode);
//     await page.keyboard.press("Enter");

//     // 3. Document ID Value Mapping
//     await modalWindow.locator('input[name="document_id"]').fill(docNumber);

//     // 4. Mode of Payment Selection Layer
//     const mopInput = modalWindow.locator('input[name="payment_type"]');
//     await mopInput.fill(methodOfPayment);
//     await page.keyboard.press("Enter");
//     await page.waitForTimeout(1000); // Wait for the structural layout adjustment animation to drop

//     // Conditional Mapping Step: If selection evaluation resolves as 'check', handle visible text box element safely
//     if (methodOfPayment.toLowerCase() === "check") {
//       console.log(
//         `🔍 MOP evaluated as 'check'. Intercepting visible tracking field layer for value: ${checkNumber}`,
//       );
//       const checkField = modalWindow.locator('input[name="check_number"]');
//       await checkField.waitFor({ state: "visible", timeout: 5000 });
//       await checkField.fill(String(checkNumber));
//     }

//     // 5. Populate Accounting Balance total cost values
//     await modalWindow
//       .locator('input[name="total_cost"]')
//       .fill(String(totalCost));
//     await page.waitForTimeout(2000); // Wait for input focus changes to resolve layout processing styles

//     // =========================================================================
//     // SCREENSHOT EVIDENCE PROOFS & CLEAN UP WORKSPACE
//     // =========================================================================

//     const screenshotPath = path.join(
//       outputDir,
//       `phase2_success_${siteCsoCode}_${invoiceId}.png`,
//     );
//     await page.screenshot({ path: screenshotPath, fullPage: true });
//     console.log(
//       `📸 Process completion snapshot recorded under services directory: ${screenshotPath}`,
//     );

//     // Flush temporary local down-streams safely away
//     localFilePaths.forEach((filePath) => {
//       if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//     });

//     // Close runtime browser layer execution models
//     await browser.close();
//     return { success: true };
//   } catch (error) {
//     console.error("❌ AUTOMATION EXECUTION FAULT AT RUNTIME:", error);

//     try {
//       const errScreenshotPath = path.join(
//         outputDir,
//         `automation_error_${siteCsoCode}_${invoiceId}.png`,
//       );
//       await page.screenshot({ path: errScreenshotPath, fullPage: true });
//       console.log(
//         `📸 Technical exception proof written to: ${errScreenshotPath}`,
//       );
//     } catch (ssErr) {
//       console.error("Failed writing fallback diagnostic screenshots:", ssErr);
//     }

//     // Fallback Alert Email Formatting Layer
//     const systemAlertHtml = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
//         <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
//           <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
//             ⚠️ Critical Failure: Invoice Input Engine Exception
//           </h2>
//           <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
//             An automation fault suspended script operations processing invoice updates for Station CSO Code: <strong>${siteCsoCode}</strong>.
//           </p>
//         </div>
//         <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
//           <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Error Blueprint Context:</strong>
//           <p style="font-family: monospace; font-size: 13px; color: #ef4444; margin: 8px 0 0 0; white-space: pre-wrap;">${error.message}</p>
//         </div>
//       </div>
//     `;

//     await emailQueue.add(`docflow-error-${Date.now()}`, {
//       to: "daksh@gen7fuel.com",
//       subject: `🚨 Hub Automation Pipeline Breakpoint (Station: ${siteCsoCode})`,
//       html: systemAlertHtml,
//     });

//     await browser.close();
//     throw error;
//   }
// }

// module.exports = { processInvoiceAutomation };

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const { emailQueue } = require("../queues/emailQueue");
const CsoInvoice = require("../models/CsoInvoice");

// Inject stealth plugin layers into the chromium driver bundle
chromium.use(stealth);

/**
 * Executes Phase 1 & Phase 2 Invoice Data entry automation inside Docflow Scanner.
 * Pulls variables entirely from MongoDB collections by matching object records.
 * @param {object} params - Explicit tracking identification payload wrapper
 * @param {string} params.invoiceId - The MongoDB ObjectId instance of the CsoInvoice
 */
async function processInvoiceAutomation({ invoiceId }) {
  console.log(
    `🤖 Initializing Merged Docflow Processing Pipeline for Invoice ID: ${invoiceId}...`,
  );

  // 1. Resolve Document Context from MongoDB Collections
  const invoice = await CsoInvoice.findById(invoiceId);
  if (!invoice) {
    throw new Error(
      `Invoice with DB Ref ID ${invoiceId} does not exist inside historical tracking storage.`,
    );
  }

  const {
    siteCsoCode, // Target Petrosoft station code (e.g., '78207')
    invoiceDate, // Stored Date format: 'YYYY-MM-DD'
    vendorCode,
    vendorName,
    docNumber,
    methodOfPayment, // 'check', 'cash', 'credit', etc.
    checkNumber,
    totalCost,
    images, // Array of image file paths/filenames on CDN
  } = invoice;

  // Format tracking date variables for verification checks on right-hand form
  const [year, monthStr, dayStr] = invoiceDate.split("-");
  const formattedUIDate = `${monthStr}/${dayStr}/${year}`; // Formats to MM/DD/YYYY to match ExtJS displayfield text string

  // Setup services folder paths locally for temporary verification storage snapshots
  const outputDir = path.join(__dirname, "services");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const systemChromiumPath =
    process.env.CHROMIUM_PATH ||
    (fs.existsSync("/usr/bin/chromium-browser")
      ? "/usr/bin/chromium-browser"
      : fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined);

  const browser = await chromium.launch({
    headless: true,
    executablePath: systemChromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // =========================================================================
    // PHASE 1: NAVIGATE TO DOCFLOW & TRACK TARGETING DATE
    // =========================================================================

    console.log("🔑 Authenticating with CStoreOffice Portal...");
    await page.goto("https://03.cstoreoffice.com", {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector("#username", {
      state: "visible",
      timeout: 15000,
    });
    await page.fill("#username", process.env.PETROSOFT_USERNAME);
    await page.fill("#password", process.env.PETROSOFT_PASSWORD);
    await page.click("#kc-login");
    await page.waitForLoadState("networkidle");

    console.log("📂 Routing straight into Docflow Scanner matrix...");
    const docflowUrl =
      "https://docflow.cstoreoffice.com/app.php/docflow/scanner";
    await page.goto(docflowUrl, { waitUntil: "load", timeout: 60000 });

    // Wait for ExtJS container sidebar elements to load safely
    await page.waitForSelector(`[id="station${siteCsoCode}"]`, {
      state: "visible",
      timeout: 30000,
    });

    console.log(
      `🎯 Targeting station button selector: #station${siteCsoCode}-btnEl`,
    );
    const stationButton = page.locator(`#station${siteCsoCode}-btnEl`);
    await stationButton.click();
    await page.waitForTimeout(2000);

    const targetDateId = `app-calendar-month-day-${year}${monthStr}${dayStr}`;
    const monthsArray = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const targetMonthLabel = `${monthsArray[parseInt(monthStr, 10) - 1]}, ${year}`;

    console.log(
      `📆 Navigating calendar grid wrapper to find: ${targetMonthLabel}`,
    );

    let currentMonthLabelText = await page
      .locator("#app-calendar-tb-month")
      .innerText();
    let escapeAttempts = 0;

    while (
      currentMonthLabelText.trim() !== targetMonthLabel &&
      escapeAttempts < 24
    ) {
      escapeAttempts++;
      const currentLabelParts = currentMonthLabelText.split(",");
      const currentYear = parseInt(currentLabelParts[1].trim(), 10);
      const currentMonthIndex = monthsArray.indexOf(
        currentLabelParts[0].trim(),
      );
      const targetMonthIndex = parseInt(monthStr, 10) - 1;
      const targetYearInt = parseInt(year, 10);

      if (
        targetYearInt < currentYear ||
        (targetYearInt === currentYear && targetMonthIndex < currentMonthIndex)
      ) {
        console.log("⏮️ Clicking back a month...");
        await page.click("#app-calendar-tb-prev-btnEl");
      } else {
        console.log("⏭️ Clicking forward a month...");
        await page.click("#app-calendar-tb-next-btnEl");
      }

      await page.waitForTimeout(1000);
      currentMonthLabelText = await page
        .locator("#app-calendar-tb-month")
        .innerText();
    }

    console.log(
      `📌 Attempting interaction on cell element mapping to ID: ${targetDateId}`,
    );
    const targetEventDayId = targetDateId.replace("-day-", "-ev-day-");
    const foregroundCell = page.locator(`td[id="${targetEventDayId}"] div`);
    const backgroundCell = page.locator(`td[id="${targetDateId}"]`);

    if ((await foregroundCell.count()) > 0) {
      console.log(
        `✨ Foreground intercepting visual title element resolved (#${targetEventDayId}). Clicking it directly...`,
      );
      await foregroundCell.first().click();
    } else {
      console.log(
        `⚡ Foreground element missing. Forcing click handshake execution matrix directly on background cell...`,
      );
      await backgroundCell.first().click({ force: true });
    }

    await page.waitForTimeout(3000);

    // =========================================================================
    // PHASE 2: NEW DOCUMENT DIALOG TRIGGER & CDN IMAGE DOWNLOAD
    // =========================================================================

    console.log(
      "➕ Clicking '+ New Document' operation element to construct modal trigger context...",
    );
    const newDocButton = page.locator(
      '.doc-scan-btn button:has-text("New Document")',
    );
    await newDocButton.waitFor({ state: "visible" });
    await newDocButton.click();

    const modalWindow = page.locator(".x-window.documentWindow");
    await modalWindow.waitFor({ state: "visible", timeout: 15000 });

    const localFilePaths = [];
    const tempDir = path.join(__dirname, "temp_downloads");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    console.log(
      `📥 Querying asset payloads. Syncing ${images.length} images from CDN environment...`,
    );
    for (const filename of images) {
      const cdnUrl = `http://cdn:5001/cdn/download/${filename}`;
      const localPath = path.join(tempDir, filename);

      const response = await axios({
        method: "GET",
        url: cdnUrl,
        responseType: "stream",
      });

      const writer = fs.createWriteStream(localPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      localFilePaths.push(localPath);
    }

    console.log(
      "💾 Uploading file structures into active container memory stream...",
    );
    await modalWindow.locator(".imgButtonUpload button").click();

    const fileInputHandle = modalWindow.locator("input.x-form-file-input");
    await fileInputHandle.setInputFiles(localFilePaths);
    await page.waitForTimeout(3000);

    // =========================================================================
    // PHASE 2: DATA TRANSFORMATION, MOP EVALUATION, & VERIFICATION
    // =========================================================================

    console.log("📝 Commencing Form field alignment mapping values...");

    // 1. Date Validation Handshake Rules + Graceful Dialog Recovery
    const uiDateText = await modalWindow
      .locator(".documentForm .x-form-display-field")
      .first()
      .innerText();
    if (uiDateText.trim() !== formattedUIDate) {
      console.warn(
        `⚠️ Date Mismatch Error: Form shows ${uiDateText.trim()} but DB expected ${formattedUIDate}. Closing dialog context to re-trigger.`,
      );

      // Save diagnostic view of mismatch before clean drop
      await page.screenshot({
        path: path.join(
          outputDir,
          `date_mismatch_${siteCsoCode}_${invoiceId}.png`,
        ),
        fullPage: true,
      });

      // Click ExtJS standard close icon tool within header components cleanly
      await modalWindow.locator(".x-tool img.x-tool-close").click();
      await modalWindow.waitFor({ state: "hidden", timeout: 5000 });

      throw new Error(
        `RETRY_PHASE_1: Invoice date mismatch corrected. Open dialog closed gracefully to repeat date picking logic step.`,
      );
    }
    console.log("✅ Target UI Calendar Date matches loaded DB parameters.");

    // 2. Map Vendor Identifier via Search Dropdown Option Selection
    console.log(
      `🔍 Querying dropdown match matrix list components for Vendor Code: ${vendorCode}`,
    );
    const vendorInput = modalWindow.locator('input[name="vendor_id"]');

    // Clear input, focus, type sequentially to simulate genuine user typing, and wait for network/filter processing
    await vendorInput.click();
    await vendorInput.fill("");
    await vendorInput.type(vendorCode, { delay: 100 });
    await page.waitForTimeout(1000); // Small breathing room for ExtJS to filter the DOM list elements

    // Target the list item cleanly inside any active floating boundlist
    const boundListOption = page
      .locator(".x-boundlist-item")
      .filter({ hasText: vendorCode });

    try {
      // Force wait for visibility and use a clean direct click layout selection
      await boundListOption.waitFor({ state: "visible", timeout: 6000 });
      await boundListOption.first().click();
      console.log(
        `✅ Dropdown handshake completely resolved vendor mapping structure successfully.`,
      );
    } catch (dropdownError) {
      throw new Error(
        `Vendor Code "${vendorCode}" was not found or is not available in CSO.`,
      );
    }

    // 3. Document ID Value Mapping
    await modalWindow.locator('input[name="document_id"]').fill(docNumber);

    // =========================================================================
    // 4. Mode of Payment Selection Layer & Dynamic Check Validation
    // =========================================================================
    console.log(`💳 Querying MOP dropdown selection for: ${methodOfPayment}`);
    const mopInput = modalWindow.locator('input[name="payment_type"]');

    // Clear field, click, and type to trigger the boundlist rendering natively
    await mopInput.click();
    await mopInput.fill("");
    await mopInput.type(methodOfPayment, { delay: 100 });
    await page.waitForTimeout(1000); // Give the combo menu a second to expand and filter

    // Find the option in the boundlist that matches the target MOP text (case-insensitive)
    const mopRegExp = new RegExp(`^${methodOfPayment}$`, "i");
    const mopBoundListOption = page
      .locator(".x-boundlist-item")
      .filter({ hasText: mopRegExp });

    try {
      await mopBoundListOption.waitFor({ state: "visible", timeout: 5000 });
      await mopBoundListOption.first().click();
    } catch (mopDropdownError) {
      const backupOption = page
        .locator(".x-boundlist-item")
        .filter({ hasText: methodOfPayment });
      if ((await backupOption.count()) > 0) {
        await backupOption.first().click();
      } else {
        throw new Error(
          `Invalid Payment Method: "${methodOfPayment}" is not supported or not available.`,
        );
      }
    }

    // Conditional Mapping Step: If selection evaluation resolves as 'check'
    if (methodOfPayment.toLowerCase() === "check") {
      console.log(
        `🔍 MOP evaluated as 'check'. Waiting for target field input[name="check_number"] to append to DOM...`,
      );
      if (!checkNumber) {
        throw new Error(
          `Check number is missing for the selected 'check' payment method.`,
        );
      }
      const checkField = modalWindow.locator('input[name="check_number"]');

      // Explicitly wait for ExtJS layout generation rendering routine to complete
      await checkField.waitFor({ state: "visible", timeout: 5000 });
      await checkField.fill(String(checkNumber));
      console.log(`✅ Check number field populated with: ${checkNumber}`);
    }

    await page.waitForTimeout(1000); // Buffer to let any conditional styles or validation layouts finalize safely
    // =========================================================================
    // 5. Populate Accounting Balance & Submit Form
    // =========================================================================
    console.log(`💰 Populating Total Cost field with value: ${totalCost}`);
    await modalWindow
      .locator('input[name="total_cost"]')
      .fill(String(totalCost));
    await page.waitForTimeout(1000); // Allow any final focus validation styles to resolve

    console.log("💾 Triggering form submission via 'Save' action element...");
    // Target the save action button reliably inside the current open window scope
    const saveButton = modalWindow
      .locator(
        'button.x-btn-center:has-text("Save"), .greenButton button:has-text("Save")',
      )
      .first();
    await saveButton.waitFor({ state: "visible", timeout: 5000 });
    await saveButton.click();

    console.log(
      "⏳ Form submitted. Waiting for processing buffers and layout updates to clear...",
    );
    // Wait for the document upload modal window to disappear from the layout completely
    await modalWindow.waitFor({ state: "hidden", timeout: 20000 });
    await page.waitForTimeout(4000); // Give the background grid tables ample breathing room to refresh data rows

    // =========================================================================
    // GRID RECORD ROW VERIFICATION HANDSHAKE
    // =========================================================================
    console.log(
      `🔍 Verification Phase: Scanning the grid view matrix to validate submission matching Vendor: "${vendorName}" and Doc #: "${docNumber}"`,
    );

    // Locate the cells of the active grid layout container
    const dataTableRows = page.locator(
      ".x-grid-view table.x-grid-table tr.x-grid-row",
    );
    const totalGridRows = await dataTableRows.count();

    let submissionConfirmed = false;

    for (let i = 0; i < totalGridRows; i++) {
      const row = dataTableRows.nth(i);

      // Extract the cell inner values cleanly (Column 2 is index 1, Column 3 is index 2)
      const currentVendorCellText = await row
        .locator("td.x-grid-cell")
        .nth(1)
        .innerText();
      const currentDocNumCellText = await row
        .locator("td.x-grid-cell")
        .nth(2)
        .innerText();

      const cleanedGridVendor = currentVendorCellText.trim().toLowerCase();
      const cleanedGridDocNum = currentDocNumCellText.trim().toLowerCase();

      const expectedVendor = vendorName.trim().toLowerCase();
      const expectedDocNum = docNumber.trim().toLowerCase();

      // Flexible validation: verify vendor text matches closely and doc number matches explicitly
      if (
        (cleanedGridVendor.includes(expectedVendor) ||
          expectedVendor.includes(cleanedGridVendor)) &&
        cleanedGridDocNum === expectedDocNum
      ) {
        console.log(
          `✅ System verified matching grid trace! Row match found -> Vendor: "${currentVendorCellText.trim()}" | Doc #: "${currentDocNumCellText.trim()}"`,
        );
        submissionConfirmed = true;
        break;
      }
    }

    if (!submissionConfirmed) {
      throw new Error(
        `Invoice saved, but could not be verified in the CSO table. Please check if Document #${docNumber} exists in CSO.`,
      );
    }

    // =========================================================================
    // SCREENSHOT EVIDENCE PROOFS & CLEAN UP WORKSPACE
    // =========================================================================
    const screenshotPath = path.join(
      outputDir,
      `phase2_success_${siteCsoCode}_${invoiceId}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(
      `📸 Process completion snapshot recorded under services directory: ${screenshotPath}`,
    );

    // 🚀 Update status to success in MongoDB
    console.log(`💾 Persisting database update status to: uploaded_to_cso`);
    await CsoInvoice.findByIdAndUpdate(invoiceId, {
      status: "uploaded_to_cso",
      csoUploadError: null,
    });

    localFilePaths.forEach((filePath) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    await browser.close();
    return { success: true };
  } catch (error) {
    console.error("❌ AUTOMATION EXECUTION FAULT AT RUNTIME:", error);

    try {
      const errScreenshotPath = path.join(
        outputDir,
        `automation_error_${siteCsoCode}_${invoiceId}.png`,
      );
      await page.screenshot({ path: errScreenshotPath, fullPage: true });
      console.log(
        `📸 Technical exception proof written to: ${errScreenshotPath}`,
      );
    } catch (ssErr) {
      console.error("Failed writing fallback diagnostic screenshots:", ssErr);
    }

    // Guarding: Don't dispatch error notifications or fail state if it was a programmatic retry redirection
    if (!error.message.includes("RETRY_PHASE_1")) {
      // =======================================================================
      // 🚀 ERROR CLASSIFICATION ENGINE (User vs System Error)
      // =======================================================================
      let formattedUserError = error.message;

      // Identify user errors based on known validation phrases
      const isUserError =
        error.message.includes("Vendor Code") ||
        error.message.includes("Invalid Payment Method") ||
        error.message.includes("Check number is missing") ||
        error.message.includes("could not be verified");

      if (!isUserError) {
        // Classify Playwright timeouts, network breaks, or navigation issues as System Errors
        if (
          error.message.includes("Timeout") ||
          error.message.includes("waiting for selector")
        ) {
          formattedUserError =
            "System Error: CStoreOffice portal responded slowly or failed to load required components. Please try again later.";
        } else if (
          error.message.includes("kc-login") ||
          error.message.includes("username")
        ) {
          formattedUserError =
            "System Error: CStoreOffice portal authentication failed or login screen was unreachable.";
        } else {
          formattedUserError = `System Error: ${error.message}`;
        }
      }

      console.log(`💾 Persisting database error status to: failed_cso_upload`);
      console.log(`📝 Formatted Error Message: "${formattedUserError}"`);

      // Save user-friendly message directly into MongoDB for UI display
      await CsoInvoice.findByIdAndUpdate(invoiceId, {
        status: "failed_cso_upload",
        csoUploadError: formattedUserError,
      });

      const systemAlertHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
              ⚠️ Critical Failure: Invoice Input Engine Exception
            </h2>
            <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
              An automation fault suspended script operations processing invoice updates for Station CSO Code: <strong>${siteCsoCode}</strong>.
            </p>
          </div>
          <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
            <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Frontend User Error:</strong>
            <p style="font-family: monospace; font-size: 13px; color: #dc2626; margin: 8px 0 0 0; white-space: pre-wrap;">${formattedUserError}</p>
          </div>
          <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
            <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Raw Technical Trace:</strong>
            <p style="font-family: monospace; font-size: 12px; color: #64748b; margin: 8px 0 0 0; white-space: pre-wrap;">${error.stack || error.message}</p>
          </div>
        </div>
      `;

      await emailQueue.add(`docflow-error-${Date.now()}`, {
        to: "daksh@gen7fuel.com",
        subject: `🚨 Hub Automation Pipeline Breakpoint (Station: ${siteCsoCode})`,
        html: systemAlertHtml,
      });
    }

    await browser.close();
    throw error;
  }
}

module.exports = { processInvoiceAutomation };
